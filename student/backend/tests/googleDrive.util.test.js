import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGoogleDriveUrl, isValidGoogleDriveFileId, googleDriveEmbedUrl, googleDriveViewUrl } from '../src/utils/googleDrive.js';
import { classifyVideoFile, detectVideoContainer, containerMatches } from '../src/utils/videoFile.js';
import { fakeVideoBytes } from './helpers/fakeS3.js';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

test('every Google Drive file-link form yields the file id', () => {
  const forms = [
    `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
    `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
    `https://drive.google.com/file/d/${ID}/preview`,
    `https://drive.google.com/file/d/${ID}`,
    `https://drive.google.com/file/d/${ID}/edit`,
    `https://drive.google.com/file/u/0/d/${ID}/view`,
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?id=${ID}&export=download`,
    `https://docs.google.com/file/d/${ID}/edit`,
    `drive.google.com/file/d/${ID}/view`,
    `  https://www.drive.google.com/file/d/${ID}/view  `,
  ];
  for (const url of forms) {
    const parsed = parseGoogleDriveUrl(url);
    assert.equal(parsed.ok, true, url);
    assert.equal(parsed.fileId, ID, url);
    assert.equal(parsed.embedUrl, `https://drive.google.com/file/d/${ID}/preview`);
    assert.equal(parsed.canonicalUrl, `https://drive.google.com/file/d/${ID}/view`);
  }
});

test("a pre-2021 share link keeps its resource key, and only a well-formed one", () => {
  const parsed = parseGoogleDriveUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing&resourcekey=0-AbC_d-123`);
  assert.equal(parsed.resourceKey, '0-AbC_d-123');
  assert.equal(parsed.embedUrl, `https://drive.google.com/file/d/${ID}/preview?resourcekey=0-AbC_d-123`);
  const injected = parseGoogleDriveUrl(`https://drive.google.com/file/d/${ID}/view?resourcekey=x"><script>`);
  assert.equal(injected.ok, true);
  assert.equal(injected.resourceKey, null);
  assert.equal(injected.embedUrl, `https://drive.google.com/file/d/${ID}/preview`);
});

test('anything that is not a Drive video file is refused with a reason', () => {
  const cases = [
    ['', 'EMPTY_URL'],
    ['   ', 'EMPTY_URL'],
    [null, 'EMPTY_URL'],
    ['not a url', 'INVALID_URL'],
    [`https://drive.google.com.evil.example/file/d/${ID}/view`, 'UNSUPPORTED_PROVIDER'],
    [`https://evil.example/drive.google.com/file/d/${ID}/view`, 'UNSUPPORTED_PROVIDER'],
    [`https://user:pw@drive.google.com/file/d/${ID}/view`, 'UNSUPPORTED_PROVIDER'],
    [`https://drive.google.com:8443/file/d/${ID}/view`, 'UNSUPPORTED_PROVIDER'],
    [`javascript:alert(1)//drive.google.com/file/d/${ID}`, 'UNSUPPORTED_PROVIDER'],
    [`ftp://drive.google.com/file/d/${ID}/view`, 'UNSUPPORTED_PROVIDER'],
    ['https://youtu.be/dQw4w9WgXcQ', 'UNSUPPORTED_PROVIDER'],
    ['https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWx', 'DRIVE_FOLDER'],
    [`https://docs.google.com/document/d/${ID}/edit`, 'NOT_A_DRIVE_FILE'],
    [`https://docs.google.com/spreadsheets/d/${ID}/edit`, 'NOT_A_DRIVE_FILE'],
    ['https://drive.google.com/file/d/short/view', 'INVALID_DRIVE_FILE_ID'],
    [`https://drive.google.com/file/d/${ID}<x>/view`, 'INVALID_DRIVE_FILE_ID'],
    ['https://drive.google.com/open?id=', 'INVALID_DRIVE_FILE_ID'],
    ['https://drive.google.com/', 'INVALID_DRIVE_FILE_ID'],
    [`https://drive.google.com/file/d/${ID}/view?${'a'.repeat(2100)}`, 'URL_TOO_LONG'],
  ];
  for (const [url, code] of cases) {
    const parsed = parseGoogleDriveUrl(url);
    assert.equal(parsed.ok, false, String(url).slice(0, 80));
    assert.equal(parsed.code, code, String(url).slice(0, 80));
    assert.ok(parsed.message);
  }
});

test('embed and view URLs are only ever built from a valid id', () => {
  assert.equal(isValidGoogleDriveFileId(ID), true);
  assert.equal(isValidGoogleDriveFileId('../../etc'), false);
  assert.throws(() => googleDriveEmbedUrl('"><script>'));
  assert.throws(() => googleDriveViewUrl(''));
});

test('an uploaded file name and declared type are classified by extension', () => {
  assert.deepEqual(classifyVideoFile({ fileName: 'Lecture 1.MP4', mimeType: 'video/mp4' }), {
    ok: true,
    fileName: 'Lecture 1.MP4',
    extension: '.mp4',
    family: 'mp4',
    mimeType: 'video/mp4',
  });
  assert.equal(classifyVideoFile({ fileName: 'clip.mov', mimeType: 'video/quicktime' }).mimeType, 'video/quicktime');
  assert.equal(classifyVideoFile({ fileName: 'talk.webm', mimeType: 'video/webm' }).family, 'webm');
  // Browsers often send no type (or a generic one) for MKV.
  assert.equal(classifyVideoFile({ fileName: 'class.mkv', mimeType: '' }).mimeType, 'video/x-matroska');
  assert.equal(classifyVideoFile({ fileName: 'class.mkv', mimeType: 'application/octet-stream' }).ok, true);
  // Paths and control characters never survive into the stored name.
  assert.equal(classifyVideoFile({ fileName: 'C:\\Users\\me\\Videos\\a\u0007b.mp4', mimeType: 'video/mp4' }).fileName, 'ab.mp4');
  assert.equal(classifyVideoFile({ fileName: '../../x.mp4', mimeType: 'video/mp4' }).fileName, 'x.mp4');

  assert.equal(classifyVideoFile({ fileName: 'a.avi', mimeType: 'video/x-msvideo' }).code, 'UNSUPPORTED_VIDEO_TYPE');
  assert.equal(classifyVideoFile({ fileName: 'mp4', mimeType: 'video/mp4' }).code, 'UNSUPPORTED_VIDEO_TYPE');
  assert.equal(classifyVideoFile({ fileName: 'a.mp4', mimeType: 'image/jpeg' }).code, 'VIDEO_TYPE_MISMATCH');
  assert.equal(classifyVideoFile({ fileName: 'a.webm', mimeType: 'video/mp4' }).code, 'VIDEO_TYPE_MISMATCH');
});

test('the stored bytes decide whether a file is a video', () => {
  assert.equal(detectVideoContainer(fakeVideoBytes(64, 'mp4')), 'mp4');
  assert.equal(detectVideoContainer(fakeVideoBytes(64, 'webm')), 'webm');
  const mkv = fakeVideoBytes(64, 'webm');
  Buffer.from([0x88]).copy(mkv, 11);
  Buffer.from('matroska', 'latin1').copy(mkv, 12);
  assert.equal(detectVideoContainer(mkv), 'matroska');
  const oldQuicktime = Buffer.alloc(64);
  Buffer.from('moov', 'latin1').copy(oldQuicktime, 4);
  assert.equal(detectVideoContainer(oldQuicktime), 'mp4');

  assert.equal(detectVideoContainer(fakeVideoBytes(64, 'pdf')), null);
  assert.equal(detectVideoContainer(fakeVideoBytes(64, 'heic')), null, 'a HEIC photo uses ftyp too, and is refused');
  const m4a = fakeVideoBytes(64, 'mp4');
  Buffer.from('M4A ', 'latin1').copy(m4a, 8);
  assert.equal(detectVideoContainer(m4a), null, 'an audio-only MPEG-4 file is refused');
  assert.equal(detectVideoContainer(Buffer.from('short')), null);
  assert.equal(detectVideoContainer(null), null);

  assert.equal(containerMatches('mp4', 'mp4'), true);
  assert.equal(containerMatches('mp4', 'webm'), false);
  assert.equal(containerMatches('webm', 'matroska'), false);
  assert.equal(containerMatches('matroska', 'webm'), true);
  assert.equal(containerMatches('matroska', null), false);
});

/*
 * The editors parse Drive links with their own copy of this module, so the
 * preview they show matches what the student service accepts on save. Skipped
 * when the portal folders are not alongside this one.
 */
test('frontend copies of the Drive parser are identical to this one', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = path.resolve(here, '../src/utils/googleDrive.js');
  const original = await readFile(source, 'utf8');
  for (const portal of ['student', 'admin', 'teacher']) {
    const copy = path.resolve(here, `../../../${portal}/frontend/src/utils/googleDrive.js`);
    try {
      await access(copy);
    } catch {
      continue;
    }
    const text = await readFile(copy, 'utf8');
    assert.equal(text.replace(/\r\n/g, '\n'), original.replace(/\r\n/g, '\n'), `${copy} has drifted from ${source}`);
  }
});
