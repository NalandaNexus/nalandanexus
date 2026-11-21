import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { Course } from '../models/Course.js';
import { LiveClass } from '../models/LiveClass.js';

/**
 * Clears every database reference to PRARAMBH's retired fixed video
 * (/PRARAMBH.mp4): the course trailer, each lesson's `videoUrl`, and the
 * seeded "Orientation Session" recording.
 *
 * The application already ignores these values (lessonVideo.service.js
 * #legacyVideoUrlFor), so running this changes nothing students see; it only
 * removes dead data. It touches exactly those string fields - never a managed
 * module/lesson video, course structure, lesson text, progress, XP, quizzes,
 * tasks or enrollments - and never GARUD or YODDHA.
 *
 *   node src/scripts/removeLegacyPrarambhVideo.js           # dry run: reports only
 *   node src/scripts/removeLegacyPrarambhVideo.js --apply   # writes
 *
 * Production writes need explicit approval; run the dry run first and keep
 * its output with the release notes.
 */
const RETIRED = /(^|\/)prarambh\.mp4(?:[?#].*)?$/i;
const apply = process.argv.includes('--apply');

async function run() {
  await connectDB();
  const course = await Course.findOne({ slug: 'prarambh' }).select('_id slug videoUrl modules.moduleId modules.lessons.lessonId modules.lessons.videoUrl').lean();
  const lessons = [];
  for (const m of course?.modules || []) {
    for (const l of m.lessons || []) if (RETIRED.test(l.videoUrl || '')) lessons.push(`${m.moduleId}/${l.lessonId}`);
  }
  const trailer = RETIRED.test(course?.videoUrl || '');
  const recordings = await LiveClass.find({ recordingUrl: { $regex: RETIRED } }).select('_id title').lean();

  console.log(`[migration] database: ${mongoose.connection.name}`);
  console.log(`[migration] PRARAMBH course found: ${Boolean(course)}`);
  console.log(`[migration] course trailer to clear: ${trailer ? 'yes' : 'no'}`);
  console.log(`[migration] lesson videoUrl values to clear: ${lessons.length}${lessons.length ? ` (${lessons.join(', ')})` : ''}`);
  console.log(`[migration] live-class recordings to clear: ${recordings.length}${recordings.length ? ` (${recordings.map((r) => r.title).join('; ')})` : ''}`);

  if (!apply) {
    console.log('[migration] dry run - nothing was written. Re-run with --apply to clear these values.');
    return;
  }

  if (course && (trailer || lessons.length)) {
    const $set = {};
    if (trailer) $set.videoUrl = '';
    if (lessons.length) $set['modules.$[].lessons.$[legacy].videoUrl'] = '';
    const res = await Course.updateOne(
      { _id: course._id },
      { $set },
      lessons.length ? { arrayFilters: [{ 'legacy.videoUrl': { $regex: RETIRED } }] } : {}
    );
    console.log(`[migration] course updated: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }
  if (recordings.length) {
    const res = await LiveClass.updateMany({ _id: { $in: recordings.map((r) => r._id) } }, { $set: { recordingUrl: null } });
    console.log(`[migration] live classes updated: ${res.modifiedCount}`);
  }
  console.log('[migration] done.');
}

run()
  .then(() => disconnectDB())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('[migration] failed:', err.message);
    await disconnectDB().catch(() => {});
    process.exit(1);
  });
