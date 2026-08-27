import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { Course } from '../models/Course.js';

/** Aggregation $match needs a real ObjectId; callers pass either form. */
function toObjectId(id) {
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
}

/**
 * Recomputes a course's rating and review count from its actual Review
 * documents and writes them back onto the Course.
 *
 * Called after every create, update and delete, so the denormalised fields on
 * Course can never drift from the records they summarise. A course with no
 * reviews is written as rating 0 / reviewsCount 0 - the API and UI treat that
 * as "no rating yet" and show nothing, rather than inventing a number.
 *
 * Returns the newly-written values so a caller can respond with them without
 * a second read.
 */
export async function recalculateCourseRating(courseId) {
  const [agg] = await Review.aggregate([
    { $match: { courseId: toObjectId(courseId) } },
    { $group: { _id: '$courseId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  // Stored to one decimal place: that is the precision the UI displays, and
  // rounding once here keeps every consumer showing the same number.
  const rating = agg ? Math.round(agg.avg * 10) / 10 : 0;
  const reviewsCount = agg ? agg.count : 0;

  await Course.updateOne({ _id: courseId }, { $set: { rating, reviewsCount } });

  return { rating, reviewsCount };
}

/**
 * Platform-wide learner satisfaction, expressed as a percentage of 5 stars.
 *
 * Returns null - not a number - when there are too few reviews to say anything
 * honest. The Landing Page hides the statistic entirely in that case instead
 * of publishing a figure derived from one or two votes.
 */
export const MIN_REVIEWS_FOR_SATISFACTION = 5;

export async function getPlatformSatisfaction() {
  const [agg] = await Review.aggregate([
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  if (!agg || agg.count < MIN_REVIEWS_FOR_SATISFACTION) {
    return { percent: null, reviewsCount: agg?.count || 0 };
  }

  return { percent: Math.round((agg.avg / 5) * 100), reviewsCount: agg.count };
}
