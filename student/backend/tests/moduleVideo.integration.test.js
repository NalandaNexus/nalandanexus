import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';
import { startFakeS3, fakeVideoBytes } from './helpers/fakeS3.js';

/**
 * Module videos from every source, end to end inside the student service:
 * the service-key bridge the Admin and Teacher portals write through, a
 * real S3-compatible multipart upload driven through presigned URLs exactly
 * as a browser does it, and the enrolled student's view of the result.
 *
 * What matters most here is what a careless implementation gets wrong
 * silently: a file showing to students before it is verified, a renamed
 * non-video slipping through, a replacement deleting the old file while a
 * student may still be watching it, a failed replacement losing the video
 * that worked, and one teacher touching another's upload.
 */

const KEY = { 'X-Internal-Service-Key': 'test_internal_key' };
const ADMIN = { portal: 'admin', userId: 'admin-1', name: 'Asha Admin' };
const TEACHER_A = { portal: 'teacher', userId: 'teacher-a', name: 'Tara Teacher' };
const TEACHER_B = { portal: 'teacher', userId: 'teacher-b', name: 'Bala Teacher' };
const MiB = 1024 * 1024;
const DRIVE_PUBLIC = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const DRIVE_PRIVATE = '1PrivatePrivatePrivatePrivate0001';
const DRIVE_GONE = '1GoneGoneGoneGoneGoneGoneGone00001';

let ctx;
let request;
let s3;
let env;
let storage;
let lessonVideo;
let broadcasts;
let M;
let student;
let prarambh;

const studentContent = async (slug = 'prarambh') => {
  const res = await request.get(`/api/student/courses/${slug}/content`).set(bearer(student.accessToken));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
};
const moduleOf = (content, moduleId) => content.modules.find((m) => m.moduleId === moduleId);
const editorView = async (slug = 'prarambh') => (await request.get(`/api/internal/lesson-videos/courses/${slug}`).set(KEY)).body.data;
const editorModule = async (moduleId) => (await editorView()).modules.find((m) => m.moduleId === moduleId);

const startUpload = (moduleId, body) =>
  request.post(`/api/internal/lesson-videos/courses/prarambh/modules/${moduleId}/uploads`).set(KEY).send({ actor: ADMIN, ...body });
const uploadCall = (slug, uploadId, action, body = {}) =>
  request.post(`/api/internal/lesson-videos/courses/${slug}/uploads/${uploadId}/${action}`).set(KEY).send(body);

/** Uploads `bytes` the way the portals' browser uploader does; `skip` leaves parts out. */
async function sendParts(session, bytes, actor = ADMIN, { skip = [] } = {}) {
  const numbers = Array.from({ length: session.totalParts }, (_, i) => i + 1).filter((n) => !skip.includes(n));
  if (!numbers.length) return;
  const urls = await uploadCall('prarambh', session.uploadId, 'parts', { actor, partNumbers: numbers });
  assert.equal(urls.status, 200, JSON.stringify(urls.body));
  for (const part of urls.body.data.parts) {
    const start = (part.partNumber - 1) * session.partSize;
    await s3.putPart(part.url, bytes.subarray(start, Math.min(bytes.length, start + session.partSize)));
  }
}

/** A complete, verified upload attached to `moduleId`. */
async function uploadVideo(moduleId, bytes, { actor = ADMIN, fileName = 'lecture.mp4', mimeType = 'video/mp4', ...rest } = {}) {
  const started = await startUpload(moduleId, { actor, fileName, fileSize: bytes.length, mimeType, ...rest });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const session = started.body.data;
  await sendParts(session, bytes, actor);
  const done = await uploadCall('prarambh', session.uploadId, 'complete', { actor, duration: 754.5 });
  return { session, done };
}

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;
  s3 = await startFakeS3();
  ({ env } = await import('../src/config/env.js'));
  storage = await import('../src/services/videoObjectStorage.service.js');
  lessonVideo = await import('../src/services/lessonVideo.service.js');
  const broadcast = await import('../src/services/videoChangeBroadcast.service.js');
  broadcast.setVideoBroadcastHookForTests((payload, opts) => broadcasts.push({ ...payload, students: opts.students }));
  M = {
    Course: (await import('../src/models/Course.js')).Course,
    Enrollment: (await import('../src/models/Enrollment.js')).Enrollment,
    VideoUpload: (await import('../src/models/VideoUpload.js')).VideoUpload,
    CourseVideoEvent: (await import('../src/models/CourseVideoEvent.js')).CourseVideoEvent,
    LessonProgress: (await import('../src/models/LessonProgress.js')).LessonProgress,
    XPEvent: (await import('../src/models/XPEvent.js')).XPEvent,
  };

  Object.assign(env.videoStorage, {
    endpoint: s3.endpoint,
    region: 'auto',
    bucket: s3.bucket,
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    forcePathStyle: true,
    maxUploadBytes: 20 * 1024 * MiB,
  });
  storage.resetVideoStorageClient();

  // Production's PRARAMBH rows still name the retired fixed file.
  prarambh = await M.Course.create({
    slug: 'prarambh',
    title: 'PRARAMBH',
    priceInPaise: 0,
    isPublished: true,
    pillar: 'communicate',
    videoUrl: '/PRARAMBH.mp4',
    modules: [1, 2, 3, 4, 5, 6].map((n) => ({
      moduleId: `mod-${n}`,
      title: `Module ${n}`,
      order: n,
      lessons: [{ lessonId: `l-${n}`, title: `Lesson ${n}.1`, order: 1, videoUrl: '/PRARAMBH.mp4', content: `Read ${n}` }],
    })),
  });
  await M.Course.create({
    slug: 'garud',
    title: 'GARUD',
    priceInPaise: 0,
    isPublished: true,
    modules: [{ moduleId: 'g-1', title: 'Garud one', order: 1, lessons: [{ lessonId: 'g-l-1', title: 'Text first', order: 1, content: 'Words', videoUrl: '/garud-trailer.mp4' }] }],
  });

  student = await registerAndLogin(request, { name: 'Module Student', email: `module.${Date.now()}@example.com`, completeProfile: true });
  const userId = student.user.id || student.user._id;
  await M.Enrollment.create({ userId, courseId: prarambh._id, status: 'active', enrollmentId: 'ENR-2026-990101' });
  const garud = await M.Course.findOne({ slug: 'garud' });
  await M.Enrollment.create({ userId, courseId: garud._id, status: 'active', enrollmentId: 'ENR-2026-990102' });
});

after(async () => {
  lessonVideo.setDriveFetcherForTests(null);
  (await import('../src/services/videoChangeBroadcast.service.js')).setVideoBroadcastHookForTests(null);
  await s3.close();
  await ctx.teardown();
});

beforeEach(() => {
  broadcasts = [];
  // Google Drive as observed live: public = 200 with og:title, private =
  // redirect to sign-in, missing = 404.
  lessonVideo.setDriveFetcherForTests(async (fileId) => {
    if (fileId === DRIVE_PUBLIC) return { status: 200, location: '', text: '<meta property="og:title" content="Week 3 &amp; recap.mp4">' };
    if (fileId === DRIVE_PRIVATE) return { status: 302, location: 'https://accounts.google.com/ServiceLogin?continue=x', text: '' };
    return { status: 404, location: '', text: '' };
  });
});

// --- The retired fixed video ------------------------------------------------------------------

test('the fixed PRARAMBH video is gone from what students see, while its rows and other courses are untouched', async () => {
  const content = await studentContent();
  assert.equal(content.videoUrl, '', 'no course-wide fallback video');
  for (const m of content.modules) {
    assert.equal(m.video, null, `${m.moduleId} starts with no video`);
    for (const l of m.lessons) {
      assert.equal(l.videoUrl, '');
      assert.equal(l.video, null);
    }
  }
  assert.ok(!JSON.stringify(content).includes('PRARAMBH.mp4'));
  // Lesson text, order and the stored rows are exactly as they were.
  assert.equal(content.modules[0].lessons[0].content, 'Read 1');
  const stored = await M.Course.findOne({ slug: 'prarambh' }).lean();
  assert.equal(stored.modules[0].lessons[0].videoUrl, '/PRARAMBH.mp4', 'reading never writes');

  const editor = await editorView();
  assert.ok(editor.modules.every((m) => m.lessons.every((l) => l.legacyVideoUrl === '')), 'editors are not told a retired file is playing');

  // GARUD keeps its own legacy file - only PRARAMBH's fixed video was retired.
  const garud = await studentContent('garud');
  assert.equal(garud.modules[0].lessons[0].videoUrl, '/garud-trailer.mp4');

  // The public syllabus does not leak it either.
  const pub = await request.get('/api/public/courses/prarambh').set(bearer(student.accessToken));
  if (pub.status === 200) assert.ok(!JSON.stringify(pub.body).includes('PRARAMBH.mp4'));
});

// --- Starting an upload ------------------------------------------------------------------------

test('an upload is refused before it starts for the wrong type, a mismatched type, an oversize file or no actor', async () => {
  const bad = [
    [{ fileName: 'clip.avi', fileSize: 1000, mimeType: 'video/x-msvideo' }, 422, 'UNSUPPORTED_VIDEO_TYPE'],
    [{ fileName: 'notes.pdf', fileSize: 1000, mimeType: 'application/pdf' }, 422, 'UNSUPPORTED_VIDEO_TYPE'],
    [{ fileName: 'photo.mp4', fileSize: 1000, mimeType: 'image/png' }, 422, 'VIDEO_TYPE_MISMATCH'],
    [{ fileName: 'huge.mp4', fileSize: 21 * 1024 * 1024 * MiB, mimeType: 'video/mp4' }, 422, 'VIDEO_TOO_LARGE'],
  ];
  for (const [body, status, code] of bad) {
    const res = await startUpload('mod-1', body);
    assert.equal(res.status, status, `${body.fileName}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.error.code, code);
  }
  const noActor = await request
    .post('/api/internal/lesson-videos/courses/prarambh/modules/mod-1/uploads')
    .set(KEY)
    .send({ fileName: 'a.mp4', fileSize: 1000, mimeType: 'video/mp4' });
  assert.equal(noActor.status, 403);
  const unknownModule = await startUpload('mod-99', { fileName: 'a.mp4', fileSize: 1000, mimeType: 'video/mp4' });
  assert.equal(unknownModule.status, 404);
  const noKey = await request.post('/api/internal/lesson-videos/courses/prarambh/modules/mod-1/uploads').send({ actor: ADMIN, fileName: 'a.mp4', fileSize: 1000 });
  assert.equal(noKey.status, 401);
  assert.equal(await M.VideoUpload.countDocuments(), 0, 'nothing was opened');
  assert.equal(s3.uploads.size, 0);
});

test('without configured storage, uploads answer 503 while links keep working', async () => {
  const saved = env.videoStorage.endpoint;
  env.videoStorage.endpoint = '';
  storage.resetVideoStorageClient();
  try {
    const res = await startUpload('mod-6', { fileName: 'a.mp4', fileSize: 1000, mimeType: 'video/mp4' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'VIDEO_STORAGE_NOT_CONFIGURED');
    assert.equal((await editorView()).uploadsEnabled, false);
  } finally {
    env.videoStorage.endpoint = saved;
    storage.resetVideoStorageClient();
  }
});

// --- The large-file multipart workflow -------------------------------------------------------------

test('a multi-part upload resumes after an interruption, stays hidden until verified, then streams with range requests', async () => {
  const bytes = fakeVideoBytes(2 * 10 * MiB + 54_321, 'mp4');
  const started = await startUpload('mod-1', { fileName: 'Module 1 lecture.MP4', fileSize: bytes.length, mimeType: 'video/mp4', title: 'Welcome to PRARAMBH' });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const session = started.body.data;
  assert.equal(session.totalParts, 3);
  assert.equal(session.partSize, 10 * MiB);
  assert.equal(session.status, 'uploading');
  assert.ok(!('url' in session) && !JSON.stringify(session).includes('test-secret-key'), 'no URL or credential in the session');

  // Parts 1 and 2 arrive, then the connection drops.
  await sendParts(session, bytes, ADMIN, { skip: [3] });
  assert.equal(moduleOf(await studentContent(), 'mod-1').video, null, 'nothing reaches students while uploading');
  const inProgress = (await editorModule('mod-1')).activeUpload;
  assert.equal(inProgress.status, 'uploading');
  assert.equal(inProgress.actor.name, 'Asha Admin');

  // Completing too early is not a failure: it names what is missing.
  const early = await uploadCall('prarambh', session.uploadId, 'complete', { actor: ADMIN });
  assert.equal(early.status, 422);
  assert.equal(early.body.error.code, 'UPLOAD_INCOMPLETE');
  assert.deepEqual(early.body.error.details.missingParts, [3]);

  // Resuming asks storage what it already holds and sends only the rest.
  const resumed = await uploadCall('prarambh', session.uploadId, 'resume', { actor: ADMIN });
  assert.equal(resumed.status, 200);
  assert.deepEqual(resumed.body.data.uploadedParts.map((p) => p.partNumber), [1, 2]);
  await sendParts(session, bytes, ADMIN, { skip: [1, 2] });

  const done = await uploadCall('prarambh', session.uploadId, 'complete', { actor: ADMIN, duration: 754.5 });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const video = done.body.data.video;
  assert.equal(video.provider, 'upload');
  assert.equal(video.fileName, 'Module 1 lecture.MP4');
  assert.equal(video.fileSize, bytes.length);
  assert.equal(video.duration, 754.5);
  assert.equal(video.mimeType, 'video/mp4');
  assert.equal(video.uploadStatus, 'completed');
  assert.equal(video.processingStatus, 'verified');
  assert.equal(video.isPublished, true);
  assert.equal(video.updatedBy.name, 'Asha Admin');
  assert.ok(video.uploadedAt);
  assert.ok(!('storageKey' in video), 'editors are not given the storage key');

  // Students now get a signed URL that serves byte ranges.
  const mod = moduleOf(await studentContent(), 'mod-1');
  assert.equal(mod.video.provider, 'upload');
  assert.equal(mod.video.title, 'Welcome to PRARAMBH');
  assert.ok(!('storageKey' in mod.video));
  assert.match(mod.video.streamUrl, /X-Amz-Signature=/);
  const ranged = await fetch(mod.video.streamUrl, { headers: { Range: 'bytes=1000-1999' } });
  assert.equal(ranged.status, 206);
  assert.ok(Buffer.from(await ranged.arrayBuffer()).equals(bytes.subarray(1000, 2000)));

  // Exactly one stored object; the session is finished.
  assert.equal(s3.objects.size, 1);
  assert.equal(s3.uploads.size, 0);
  assert.equal((await M.VideoUpload.findById(session.uploadId)).status, 'completed');
  assert.equal((await editorModule('mod-1')).activeUpload, null);

  // Staff heard about the start (students did not); everyone heard about the result.
  assert.deepEqual(
    broadcasts.map((b) => [b.action, b.students]),
    [
      ['upload_started', false],
      ['upload_completed', true],
    ]
  );
  assert.equal(broadcasts[1].moduleId, 'mod-1');
  assert.ok(!JSON.stringify(broadcasts).includes('X-Amz'), 'notices carry no URL');

  // A retried complete (e.g. after a timeout) does not redo the work.
  const again = await uploadCall('prarambh', session.uploadId, 'complete', { actor: ADMIN });
  assert.equal(again.status, 200);
  assert.equal(again.body.data.alreadyCompleted, true);
});

test('a file that is not really a video is refused after upload, cleaned up, and the old video stays', async () => {
  const before = (await editorModule('mod-1')).video;
  for (const [name, kind] of [
    ['slides.mp4', 'pdf'],
    ['holiday.mov', 'heic'],
  ]) {
    const bytes = fakeVideoBytes(64 * 1024, kind);
    const { session, done } = await uploadVideo('mod-1', bytes, { fileName: name, mimeType: name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4' });
    assert.equal(done.status, 422, name);
    assert.equal(done.body.error.code, 'VIDEO_VERIFICATION_FAILED');
    const record = await M.VideoUpload.findById(session.uploadId).lean();
    assert.equal(record.status, 'failed');
    assert.equal(record.failureCode, 'VIDEO_VERIFICATION_FAILED');
    assert.ok(![...s3.objects.keys()].includes(record.objectKey), 'the rejected object was deleted');
  }
  const after = (await editorModule('mod-1')).video;
  assert.equal(after.updatedAt, before.updatedAt, 'the working video was kept');
  assert.equal(moduleOf(await studentContent(), 'mod-1').video.provider, 'upload');

  const problems = await request.get('/api/internal/lesson-videos/events?level=problems&slug=prarambh').set(KEY);
  assert.equal(problems.status, 200);
  const failures = problems.body.data.filter((e) => e.action === 'upload_failed');
  assert.equal(failures.length, 2);
  assert.equal(failures[0].level, 'error');
  assert.equal(failures[0].actor.name, 'Asha Admin');
});

test('a WEBM upload is verified by its EBML header', async () => {
  const bytes = fakeVideoBytes(200 * 1024, 'webm');
  const { done } = await uploadVideo('mod-4', bytes, { fileName: 'talk.webm', mimeType: 'video/webm' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.data.video.mimeType, 'video/webm');
});

// --- Replacement and deletion -----------------------------------------------------------------------

test('replacing an upload keeps the old file until no playback URL for it can be live, then deletes it', async () => {
  const first = await M.Course.findOne({ slug: 'prarambh' }).lean();
  const oldKey = first.modules.find((m) => m.moduleId === 'mod-1').video.storageKey;
  assert.ok(s3.objects.has(oldKey));

  const replacement = fakeVideoBytes(300 * 1024, 'mp4');
  const { done } = await uploadVideo('mod-1', replacement, { fileName: 'take-two.mp4', actor: TEACHER_A });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.data.previousProvider, 'upload');
  assert.equal(moduleOf(await studentContent(), 'mod-1').video.title, 'take-two.mp4');

  const retired = await M.VideoUpload.findOne({ objectKey: oldKey }).lean();
  assert.equal(retired.status, 'retired');
  assert.ok(retired.deleteAfter > new Date(Date.now() + 2 * 60 * 60 * 1000), 'kept past the playback URL lifetime');

  // Too early: nothing is deleted.
  let sweep = await lessonVideo.sweepVideoStorage();
  assert.equal(sweep.deleted, 0);
  assert.ok(s3.objects.has(oldKey), 'a student mid-video keeps playing');

  // Once it is safe, the sweep deletes it and records that.
  sweep = await lessonVideo.sweepVideoStorage({ now: new Date(Date.now() + 3 * 60 * 60 * 1000) });
  assert.equal(sweep.deleted, 1);
  assert.ok(!s3.objects.has(oldKey));
  assert.equal((await M.VideoUpload.findOne({ objectKey: oldKey }).lean()).status, 'deleted');
  assert.equal(await M.CourseVideoEvent.countDocuments({ action: 'object_deleted' }), 1);
});

test('the sweep never deletes a file a module points at again', async () => {
  const current = (await M.Course.findOne({ slug: 'prarambh' }).lean()).modules.find((m) => m.moduleId === 'mod-1').video.storageKey;
  await M.VideoUpload.updateOne({ objectKey: current }, { $set: { status: 'retired', deleteAfter: new Date(0) } });
  const sweep = await lessonVideo.sweepVideoStorage();
  assert.equal(sweep.restored, 1);
  assert.ok(s3.objects.has(current));
  assert.equal((await M.VideoUpload.findOne({ objectKey: current }).lean()).status, 'completed');
});

test('switching an uploaded module to a YouTube link retires the file; removing it clears the module for students', async () => {
  const key = (await M.Course.findOne({ slug: 'prarambh' }).lean()).modules.find((m) => m.moduleId === 'mod-1').video.storageKey;
  const current = await editorModule('mod-1');
  const res = await request
    .put('/api/internal/lesson-videos/courses/prarambh/modules/mod-1')
    .set(KEY)
    .send({ url: 'https://youtu.be/dQw4w9WgXcQ', isPublished: true, actor: TEACHER_A, expectedUpdatedAt: current.video.updatedAt });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.video.provider, 'youtube');
  assert.equal((await M.VideoUpload.findOne({ objectKey: key }).lean()).status, 'retired');
  assert.equal(moduleOf(await studentContent(), 'mod-1').video.videoId, 'dQw4w9WgXcQ');

  const removed = await request
    .delete('/api/internal/lesson-videos/courses/prarambh/modules/mod-1')
    .set(KEY)
    .send({ actor: ADMIN, expectedUpdatedAt: res.body.data.video.updatedAt });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.removed, true);
  assert.equal(moduleOf(await studentContent(), 'mod-1').video, null);
  assert.equal(broadcasts.at(-1).action, 'removed');
  assert.equal(broadcasts.at(-1).students, true);
  const history = await M.CourseVideoEvent.find({ courseSlug: 'prarambh', targetId: 'mod-1', action: 'removed' }).lean();
  assert.equal(history.length, 1);
  assert.equal(history[0].previous.provider, 'youtube');
  assert.equal(history[0].actor.name, 'Asha Admin');
});

test('an upload finished after someone else changed the module is kept aside, not attached, until the uploader decides', async () => {
  // The uploader saw an empty module 5.
  const bytes = fakeVideoBytes(128 * 1024, 'mp4');
  const started = await startUpload('mod-5', { actor: TEACHER_A, fileName: 'mine.mp4', fileSize: bytes.length, mimeType: 'video/mp4', expectedUpdatedAt: null });
  assert.equal(started.status, 201);
  const session = started.body.data;
  await sendParts(session, bytes, TEACHER_A);

  // Meanwhile an administrator attaches a YouTube video to module 5.
  const yt = await request.put('/api/internal/lesson-videos/courses/prarambh/modules/mod-5').set(KEY).send({ url: 'https://youtu.be/M7lc1UVf-VE', isPublished: true, actor: ADMIN });
  assert.equal(yt.status, 200);

  const done = await uploadCall('prarambh', session.uploadId, 'complete', { actor: TEACHER_A });
  assert.equal(done.status, 409);
  assert.equal(done.body.error.code, 'VIDEO_CHANGED');
  assert.equal(done.body.error.details.current.provider, 'youtube');
  assert.equal(done.body.error.details.uploadStatus, 'verified');
  assert.equal(moduleOf(await studentContent(), 'mod-5').video.provider, 'youtube', "the administrator's video stays");
  assert.equal((await editorModule('mod-5')).activeUpload.status, 'verified');

  // The teacher chooses to replace it anyway, naming the version they saw.
  const replace = await uploadCall('prarambh', session.uploadId, 'complete', { actor: TEACHER_A, expectedUpdatedAt: done.body.error.details.current.updatedAt });
  assert.equal(replace.status, 200, JSON.stringify(replace.body));
  assert.equal(moduleOf(await studentContent(), 'mod-5').video.provider, 'upload');
});

test('a teacher manages only their own upload sessions; an administrator may cancel any; the course must match', async () => {
  const bytes = fakeVideoBytes(64 * 1024, 'mp4');
  const started = await startUpload('mod-6', { actor: TEACHER_A, fileName: 'a.mp4', fileSize: bytes.length, mimeType: 'video/mp4' });
  const { uploadId } = started.body.data;

  const otherTeacher = await uploadCall('prarambh', uploadId, 'parts', { actor: TEACHER_B, partNumbers: [1] });
  assert.equal(otherTeacher.status, 403);
  assert.equal(otherTeacher.body.error.code, 'UPLOAD_FORBIDDEN');
  assert.equal((await uploadCall('prarambh', uploadId, 'complete', { actor: TEACHER_B })).status, 403);

  // The same session reached through another course is not found.
  const wrongCourse = await uploadCall('garud', uploadId, 'parts', { actor: TEACHER_A, partNumbers: [1] });
  assert.equal(wrongCourse.status, 404);

  const badParts = await uploadCall('prarambh', uploadId, 'parts', { actor: TEACHER_A, partNumbers: [2] });
  assert.equal(badParts.status, 422, 'part numbers beyond the file are refused');

  const abort = await request.delete(`/api/internal/lesson-videos/courses/prarambh/uploads/${uploadId}`).set(KEY).send({ actor: ADMIN });
  assert.equal(abort.status, 200);
  assert.equal(abort.body.data.status, 'aborted');
  const { objectKey } = await M.VideoUpload.findById(uploadId).lean();
  assert.ok(![...s3.uploads.values()].some((u) => u.key === objectKey), 'the multipart session was aborted at storage');
  const after = await uploadCall('prarambh', uploadId, 'parts', { actor: TEACHER_A, partNumbers: [1] });
  assert.equal(after.status, 409, 'a cancelled session accepts nothing');
});

test('one person can run three uploads at once, not more', async () => {
  const ids = [];
  for (let i = 0; i < 3; i += 1) {
    const res = await startUpload(`mod-${i + 2}`, { actor: TEACHER_B, fileName: `p${i}.mp4`, fileSize: 1000, mimeType: 'video/mp4' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    ids.push(res.body.data.uploadId);
  }
  const fourth = await startUpload('mod-6', { actor: TEACHER_B, fileName: 'p4.mp4', fileSize: 1000, mimeType: 'video/mp4' });
  assert.equal(fourth.status, 409);
  assert.equal(fourth.body.error.code, 'TOO_MANY_ACTIVE_UPLOADS');
  // Someone else is not affected.
  const other = await startUpload('mod-6', { actor: TEACHER_A, fileName: 'x.mp4', fileSize: 1000, mimeType: 'video/mp4' });
  assert.equal(other.status, 201);

  // A session idle for an hour stops counting against the limit...
  await M.VideoUpload.collection.updateMany({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }, { $set: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
  const afterIdle = await startUpload('mod-6', { actor: TEACHER_B, fileName: 'p4.mp4', fileSize: 1000, mimeType: 'video/mp4' });
  assert.equal(afterIdle.status, 201, 'idle sessions no longer block new uploads');
  await request.delete(`/api/internal/lesson-videos/courses/prarambh/uploads/${afterIdle.body.data.uploadId}`).set(KEY).send({ actor: TEACHER_B });

  // ...and after a day it lapses: the sweep aborts it at the provider.
  await M.VideoUpload.updateMany({ _id: { $in: ids } }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const sweep = await lessonVideo.sweepVideoStorage();
  assert.equal(sweep.expired, 3);
  assert.equal(await M.VideoUpload.countDocuments({ _id: { $in: ids }, status: 'expired' }), 3);
  assert.equal(await M.CourseVideoEvent.countDocuments({ action: 'upload_expired' }), 3);
  const fifth = await startUpload('mod-6', { actor: TEACHER_B, fileName: 'p5.mp4', fileSize: 1000, mimeType: 'video/mp4' });
  assert.equal(fifth.status, 201);
});

// --- Google Drive ------------------------------------------------------------------------------------

test('Google Drive: links are validated, checked and played from the file id; unusable ones are explained', async () => {
  const inspect = (url, provider) => request.post('/api/internal/lesson-videos/inspect').set(KEY).send({ url, provider });

  const pub = await inspect(`https://drive.google.com/file/d/${DRIVE_PUBLIC}/view?usp=sharing`, 'google_drive');
  assert.equal(pub.status, 200);
  assert.equal(pub.body.data.provider, 'google_drive');
  assert.equal(pub.body.data.externalVideoId, DRIVE_PUBLIC);
  assert.equal(pub.body.data.availability, 'available');
  assert.equal(pub.body.data.title, 'Week 3 & recap.mp4');
  assert.equal(pub.body.data.embedUrl, `https://drive.google.com/file/d/${DRIVE_PUBLIC}/preview`);

  assert.equal((await inspect(`https://drive.google.com/open?id=${DRIVE_PRIVATE}`, 'google_drive')).body.data.availability, 'restricted');
  assert.equal((await inspect(`https://drive.google.com/file/d/${DRIVE_GONE}/view`, 'google_drive')).body.data.availability, 'unavailable');

  for (const [url, code] of [
    ['https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz0', 'DRIVE_FOLDER'],
    ['https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit', 'NOT_A_DRIVE_FILE'],
    ['https://drive.google.com.evil.example/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view', 'UNSUPPORTED_PROVIDER'],
    ['https://youtu.be/dQw4w9WgXcQ', 'UNSUPPORTED_PROVIDER'],
  ]) {
    const res = await inspect(url, 'google_drive');
    assert.equal(res.status, 422, url);
    assert.equal(res.body.error.code, code, url);
  }

  const save = (moduleId, fileId, isPublished = true) =>
    request
      .put(`/api/internal/lesson-videos/courses/prarambh/modules/${moduleId}`)
      .set(KEY)
      .send({ provider: 'google_drive', url: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`, isPublished, actor: TEACHER_A });

  const gone = await save('mod-3', DRIVE_GONE);
  assert.equal(gone.status, 422);
  assert.equal(gone.body.error.code, 'VIDEO_UNAVAILABLE');

  const ok = await save('mod-3', DRIVE_PUBLIC);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.video.title, 'Week 3 & recap.mp4', 'the Drive file name fills an empty title');
  const mod = moduleOf(await studentContent(), 'mod-3');
  assert.equal(mod.video.provider, 'google_drive');
  assert.equal(mod.video.externalVideoId, DRIVE_PUBLIC);
  assert.equal(mod.video.embedUrl, `https://drive.google.com/file/d/${DRIVE_PUBLIC}/preview`);

  // Not public: still saved and published, flagged so students are told to sign in.
  const restricted = await save('mod-2', DRIVE_PRIVATE);
  assert.equal(restricted.status, 200);
  assert.equal(restricted.body.data.video.availability, 'restricted');
  assert.equal(moduleOf(await studentContent(), 'mod-2').video.availability, 'restricted');
});

test('title and visibility can be changed on any source; an unpublished upload disappears for students at once', async () => {
  const current = await editorModule('mod-5');
  assert.equal(current.video.provider, 'upload');
  const hide = await request
    .patch('/api/internal/lesson-videos/courses/prarambh/modules/mod-5')
    .set(KEY)
    .send({ isPublished: false, title: 'Draft cut', actor: TEACHER_A, expectedUpdatedAt: current.video.updatedAt });
  assert.equal(hide.status, 200, JSON.stringify(hide.body));
  assert.equal(hide.body.data.video.isPublished, false);
  assert.equal(hide.body.data.video.title, 'Draft cut');
  assert.equal(moduleOf(await studentContent(), 'mod-5').video, null);
  assert.equal(broadcasts.at(-1).action, 'unpublished');

  const stale = await request
    .patch('/api/internal/lesson-videos/courses/prarambh/modules/mod-5')
    .set(KEY)
    .send({ isPublished: true, actor: TEACHER_B, expectedUpdatedAt: current.video.updatedAt });
  assert.equal(stale.status, 409, 'a stale editor cannot overwrite');

  const show = await request
    .patch('/api/internal/lesson-videos/courses/prarambh/modules/mod-5')
    .set(KEY)
    .send({ isPublished: true, actor: TEACHER_A, expectedUpdatedAt: hide.body.data.video.updatedAt });
  assert.equal(show.status, 200);
  assert.equal(moduleOf(await studentContent(), 'mod-5').video.title, 'Draft cut');
});

test('every module is configured independently, and video work never touches progress, XP or lesson text', async () => {
  const userId = student.user.id || student.user._id;
  const done = await request.post('/api/student/courses/lessons/l-4/progress').set(bearer(student.accessToken));
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const xpBefore = await M.XPEvent.countDocuments({ userId });
  const progressBefore = await M.LessonProgress.findOne({ userId, lessonId: 'l-4' }).lean();

  const bytes = fakeVideoBytes(96 * 1024, 'mp4');
  assert.equal((await uploadVideo('mod-4', bytes, { fileName: 'm4.mp4', actor: TEACHER_A })).done.status, 200);

  const content = await studentContent();
  const sources = Object.fromEntries(content.modules.map((m) => [m.moduleId, m.video?.provider || null]));
  assert.deepEqual(sources, {
    'mod-1': null,
    'mod-2': 'google_drive',
    'mod-3': 'google_drive',
    'mod-4': 'upload',
    'mod-5': 'upload',
    'mod-6': null,
  });
  const l4 = content.modules.find((m) => m.moduleId === 'mod-4').lessons[0];
  assert.equal(l4.completed, true);
  assert.equal(l4.content, 'Read 4');
  assert.equal(await M.XPEvent.countDocuments({ userId }), xpBefore);
  assert.equal(String((await M.LessonProgress.findOne({ userId, lessonId: 'l-4' }).lean()).completedAt), String(progressBefore.completedAt));

  const catalog = (await request.get('/api/internal/lesson-videos/courses?slugs=prarambh').set(KEY)).body.data[0];
  assert.equal(catalog.moduleCount, 6);
  assert.equal(catalog.moduleVideoCount, 4);
  assert.equal(catalog.modulesWithoutVideo, 2);
});

test('the course content response is never cached, because it carries signed URLs', async () => {
  const res = await request.get('/api/student/courses/prarambh/content').set(bearer(student.accessToken));
  assert.equal(res.headers['cache-control'], 'no-store');
});
