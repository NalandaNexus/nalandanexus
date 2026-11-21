import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadVideoFile, readSavedUpload, fileFingerprint, UploadError } from './multipartUpload';

/**
 * The browser side of a chunked upload, against an in-memory stand-in for the
 * portal API and for storage. Parts are tiny here (10 bytes) so a "large"
 * multi-part file is a few dozen bytes; the logic is the same at 10 MiB.
 */

const SCOPE = 'teacher:prarambh:m:mod-1';
const PART = 10;

function makeFile(size = 35, name = 'lecture.mp4', lastModified = 1700000000000) {
  return new File([new Uint8Array(size).fill(7)], name, { type: 'video/mp4', lastModified });
}

function makeServer({ partSize = PART, completeAnswers = [] } = {}) {
  const stored = new Map(); // partNumber -> size
  let session = null;
  const answers = [...completeAnswers];
  const api = {
    start: vi.fn(async (payload) => {
      session = { uploadId: 'up-1', partSize, totalParts: Math.ceil(payload.fileSize / partSize), status: 'uploading' };
      return session;
    }),
    partUrls: vi.fn(async (uploadId, numbers) => ({ parts: numbers.map((n) => ({ partNumber: n, url: `https://storage.test/${uploadId}/${n}` })) })),
    resume: vi.fn(async () => ({ status: 'uploading', uploadedParts: [...stored.entries()].map(([partNumber, size]) => ({ partNumber, size })) })),
    complete: vi.fn(async () => {
      const next = answers.shift();
      if (next instanceof Error) throw next;
      if (next) return next;
      return { status: 'completed', video: { provider: 'upload', fileName: 'lecture.mp4', isPublished: true } };
    }),
  };
  const sendPart = vi.fn(async (url, blob, { onProgress }) => {
    onProgress?.(blob.size);
    stored.set(Number(url.split('/').pop()), blob.size);
  });
  return { api, sendPart, stored, get session() {
    return session;
  } };
}

const noSleep = () => Promise.resolve();
const startPayload = (file) => ({ fileName: file.name, fileSize: file.size, mimeType: file.type, isPublished: true });

beforeEach(() => {
  window.localStorage.clear();
});

describe('uploadVideoFile', () => {
  it('sends every part straight to storage, reports progress to 100%, then completes once', async () => {
    const file = makeFile(35);
    const server = makeServer();
    const progress = [];
    const phases = [];
    const result = await uploadVideoFile({
      file,
      api: server.api,
      scope: SCOPE,
      startPayload: startPayload(file),
      duration: 61.5,
      sendPart: server.sendPart,
      sleep: noSleep,
      onProgress: (p) => progress.push(p.fraction),
      onPhase: (p) => phases.push(p),
    });

    expect(result.status).toBe('completed');
    expect(server.api.start).toHaveBeenCalledTimes(1);
    expect(server.sendPart).toHaveBeenCalledTimes(4);
    expect([...server.stored.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 10],
      [2, 10],
      [3, 10],
      [4, 5],
    ]);
    expect(progress.at(-1)).toBe(1);
    expect(phases).toEqual(expect.arrayContaining(['starting', 'uploading', 'processing']));
    expect(server.api.complete).toHaveBeenCalledWith('up-1', { duration: 61.5 });
    expect(readSavedUpload(SCOPE)).toBeNull();
  });

  it('retries a failed part with back-off, and asks for a new URL after a 403', async () => {
    const file = makeFile(25);
    const server = makeServer();
    let failures = 0;
    const flaky = vi.fn(async (url, blob, opts) => {
      if (url.endsWith('/2') && failures < 2) {
        failures += 1;
        throw new UploadError('expired', { status: failures === 1 ? 403 : 500, retryable: true });
      }
      return server.sendPart(url, blob, opts);
    });
    const sleep = vi.fn(noSleep);
    await uploadVideoFile({ file, api: server.api, scope: SCOPE, startPayload: startPayload(file), sendPart: flaky, sleep, concurrency: 1 });
    expect(server.stored.get(2)).toBe(10);
    expect(sleep).toHaveBeenCalledWith(1000, expect.anything());
    expect(sleep).toHaveBeenCalledWith(2000, expect.anything());
    // The 403 dropped part 2's URL, so a second batch was requested for it.
    expect(server.api.partUrls.mock.calls.some(([, numbers]) => numbers[0] === 2)).toBe(true);
  });

  it('gives up on a part after five attempts but keeps the session, so Retry continues where it stopped', async () => {
    const file = makeFile(35);
    const server = makeServer();
    const broken = vi.fn(async (url, blob, opts) => {
      if (url.endsWith('/3')) throw new UploadError('network', { status: 0, retryable: true });
      return server.sendPart(url, blob, opts);
    });
    await expect(
      uploadVideoFile({ file, api: server.api, scope: SCOPE, startPayload: startPayload(file), sendPart: broken, sleep: noSleep, concurrency: 1 })
    ).rejects.toMatchObject({ code: 'PART_FAILED', retryable: true });
    expect(broken.mock.calls.filter(([url]) => url.endsWith('/3'))).toHaveLength(5);
    expect(server.api.complete).not.toHaveBeenCalled();
    expect(readSavedUpload(SCOPE)).toMatchObject({ uploadId: 'up-1', fingerprint: fileFingerprint(file) });

    // Retry: the same file resumes the same session and sends only what is missing.
    server.sendPart.mockClear();
    const result = await uploadVideoFile({ file, api: server.api, scope: SCOPE, startPayload: startPayload(file), sendPart: server.sendPart, sleep: noSleep });
    expect(result.status).toBe('completed');
    expect(server.api.start).toHaveBeenCalledTimes(1);
    expect(server.api.resume).toHaveBeenCalledWith('up-1');
    const resent = server.sendPart.mock.calls.map(([url]) => Number(url.split('/').pop())).sort();
    expect(resent).toEqual([3, 4]);
  });

  it('a different file never resumes another file’s session', async () => {
    const server = makeServer();
    const first = makeFile(35, 'a.mp4');
    await expect(
      uploadVideoFile({
        file: first,
        api: server.api,
        scope: SCOPE,
        startPayload: startPayload(first),
        sendPart: async () => {
          throw new UploadError('down', { status: 0, retryable: false });
        },
        sleep: noSleep,
      })
    ).rejects.toBeTruthy();
    const second = makeFile(35, 'b.mp4');
    await uploadVideoFile({ file: second, api: server.api, scope: SCOPE, startPayload: startPayload(second), sendPart: server.sendPart, sleep: noSleep });
    expect(server.api.resume).not.toHaveBeenCalled();
    expect(server.api.start).toHaveBeenCalledTimes(2);
  });

  it('keeps asking while the server is still verifying the file', async () => {
    const file = makeFile(12);
    const server = makeServer({ completeAnswers: [{ status: 'processing' }, { status: 'processing' }] });
    const sleep = vi.fn(noSleep);
    const result = await uploadVideoFile({ file, api: server.api, scope: SCOPE, startPayload: startPayload(file), sendPart: server.sendPart, sleep });
    expect(result.status).toBe('completed');
    expect(server.api.complete).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(3000, undefined);
  });

  it('sends parts the server says are missing, then completes', async () => {
    const file = makeFile(35);
    const incomplete = Object.assign(new Error('1 part(s) of the file have not reached storage yet.'), {
      status: 422,
      code: 'UPLOAD_INCOMPLETE',
      errors: { missingParts: [2] },
    });
    const server = makeServer({ completeAnswers: [incomplete] });
    await uploadVideoFile({ file, api: server.api, scope: SCOPE, startPayload: startPayload(file), sendPart: server.sendPart, sleep: noSleep });
    expect(server.sendPart.mock.calls.filter(([url]) => url.endsWith('/2'))).toHaveLength(2);
    expect(server.api.complete).toHaveBeenCalledTimes(2);
  });

  it('a file the server refuses as not-a-video ends the session; a conflict keeps it for the uploader to decide', async () => {
    const file = makeFile(15);
    const refused = Object.assign(new Error('This file is not a playable video'), { status: 422, code: 'VIDEO_VERIFICATION_FAILED' });
    const server = makeServer({ completeAnswers: [refused] });
    await expect(uploadVideoFile({ file, api: server.api, scope: SCOPE, startPayload: startPayload(file), sendPart: server.sendPart, sleep: noSleep })).rejects.toMatchObject({
      code: 'VIDEO_VERIFICATION_FAILED',
    });
    expect(readSavedUpload(SCOPE)).toBeNull();

    const changed = Object.assign(new Error('changed'), { status: 409, code: 'VIDEO_CHANGED', details: { uploadId: 'up-1', uploadStatus: 'verified' } });
    const again = makeServer({ completeAnswers: [changed] });
    await expect(uploadVideoFile({ file, api: again.api, scope: SCOPE, startPayload: startPayload(file), sendPart: again.sendPart, sleep: noSleep })).rejects.toMatchObject({
      code: 'VIDEO_CHANGED',
    });
    expect(readSavedUpload(SCOPE)).toMatchObject({ uploadId: 'up-1' });
  });

  it('cancelling stops sending and never completes', async () => {
    const file = makeFile(35);
    const server = makeServer();
    const controller = new AbortController();
    const slow = vi.fn(async (url, blob, { signal }) => {
      controller.abort();
      if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      return server.sendPart(url, blob, {});
    });
    await expect(
      uploadVideoFile({ file, api: server.api, scope: SCOPE, startPayload: startPayload(file), sendPart: slow, sleep: noSleep, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(server.api.complete).not.toHaveBeenCalled();
  });
});
