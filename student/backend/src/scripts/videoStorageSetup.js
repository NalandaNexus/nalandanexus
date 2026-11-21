import crypto from 'node:crypto';
import { env } from '../config/env.js';
import {
  isVideoStorageConfigured,
  applyBucketCors,
  readBucketCors,
  applyAbortIncompleteUploadsRule,
  createObjectKey,
  partSizeFor,
  initiateMultipartUpload,
  partUploadUrl,
  listUploadedParts,
  completeMultipartUpload,
  abortMultipartUpload,
  headObject,
  readObjectStart,
  signedPlaybackUrl,
  deleteObject,
} from '../services/videoObjectStorage.service.js';
import { detectVideoContainer } from '../utils/videoFile.js';

/**
 * Operator tool for the private video bucket. Reads VIDEO_STORAGE_* from the
 * environment like the server does, and prints no secret.
 *
 *   node src/scripts/videoStorageSetup.js --check
 *       credentials and bucket reachable; current CORS rules
 *   node src/scripts/videoStorageSetup.js --configure https://admin.example,https://teacher.example,https://www.example
 *       sets the bucket CORS rule (browser part uploads + range playback from
 *       those origins) and the abort-incomplete-uploads lifecycle rule
 *   node src/scripts/videoStorageSetup.js --self-test
 *       a real end-to-end round trip against the bucket: a 3-part multipart
 *       upload through presigned URLs (as a browser does), assembly, size and
 *       signature verification, a ranged read through a signed playback URL,
 *       then deletion. Leaves nothing behind. This is the check to run before
 *       claiming uploads work in a given environment.
 */

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || '' : null;
};

function mask(value) {
  return value ? `${value.slice(0, 4)}…(${value.length} chars)` : '(empty)';
}

async function check() {
  const c = env.videoStorage;
  console.log(`endpoint  ${c.endpoint || '(empty)'}`);
  console.log(`region    ${c.region}`);
  console.log(`bucket    ${c.bucket || '(empty)'}`);
  console.log(`key id    ${mask(c.accessKeyId)}`);
  console.log(`secret    ${c.secretAccessKey ? '(set)' : '(empty)'}`);
  console.log(`max size  ${Math.round(c.maxUploadBytes / 1024 ** 3)} GB`);
  if (!isVideoStorageConfigured()) throw new Error('VIDEO_STORAGE_ENDPOINT, _BUCKET, _ACCESS_KEY_ID and _SECRET_ACCESS_KEY must all be set.');
  try {
    const rules = await readBucketCors();
    console.log('CORS rules:', JSON.stringify(rules, null, 2));
  } catch (err) {
    console.log(`CORS rules: none readable (${err.code || err.message})`);
  }
}

async function configure(originsArg) {
  const origins = originsArg
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (!origins.length || origins.some((o) => !/^https?:\/\/[^/]+$/.test(o))) {
    throw new Error('Pass the portal frontend origins, comma-separated, e.g. https://admin.example.com,https://teacher.example.com');
  }
  await applyBucketCors(origins);
  console.log(`CORS set for: ${origins.join(', ')}`);
  try {
    await applyAbortIncompleteUploadsRule();
    console.log('Lifecycle rule set: incomplete uploads under course-videos/ are aborted after 2 days.');
  } catch (err) {
    console.log(`Lifecycle rule not set (${err.code || err.message}); the server's own sweep still aborts idle uploads.`);
  }
}

function sampleMp4(size) {
  const bytes = crypto.randomBytes(size);
  // A minimal ISO-BMFF header: [size]['ftyp']['isom'] - enough for signature verification.
  Buffer.from([0, 0, 0, 0x18]).copy(bytes, 0);
  Buffer.from('ftypisom', 'latin1').copy(bytes, 4);
  return bytes;
}

async function selfTest() {
  if (!isVideoStorageConfigured()) throw new Error('Video storage is not configured.');
  const size = 2 * 10 * 1024 * 1024 + 123_457; // three parts at the 10 MiB part size
  const file = sampleMp4(size);
  const key = createObjectKey('self-test', '.mp4');
  const partSize = partSizeFor(size);
  const total = Math.ceil(size / partSize);
  console.log(`1/7 open multipart upload (${total} parts of ${partSize} bytes) -> ${key}`);
  const uploadId = await initiateMultipartUpload({ key, contentType: 'video/mp4', fileName: 'self-test.mp4' });
  try {
    for (let n = 1; n <= total; n += 1) {
      const url = await partUploadUrl({ key, uploadId, partNumber: n });
      const chunk = file.subarray((n - 1) * partSize, Math.min(size, n * partSize));
      const res = await fetch(url, { method: 'PUT', body: chunk });
      if (!res.ok) throw new Error(`part ${n}: HTTP ${res.status} ${await res.text()}`);
      if (!res.headers.get('etag')) throw new Error(`part ${n}: no ETag header in the response`);
      console.log(`2/7 part ${n} uploaded through a presigned URL (${chunk.length} bytes)`);
    }
    const parts = await listUploadedParts({ key, uploadId });
    console.log(`3/7 storage lists ${parts.length} part(s)`);
    await completeMultipartUpload({ key, uploadId, parts });
    console.log('4/7 multipart upload completed');
  } catch (err) {
    await abortMultipartUpload({ key, uploadId });
    throw err;
  }
  try {
    const head = await headObject(key);
    if (head?.size !== size) throw new Error(`stored size ${head?.size} != ${size}`);
    if (detectVideoContainer(await readObjectStart(key)) !== 'mp4') throw new Error('signature read-back failed');
    console.log('5/7 size and file signature verified from storage');
    const { url } = await signedPlaybackUrl(key, { contentType: 'video/mp4' });
    const ranged = await fetch(url, { headers: { Range: 'bytes=100-199' } });
    const body = Buffer.from(await ranged.arrayBuffer());
    if (ranged.status !== 206 || body.length !== 100 || !body.equals(file.subarray(100, 200))) {
      throw new Error(`range playback check failed: HTTP ${ranged.status}, ${body.length} bytes`);
    }
    console.log('6/7 signed playback URL serves HTTP 206 range requests');
  } finally {
    await deleteObject(key);
    console.log('7/7 test object deleted');
  }
  console.log('Self-test passed.');
}

async function main() {
  if (process.argv.includes('--check')) return check();
  const origins = arg('--configure');
  if (origins !== null) return configure(origins);
  if (process.argv.includes('--self-test')) return selfTest();
  console.log('Usage: --check | --configure <origins> | --self-test');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  });
