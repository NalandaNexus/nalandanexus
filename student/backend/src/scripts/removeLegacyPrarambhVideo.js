import { connectDB } from '../config/db.js';
import { Course } from '../models/Course.js';
import { logger } from '../utils/logger.js';

/**
 * One-time, non-destructive data migration for the old fixed PRARAMBH asset.
 * It clears only the exact obsolete path, never any teacher-managed video,
 * lesson progress, course structure, assignment, or quiz data.
 */
async function run() {
  await connectDB();
  const result = await Course.updateOne(
    { slug: 'prarambh' },
    { $set: { videoUrl: '', 'modules.$[].lessons.$[legacy].videoUrl': '' } },
    { arrayFilters: [{ 'legacy.videoUrl': '/PRARAMBH.mp4' }] }
  );
  logger.info(`[migration] retired fixed PRARAMBH video (${result.modifiedCount ? 'updated' : 'already clean'})`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
