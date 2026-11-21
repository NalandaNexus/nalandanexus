import crypto from 'node:crypto';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Private S3-compatible object storage for uploaded course videos.
 *
 * Cloudflare R2, AWS S3 and MinIO all speak this API. Video bytes travel
 * between the browser and the bucket directly - the uploader PUTs each part to
 * a short-lived presigned URL, and a student's <video> element streams with
 * HTTP range requests from another presigned URL. Neither Express nor MongoDB
 * ever holds the file; this service only signs, verifies and cleans up.
 *
 * The bucket stays private. Credentials live only in this backend's
 * environment, and nothing derived from them except a time-limited signature
 * ever leaves it.
 */

let client = null;
let clientConfigKey = '';

function config() {
  return env.videoStorage;
}

export function isVideoStorageConfigured() {
  const c = config();
  return Boolean(c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey);
}

function storageNotConfigured() {
  return new AppError(
    'Video uploads are not available yet: private video storage has not been configured on the server. YouTube and Google Drive links still work.',
    503,
    'VIDEO_STORAGE_NOT_CONFIGURED'
  );
}

function getClient() {
  if (!isVideoStorageConfigured()) throw storageNotConfigured();
  const c = config();
  const key = [c.endpoint, c.region, c.bucket, c.accessKeyId, c.forcePathStyle].join('|');
  if (!client || key !== clientConfigKey) {
    client = new S3Client({
      endpoint: c.endpoint,
      region: c.region || 'auto',
      forcePathStyle: c.forcePathStyle !== false,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      // Since SDK 3.729 every request carries a CRC32 checksum by default.
      // R2/MinIO reject some of those headers, and a checksum baked into a
      // presigned part URL would have to match bytes the browser has not sent
      // yet - so checksums are only used where the S3 API requires them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3,
    });
    clientConfigKey = key;
  }
  return client;
}

/** Test seam: forget the cached client after tests change env.videoStorage. */
export function resetVideoStorageClient() {
  client = null;
  clientConfigKey = '';
}

const statusOf = (err) => err?.$metadata?.httpStatusCode || err?.statusCode || 0;

function wrap(operation, err) {
  if (err instanceof AppError) return err;
  const code = err?.name || err?.Code || 'Unknown';
  if (code === 'NoSuchUpload') {
    return new AppError('This upload session has expired at the storage provider. Start the upload again.', 410, 'UPLOAD_EXPIRED');
  }
  logger.error(`[videoStorage] ${operation} failed: ${code} (HTTP ${statusOf(err) || '?'}) ${err?.message || ''}`.trim());
  return new AppError('Video storage did not respond as expected. Nothing was changed; please try again.', 503, 'VIDEO_STORAGE_ERROR');
}

async function send(operation, command) {
  try {
    return await getClient().send(command);
  } catch (err) {
    throw wrap(operation, err);
  }
}

// --- Keys and sizing -----------------------------------------------------------

/** Object keys never contain user input: a course id and a random UUID. */
export function createObjectKey(courseId, extension) {
  const ext = /^\.[a-z0-9]{2,5}$/.test(extension) ? extension : '';
  return `course-videos/${String(courseId)}/${crypto.randomUUID()}${ext}`;
}

const MIN_PART_SIZE = 10 * 1024 * 1024; // above S3's 5 MiB minimum, small enough to retry cheaply
const MAX_PARTS = 9000; // below S3's 10,000-part ceiling, leaving room for a larger final part

/** Part size for a file: 10 MiB, growing (in whole MiB) only for very large files. */
export function partSizeFor(fileSize) {
  const needed = Math.ceil(fileSize / MAX_PARTS);
  const mib = 1024 * 1024;
  return Math.max(MIN_PART_SIZE, Math.ceil(needed / mib) * mib);
}

// --- Multipart upload ------------------------------------------------------------

export async function initiateMultipartUpload({ key, contentType, fileName }) {
  const out = await send(
    'CreateMultipartUpload',
    new CreateMultipartUploadCommand({
      Bucket: config().bucket,
      Key: key,
      ContentType: contentType,
      // ASCII-only metadata: S3 rejects other header bytes.
      Metadata: { 'original-name': encodeURIComponent(fileName).slice(0, 512) },
    })
  );
  if (!out?.UploadId) throw new AppError('Video storage did not open an upload session.', 503, 'VIDEO_STORAGE_ERROR');
  return out.UploadId;
}

export const PART_URL_TTL_SECONDS = 60 * 60;

/** A presigned URL the browser PUTs one part to. It authorizes exactly that part. */
export async function partUploadUrl({ key, uploadId, partNumber }) {
  try {
    return await getSignedUrl(
      getClient(),
      new UploadPartCommand({ Bucket: config().bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn: PART_URL_TTL_SECONDS }
    );
  } catch (err) {
    throw wrap('PresignUploadPart', err);
  }
}

/** The parts the storage provider actually holds - the authority on what was uploaded. */
export async function listUploadedParts({ key, uploadId }) {
  const parts = [];
  let marker;
  for (let page = 0; page < 20; page += 1) {
    const out = await send(
      'ListParts',
      new ListPartsCommand({ Bucket: config().bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker, MaxParts: 1000 })
    );
    for (const p of out?.Parts || []) {
      parts.push({ partNumber: Number(p.PartNumber), etag: String(p.ETag || ''), size: Number(p.Size || 0) });
    }
    if (!out?.IsTruncated) break;
    marker = out.NextPartNumberMarker;
  }
  return parts.sort((a, b) => a.partNumber - b.partNumber);
}

export async function completeMultipartUpload({ key, uploadId, parts }) {
  await send(
    'CompleteMultipartUpload',
    new CompleteMultipartUploadCommand({
      Bucket: config().bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    })
  );
}

/** Best effort: an abandoned session is also removed by the bucket lifecycle rule. */
export async function abortMultipartUpload({ key, uploadId }) {
  try {
    await getClient().send(new AbortMultipartUploadCommand({ Bucket: config().bucket, Key: key, UploadId: uploadId }));
    return true;
  } catch (err) {
    if (err?.name === 'NoSuchUpload') return true;
    logger.warn(`[videoStorage] AbortMultipartUpload failed for ${key}: ${err?.name || err?.message}`);
    return false;
  }
}

// --- Objects -------------------------------------------------------------------------

/** Size and type of a stored object, or null when it does not exist. */
export async function headObject(key) {
  try {
    const out = await getClient().send(new HeadObjectCommand({ Bucket: config().bucket, Key: key }));
    return {
      size: Number(out.ContentLength || 0),
      contentType: String(out.ContentType || '').split(';')[0].trim().toLowerCase(),
    };
  } catch (err) {
    if (statusOf(err) === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') return null;
    throw wrap('HeadObject', err);
  }
}

/** The first bytes of an object, read with a range request (never the whole file). */
export async function readObjectStart(key, bytes = 64 * 1024) {
  const out = await send('GetObject(range)', new GetObjectCommand({ Bucket: config().bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
  const body = await out.Body.transformToByteArray();
  return Buffer.from(body).subarray(0, bytes);
}

export async function deleteObject(key) {
  await send('DeleteObject', new DeleteObjectCommand({ Bucket: config().bucket, Key: key }));
}

/**
 * How long a student's playback URL lives. A <video> element re-requests
 * ranges with the same URL while seeking, so this must outlast a viewing
 * session; when it does lapse, the player asks the API for a fresh one and
 * resumes where it was. Retired objects are kept at least this long (see
 * lessonVideo.service.js) so a URL already handed out never dies early.
 */
export const PLAYBACK_URL_TTL_SECONDS = 2 * 60 * 60;

export async function signedPlaybackUrl(key, { contentType } = {}) {
  try {
    const url = await getSignedUrl(
      getClient(),
      new GetObjectCommand({
        Bucket: config().bucket,
        Key: key,
        ResponseContentDisposition: 'inline',
        ...(contentType ? { ResponseContentType: contentType } : {}),
      }),
      { expiresIn: PLAYBACK_URL_TTL_SECONDS }
    );
    return { url, expiresAt: new Date(Date.now() + PLAYBACK_URL_TTL_SECONDS * 1000).toISOString() };
  } catch (err) {
    throw wrap('PresignGetObject', err);
  }
}

// --- Bucket setup (operator script) ---------------------------------------------------

/**
 * Browsers PUT parts cross-origin and must read each part's ETag, and the
 * student player issues cross-origin range GETs. Origins are the three portal
 * frontends; nothing else may use the bucket from a browser.
 */
export async function applyBucketCors(origins) {
  await send(
    'PutBucketCors',
    new PutBucketCorsCommand({
      Bucket: config().bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ['GET', 'HEAD', 'PUT'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
}

export async function readBucketCors() {
  const out = await send('GetBucketCors', new GetBucketCorsCommand({ Bucket: config().bucket }));
  return out?.CORSRules || [];
}

/** Storage-side safety net: parts of a session nobody finished are dropped after 2 days. */
export async function applyAbortIncompleteUploadsRule() {
  await send(
    'PutBucketLifecycleConfiguration',
    new PutBucketLifecycleConfigurationCommand({
      Bucket: config().bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'nalanda-abort-incomplete-video-uploads',
            Status: 'Enabled',
            Filter: { Prefix: 'course-videos/' },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 2 },
          },
        ],
      },
    })
  );
}
