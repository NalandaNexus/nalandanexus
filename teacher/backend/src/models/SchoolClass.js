import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A taught "batch" of a coaching course (what the UI calls a "Class", e.g.
 * "Morning Batch A" of the "PRARAMBH" course) — not a K-12 school
 * grade/section. Deliberately distinct from `Course` (curriculum content,
 * see Course.js) — the frontend's Classes page and Courses page are two
 * different concepts in the existing UI and we preserve that split rather
 * than merging them.
 *
 * `grade`/`section` are legacy, optional fields kept only so pre-existing
 * classes created before this model don't lose data; new batches don't set
 * them. `studentCourseSlug` is the real organizing concept — every new
 * batch must link to a real, purchasable course on the student portal (see
 * student/backend's Course.slug), which is what actually determines who
 * can enroll via a real purchase (see student.service.js#syncEnrollmentForClass).
 */
const schoolClassSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true }, // e.g. 'PRARAMBH-MORNING-BATCH-A' — unique per teacher
    name: { type: String, required: true, trim: true }, // e.g. 'Morning Batch A'
    subject: { type: String, default: null, trim: true },
    grade: { type: String, default: null, trim: true },
    section: { type: String, default: null, trim: true },
    academicSession: { type: String, default: null, trim: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    room: { type: String, default: null, trim: true },
    schedule: { type: String, default: null, trim: true }, // human-readable, e.g. 'Mon, Wed, Fri 03:00 PM'
    capacity: { type: Number, default: 60, min: 1 },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    // Links this batch to a purchasable course on the student portal — the
    // real basis for "who can enroll" (see syncEnrollmentForClass). Kept
    // optional at the schema level only for legacy pre-coaching-model
    // classes; every new batch's create form requires it (see
    // validators/class.validators.js#createClassValidator).
    studentCourseSlug: { type: String, default: null, trim: true, index: true },
    // Seats given out, maintained as a cache so capacity can be enforced with a
    // single atomic $expr-guarded $inc (see services/batchPlacement.service.js).
    // A plain count-then-insert would let two simultaneous purchases both take
    // the last seat. Reconciled against the real roster after every enrollment
    // sync, so the cache can never drift permanently.
    enrolledCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schoolClassSchema.index({ teacher: 1, status: 1 });
schoolClassSchema.index({ teacher: 1, code: 1 }, { unique: true });

export const SchoolClass = mongoose.model('SchoolClass', schoolClassSchema);
export default SchoolClass;
