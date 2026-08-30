import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * The authoritative relationship between a student and a course.
 *
 * Two identities live here and they are not interchangeable. `_id` is this
 * database's internal handle. `enrollmentId` is the BUSINESS identity - the
 * value printed for the student, quoted in support, and used as the join key by
 * the teacher portal, which lives in a different database and can never
 * meaningfully hold one of our ObjectIds. It is assigned once and never
 * regenerated, including during cross-portal synchronisation.
 *
 * `batchId` is the student's placement WITHIN the course. A course
 * (PRARAMBH) runs several batches (PB1, PB2, PB3), each with its own teacher and
 * its own lectures; a student buys the course and is then placed in exactly one
 * of them. Before this field existed the teacher portal could only ask "who
 * bought this course", so every batch of a course received every one of its
 * students - invisible while a course had one batch, a cross-batch data leak
 * the moment it had two. Null means "not yet placed", which is a real state
 * (awaiting assignment or admin approval), not an error.
 */
const enrollmentSchema = new Schema(
  {
    // Assigned by services/enrollment.service.js#createEnrollment. Not `required`
    // at the schema level: enrollments predating this field exist in production
    // and must keep loading, so the backfill is an explicit, reviewable script
    // (scripts/backfillEnrollmentIds.js) rather than a hard schema break.
    //
    // Deliberately NO `default: null`. The unique index below is sparse, and a
    // sparse index only skips a document when the field is genuinely ABSENT -
    // defaulting it to null would put every unassigned enrollment under the same
    // key and collide on the second one. Same trap as LiveClass.sourceId.
    enrollmentId: { type: String, trim: true, uppercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null }, // null only for free courses

    // Teacher-portal SchoolClass._id as a STRING - a cross-database reference,
    // never a real ObjectId ref (mirrors how AssignedCourse.sourceId already
    // carries admin's Course._id in the teacher portal).
    batchId: { type: String, default: null, index: true },
    batchCode: { type: String, default: null, trim: true }, // denormalised label, display only
    batchAssignedAt: { type: Date, default: null },

    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    currentModuleId: { type: String, default: null },
    currentLessonId: { type: String, default: null },
    enrolledAt: { type: Date, default: Date.now },
    // Cached resolution of "which teacher/backend Teacher owns this course",
    // via GET /api/internal/teacher-for-course/:slug (see
    // services/teacherBridge.service.js). Refreshed lazily when stale/missing
    // rather than on every message send - a separate service being briefly
    // unreachable must not block messaging.
    assignedTeacher: {
      teacherId: { type: String, default: null },
      name: { type: String, default: null },
      avatarUrl: { type: String, default: null },
      resolvedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
// Sparse so the rows still awaiting backfill (enrollmentId absent) don't all
// collide on a single null key - the same trap already documented on
// LiveClass.sourceId and AssignedCourse.sourceId.
enrollmentSchema.index({ enrollmentId: 1 }, { unique: true, sparse: true });
// Serves the teacher portal's "who is in MY batch" query.
enrollmentSchema.index({ courseId: 1, batchId: 1, status: 1 });

/** Business identity is immutable: once issued it is quoted externally and must never be rewritten. */
enrollmentSchema.pre('save', function guardEnrollmentId(next) {
  if (!this.isNew && this.isModified('enrollmentId') && this.$locals.allowEnrollmentIdBackfill !== true) {
    return next(new Error('enrollmentId is immutable once assigned.'));
  }
  next();
});

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
