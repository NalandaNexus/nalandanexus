import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Enrollment } from '../models/Enrollment.js';
import { Order } from '../models/Order.js';
import { Note } from '../models/Note.js';
import { Post } from '../models/Post.js';
import { Review } from '../models/Review.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { EmailVerificationToken } from '../models/EmailVerificationToken.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { TaskSubmission } from '../models/TaskSubmission.js';
import { LessonProgress } from '../models/LessonProgress.js';
import { XPEvent } from '../models/XPEvent.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { deleteFilesForOwner } from './fileStorage.service.js';
import { recalculateCourseRating } from './review.service.js';
import { logger } from '../utils/logger.js';

/**
 * Everything keyed to a user by `userId`. Kept as one list so a newly added
 * per-student collection is one line away from being cleaned up too, rather
 * than being silently forgotten until it shows up as orphaned data.
 */
const OWNED_BY_USER = [
  ['studentProfiles', StudentProfile],
  ['enrollments', Enrollment],
  ['orders', Order],
  ['notes', Note],
  ['posts', Post],
  ['reviews', Review],
  ['messages', Message],
  ['notifications', Notification],
  ['refreshTokens', RefreshToken],
  ['passwordResetTokens', PasswordResetToken],
  ['emailVerificationTokens', EmailVerificationToken],
  ['quizAttempts', QuizAttempt],
  ['taskSubmissions', TaskSubmission],
  ['lessonProgress', LessonProgress],
  ['xpEvents', XPEvent],
  ['supportTickets', SupportTicket],
];

/**
 * Deletes a user and every record that belongs to them.
 *
 * Without this, removing a user left their rows behind: their community posts
 * kept referencing a User document that no longer existed, so the public
 * highlights feed silently dropped them while the counter above still counted
 * them - the Landing Page ended up claiming "2 Community Posts" over an empty
 * section. Any course they had reviewed is recalculated afterwards, so their
 * rating stops contributing to an average it no longer belongs in.
 *
 * Returns a per-collection tally of what was removed.
 */
export async function purgeUser(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  // Captured before the reviews are deleted - afterwards there is no record of
  // which courses need their average recomputed.
  const reviewedCourseIds = await Review.distinct('courseId', { userId });

  const removed = {};
  for (const [label, Model] of OWNED_BY_USER) {
    const res = await Model.deleteMany({ userId });
    if (res.deletedCount) removed[label] = res.deletedCount;
  }

  const files = await deleteFilesForOwner(userId);
  if (files) removed.storedFiles = files;

  await User.deleteOne({ _id: userId });
  removed.user = 1;

  for (const courseId of reviewedCourseIds) {
    await recalculateCourseRating(courseId);
  }

  logger.info(`[Purge] Removed user ${userId} and dependents: ${JSON.stringify(removed)}`);
  return removed;
}

/**
 * Sweeps records whose owning User is already gone - the backlog left behind
 * by deletions that happened before purgeUser existed. Safe to run repeatedly;
 * it only ever touches rows whose userId resolves to nothing.
 */
export async function purgeOrphanedRecords({ dryRun = false } = {}) {
  const userIds = new Set((await User.find({}).select('_id').lean()).map((u) => String(u._id)));
  const report = {};

  for (const [label, Model] of OWNED_BY_USER) {
    const rows = await Model.find({}).select('_id userId').lean();
    const orphanIds = rows.filter((r) => r.userId && !userIds.has(String(r.userId))).map((r) => r._id);
    if (!orphanIds.length) continue;

    report[label] = orphanIds.length;
    if (!dryRun) await Model.deleteMany({ _id: { $in: orphanIds } });
  }

  return report;
}
