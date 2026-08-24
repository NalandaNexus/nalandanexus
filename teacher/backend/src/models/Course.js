import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Curriculum module (CoursesPage), distinct from `SchoolClass` (the taught
 * batch/cohort). A course can span one or more classes; student count and
 * completion rate are derived live from those linked classes' rosters and
 * submissions (see services/course.service.js) rather than stored, so a
 * brand-new course correctly shows 0 students / 0% completion instead of a
 * stale or fabricated number.
 */
const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, default: null, trim: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    classes: [{ type: Schema.Types.ObjectId, ref: 'SchoolClass' }],
    modulesCount: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: null, min: 0, max: 5 },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active', index: true },
  },
  { timestamps: true }
);

courseSchema.index({ teacher: 1, status: 1 });

export const Course = mongoose.model('Course', courseSchema);
export default Course;
