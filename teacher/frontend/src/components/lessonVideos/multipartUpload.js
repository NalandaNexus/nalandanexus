/**
 * Uploads one video file straight to private object storage, in parts.
 *
 * Nothing here talks to storage with a credential. The portal's backend (and,
 * behind it, the student service) opens a multipart session and hands out
 * short-lived presigned URLs, each good for one part; this PUTs file slices to
 * them, several at a time, and then asks the server to assemble and verify the
 * file. The file never passes through any application server, so there is no
 * request-size limit to hit and nothing large is held in memory - each part is
 * a Blob slice read by the browser as it is sent.
 *
 *  - Every part is retried with back-off; an expired URL is simply re-issued.
 *  - The session is remembered (localStorage, keyed by course and module), so
 *    after a failure, a lost connection or a closed tab, choosing the same file
 *    again resumes: the server asks storage which parts it already holds, and
 *    only the rest are sent.
 *  - Completing is safe to repeat; while the server is still verifying, this
 *    keeps asking until the file is attached, refused, or conflicts.
 *
 * Copied byte for byte into the Admin portal (see LessonVideoEditor.jsx).
 */

const STORAGE_PREFIX = 'nalanda.videoUpload.';
const URL_BATCH = 50;
const URL_FRESH_MS = 45 * 60 * 1000; // presigned part URLs live 60 minutes
const MAX_PART_ATTEMPTS = 5;
const PROCESSING_POLL_MS = 3000;
const PROCESSING_MAX_POLLS = 200; // ~10 minutes

export class UploadError extends Error {
  constructor(message, { code = 'UPLOAD_FAILED', status = 0, retryable = false, details = null } = {}) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

const abortError = () => Object.assign(new Error('Upload cancelled'), { name: 'AbortError' });

export const fileFingerprint = (file) => `${file.name}|${file.size}|${file.lastModified || 0}`;

export function readSavedUpload(scope) {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + scope);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUpload(scope, state) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(state));
  } catch {
    // Private mode or full storage: the upload still works, it just cannot resume after a reload.
  }
}

export function clearSavedUpload(scope) {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + scope);
  } catch {
    // Nothing to clear.
  }
}

/** One part, PUT to its presigned URL with upload progress. Rejects with { status } on failure. */
export function putPart(url, blob, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const done = (fn) => (value) => {
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded);
    };
    xhr.onload = done(() => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError(`Storage answered ${xhr.status}`, { status: xhr.status, retryable: true }));
    });
    xhr.onerror = done(() => reject(new UploadError('Network error while sending part of the file', { status: 0, retryable: true })));
    xhr.onabort = done(() => reject(abortError()));
    xhr.send(blob);
  });
}

const defaultSleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(abortError());
      },
      { once: true }
    );
  });

/**
 * @param {object}   o
 * @param {File}     o.file
 * @param {object}   o.api        { start(payload), partUrls(uploadId, numbers), resume(uploadId), complete(uploadId, body) }
 * @param {string}   o.scope      what this upload is for (course + module/lesson), for resuming
 * @param {object}   o.startPayload  { fileName, fileSize, mimeType, title, description, isPublished, expectedUpdatedAt }
 * @param {number}   [o.duration] seconds, read from the file's metadata in the browser
 * @param {Function} [o.onProgress] ({ loaded, total, fraction })
 * @param {Function} [o.onPhase]  'starting' | 'resuming' | 'uploading' | 'processing'
 * @param {Function} [o.onSession] ({ uploadId }) once the session is known
 * @param {AbortSignal} [o.signal]
 * @returns the completed result from the server ({ status: 'completed', video, ... })
 */
export async function uploadVideoFile({
  file,
  api,
  scope,
  startPayload,
  duration,
  onProgress,
  onPhase,
  onSession,
  signal,
  concurrency = 3,
  sleep = defaultSleep,
  sendPart = putPart,
}) {
  const fingerprint = fileFingerprint(file);
  let session = null;
  const done = new Map(); // partNumber -> size

  // 1. Resume a session for this same file, or open a new one.
  const saved = readSavedUpload(scope);
  if (saved?.fingerprint === fingerprint && saved.uploadId) {
    onPhase?.('resuming');
    try {
      const state = await api.resume(saved.uploadId);
      if (state?.status === 'uploading' || state?.status === 'verified') {
        session = { ...saved, status: state.status };
        for (const p of state.uploadedParts || []) done.set(p.partNumber, p.size);
      }
    } catch (err) {
      if (isAbortLike(err, signal)) throw abortError();
      // Gone or not ours any more: start fresh.
    }
    if (!session) clearSavedUpload(scope);
  }
  if (!session) {
    onPhase?.('starting');
    const started = await api.start(startPayload);
    session = {
      uploadId: started.uploadId,
      partSize: started.partSize,
      totalParts: started.totalParts,
      fingerprint,
      fileName: file.name,
      fileSize: file.size,
      startedAt: new Date().toISOString(),
      status: 'uploading',
    };
    saveUpload(scope, session);
  }
  onSession?.({ uploadId: session.uploadId });

  const { partSize, totalParts, uploadId } = session;
  const partBytes = (n) => (n < totalParts ? partSize : file.size - partSize * (totalParts - 1));
  const inFlight = new Map();
  const report = () => {
    let loaded = 0;
    for (const size of done.values()) loaded += size;
    for (const bytes of inFlight.values()) loaded += bytes;
    loaded = Math.min(loaded, file.size);
    onProgress?.({ loaded, total: file.size, fraction: file.size ? loaded / file.size : 1 });
  };

  async function sendParts(numbers) {
    const queue = numbers.filter((n) => !done.has(n));
    if (!queue.length) return;
    onPhase?.('uploading');
    report();
    const urls = new Map();
    let pendingFetch = null;

    const urlFor = async (n, depth = 0) => {
      const cached = urls.get(n);
      if (cached && Date.now() - cached.at < URL_FRESH_MS) return cached.url;
      if (depth > 1) throw new UploadError('The server did not issue an upload address for part of the file.', { retryable: true });
      if (!pendingFetch) {
        const wanted = [n, ...queue.filter((m) => m !== n && !urls.has(m))].slice(0, URL_BATCH);
        pendingFetch = api
          .partUrls(uploadId, wanted)
          .then((res) => {
            const at = Date.now();
            for (const p of res.parts || []) urls.set(p.partNumber, { url: p.url, at });
          })
          .finally(() => {
            pendingFetch = null;
          });
      }
      await pendingFetch;
      const fresh = urls.get(n);
      if (fresh) return fresh.url;
      return urlFor(n, depth + 1);
    };

    // One failing part stops the others too, instead of leaving them sending.
    const local = new AbortController();
    const onOuterAbort = () => local.abort();
    signal?.addEventListener('abort', onOuterAbort, { once: true });

    const worker = async () => {
      while (queue.length) {
        if (local.signal.aborted) throw abortError();
        const n = queue.shift();
        const start = (n - 1) * partSize;
        const blob = file.slice(start, start + partBytes(n));
        for (let attempt = 1; ; attempt += 1) {
          try {
            const url = await urlFor(n);
            await sendPart(url, blob, {
              signal: local.signal,
              onProgress: (loaded) => {
                inFlight.set(n, loaded);
                report();
              },
            });
            inFlight.delete(n);
            done.set(n, blob.size);
            report();
            break;
          } catch (err) {
            inFlight.delete(n);
            if (isAbortLike(err, local.signal)) throw abortError();
            // A 403 is usually an expired URL: ask for a new one next time.
            if (err?.status === 403) urls.delete(n);
            if (attempt >= MAX_PART_ATTEMPTS || err?.retryable === false) {
              throw new UploadError(
                'Part of the file could not be sent after several attempts. Check your connection, then choose Retry - the upload continues where it stopped.',
                { code: 'PART_FAILED', retryable: true }
              );
            }
            await sleep(Math.min(1000 * 2 ** (attempt - 1), 15000), local.signal);
          }
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker));
    } catch (err) {
      local.abort();
      throw signal?.aborted ? abortError() : err;
    } finally {
      signal?.removeEventListener('abort', onOuterAbort);
      inFlight.clear();
    }
  }

  if (session.status === 'uploading') {
    await sendParts(Array.from({ length: totalParts }, (_, i) => i + 1));
  } else {
    report();
  }

  // 2. Assemble and verify on the server; wait while it is processing.
  onPhase?.('processing');
  let incompleteRetries = 2;
  let transportRetries = 3;
  for (let poll = 0; poll < PROCESSING_MAX_POLLS; poll += 1) {
    if (signal?.aborted) throw abortError();
    let result;
    try {
      result = await api.complete(uploadId, duration !== undefined ? { duration } : {});
    } catch (err) {
      if (isAbortLike(err, signal)) throw abortError();
      const details = err?.details ?? err?.errors ?? null;
      if (err?.code === 'UPLOAD_INCOMPLETE' && incompleteRetries > 0 && Array.isArray(details?.missingParts)) {
        incompleteRetries -= 1;
        for (const n of details.missingParts) done.delete(n);
        await sendParts(details.missingParts);
        onPhase?.('processing');
        continue;
      }
      if ((err?.status === 0 || err?.status >= 500) && transportRetries > 0) {
        transportRetries -= 1;
        await sleep(PROCESSING_POLL_MS, signal);
        continue;
      }
      // A refusal that cannot be retried (not a video, expired) ends the session.
      if (['VIDEO_VERIFICATION_FAILED', 'VIDEO_SIZE_MISMATCH', 'UPLOAD_EXPIRED', 'UPLOAD_NOT_WRITABLE', 'UPLOAD_NOT_FOUND'].includes(err?.code)) {
        clearSavedUpload(scope);
      }
      // A conflict keeps the session: the verified file can still be attached.
      throw err;
    }
    if (result?.status === 'processing') {
      await sleep(PROCESSING_POLL_MS, signal);
      continue;
    }
    clearSavedUpload(scope);
    return { ...result, uploadId };
  }
  throw new UploadError('The server is still verifying this video. It will appear when verification finishes; check back in a few minutes.', {
    code: 'PROCESSING_SLOW',
    retryable: true,
  });
}

function isAbortLike(err, signal) {
  return err?.name === 'AbortError' || Boolean(signal?.aborted);
}

/** Reads a video file's duration in the browser (no upload needed); undefined when it cannot. */
export function readVideoDuration(file, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return resolve(undefined);
    const video = document.createElement('video');
    const src = URL.createObjectURL(file);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(src);
      resolve(value);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined);
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(undefined);
    };
    video.src = src;
  });
}
