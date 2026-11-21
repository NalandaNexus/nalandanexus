import http from 'node:http';
import crypto from 'node:crypto';

/**
 * A small S3-compatible server for tests: the subset of the S3 REST API the
 * video service uses (multipart upload, list parts, complete, abort, head,
 * ranged get, delete, bucket CORS/lifecycle), path-style, in memory.
 *
 * It is driven by the real AWS SDK and by plain fetch() PUTs to presigned
 * URLs, exactly as a browser would upload, so the tests exercise the same
 * wire protocol R2 and S3 speak. It checks that every request is signed
 * (an Authorization header or a presigned X-Amz-Signature) and that a
 * presigned URL has not expired; it does not recompute signatures - that is
 * the SDK's job, and the self-test script checks it against a real bucket.
 */
export async function startFakeS3({ bucket = 'videos' } = {}) {
  const objects = new Map(); // key -> { body, contentType }
  const uploads = new Map(); // uploadId -> { key, contentType, parts: Map<n, { body, etag }> }
  const requests = [];
  let failPuts = 0;

  const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
  const xml = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/xml' });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`);
  };
  const error = (res, status, code, message = code) => xml(res, status, `<Error><Code>${code}</Code><Message>${message}</Message></Error>`);

  function signed(req, url) {
    if (req.headers.authorization?.startsWith('AWS4-HMAC-SHA256')) return true;
    const sig = url.searchParams.get('X-Amz-Signature');
    const date = url.searchParams.get('X-Amz-Date');
    const expires = Number(url.searchParams.get('X-Amz-Expires'));
    if (!sig || !date || !expires) return false;
    const issued = Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), +date.slice(9, 11), +date.slice(11, 13), +date.slice(13, 15));
    return Date.now() <= issued + expires * 1000;
  }

  const server = http.createServer((req, res) => {
    // Browsers upload parts cross-origin (the --keep browser check): answer
    // CORS like a bucket configured by scripts/videoStorageSetup.js.
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Length, Content-Range, Accept-Ranges');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, HEAD, PUT',
        'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url, 'http://fake-s3');
      requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams) });
      if (!signed(req, url)) return error(res, 403, 'AccessDenied', 'Request is not signed or the signature expired');

      const [, bucketName, ...rest] = url.pathname.split('/');
      if (bucketName !== bucket) return error(res, 404, 'NoSuchBucket');
      const key = rest.map(decodeURIComponent).join('/');
      const q = url.searchParams;

      // Bucket-level configuration.
      if (!key) {
        if (q.has('cors') || q.has('lifecycle')) {
          res.writeHead(200);
          return res.end();
        }
        return error(res, 400, 'InvalidRequest');
      }

      if (req.method === 'POST' && q.has('uploads')) {
        const uploadId = crypto.randomUUID();
        uploads.set(uploadId, { key, contentType: req.headers['content-type'] || 'application/octet-stream', parts: new Map() });
        return xml(res, 200, `<InitiateMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${key}</Key><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`);
      }

      if (q.has('uploadId')) {
        const upload = uploads.get(q.get('uploadId'));
        if (!upload || upload.key !== key) return error(res, 404, 'NoSuchUpload');

        if (req.method === 'PUT') {
          if (failPuts > 0) {
            failPuts -= 1;
            return error(res, 500, 'InternalError');
          }
          const n = Number(q.get('partNumber'));
          const etag = `"${md5(body)}"`;
          upload.parts.set(n, { body, etag });
          res.writeHead(200, { ETag: etag });
          return res.end();
        }
        if (req.method === 'GET') {
          const parts = [...upload.parts.entries()]
            .sort(([a], [b]) => a - b)
            .map(([n, p]) => `<Part><PartNumber>${n}</PartNumber><ETag>${p.etag.replace(/"/g, '&quot;')}</ETag><Size>${p.body.length}</Size></Part>`)
            .join('');
          return xml(res, 200, `<ListPartsResult><Bucket>${bucket}</Bucket><Key>${key}</Key><UploadId>${q.get('uploadId')}</UploadId><IsTruncated>false</IsTruncated>${parts}</ListPartsResult>`);
        }
        if (req.method === 'POST') {
          const listed = [...body.toString('utf8').matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map((m) => ({
            partNumber: Number(m[1].match(/<PartNumber>(\d+)<\/PartNumber>/)?.[1]),
            etag: (m[1].match(/<ETag>([^<]*)<\/ETag>/)?.[1] || '').replace(/&quot;/g, '"'),
          }));
          if (!listed.length) return error(res, 400, 'MalformedXML');
          const buffers = [];
          for (const p of listed) {
            const stored = upload.parts.get(p.partNumber);
            if (!stored || stored.etag !== p.etag) return error(res, 400, 'InvalidPart');
            buffers.push(stored.body);
          }
          objects.set(key, { body: Buffer.concat(buffers), contentType: upload.contentType });
          uploads.delete(q.get('uploadId'));
          return xml(res, 200, `<CompleteMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${key}</Key><ETag>"${md5(objects.get(key).body)}-${listed.length}"</ETag></CompleteMultipartUploadResult>`);
        }
        if (req.method === 'DELETE') {
          uploads.delete(q.get('uploadId'));
          res.writeHead(204);
          return res.end();
        }
      }

      const object = objects.get(key);
      if (req.method === 'HEAD') {
        if (!object) {
          res.writeHead(404);
          return res.end();
        }
        res.writeHead(200, { 'Content-Length': object.body.length, 'Content-Type': object.contentType, ETag: `"${md5(object.body)}"`, 'Accept-Ranges': 'bytes' });
        return res.end();
      }
      if (req.method === 'GET') {
        if (!object) return error(res, 404, 'NoSuchKey');
        const contentType = q.get('response-content-type') || object.contentType;
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
        if (range) {
          const start = Number(range[1]);
          const end = Math.min(range[2] ? Number(range[2]) : object.body.length - 1, object.body.length - 1);
          const slice = object.body.subarray(start, end + 1);
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Length': slice.length,
            'Content-Range': `bytes ${start}-${end}/${object.body.length}`,
            'Accept-Ranges': 'bytes',
          });
          return res.end(slice);
        }
        res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': object.body.length, 'Accept-Ranges': 'bytes' });
        return res.end(object.body);
      }
      if (req.method === 'DELETE') {
        objects.delete(key);
        res.writeHead(204);
        return res.end();
      }
      return error(res, 405, 'MethodNotAllowed');
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    endpoint: `http://127.0.0.1:${port}`,
    bucket,
    objects,
    uploads,
    requests,
    /** Makes the next `n` part PUTs answer 500, to exercise retries. */
    failNextPartUploads(n) {
      failPuts = n;
    },
    /** Lets a test upload bytes the way a browser does: one PUT per presigned URL. */
    async putPart(url, body) {
      const res = await fetch(url, { method: 'PUT', body });
      if (!res.ok) throw new Error(`part PUT failed: ${res.status}`);
      return res.headers.get('etag');
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Bytes that pass (or fail) the video signature check, of any length. */
export function fakeVideoBytes(size, kind = 'mp4') {
  const bytes = crypto.randomBytes(size);
  if (kind === 'mp4') {
    Buffer.from([0, 0, 0, 0x18]).copy(bytes, 0);
    Buffer.from('ftypisom', 'latin1').copy(bytes, 4);
  } else if (kind === 'webm') {
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]).copy(bytes, 0);
    Buffer.from('webm', 'latin1').copy(bytes, 12);
  } else if (kind === 'pdf') {
    Buffer.from('%PDF-1.7\n%', 'latin1').copy(bytes, 0);
  } else if (kind === 'heic') {
    Buffer.from([0, 0, 0, 0x18]).copy(bytes, 0);
    Buffer.from('ftypheic', 'latin1').copy(bytes, 4);
  }
  return bytes;
}
