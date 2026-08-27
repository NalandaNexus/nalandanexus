import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A course rating written by a genuinely enrolled student.
 *
 * Course.rating / Course.reviewsCount are DERIVED from these documents by
 * services/review.service.js - they are never written by hand. Before this
 * existed they were seeded marketing numbers (4.7-5.0 stars over 1,200-3,200
 * "reviews") with no underlying records at all, which also fed the Landing
 * Page's "Learner Satisfaction" figure.
 */
const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    // Whole stars only. A half-star average is meaningful; a half-star vote is not.
    rating: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'Rating must be a whole number of stars.' } },
    comment: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

// One review per student per course. Enforced in the database rather than only
// in the controller, so a race between two concurrent submissions cannot
// create a duplicate that would then skew the average.
reviewSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
