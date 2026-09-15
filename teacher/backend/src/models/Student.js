import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Student roster entry owned by a teacher.
 *
 * This is NOT a login-capable account (see the scope note in models/User.js)
 * — it is the record a teacher sees/manages for a real student who
 * authenticates through the separate student portal. `linkedUserId` is left
 * in place, unset, as the integration point if the portals are ever wired
 * together (e.g. matched by email during a future account-linking step).
 *
 * `metrics.*` are intentionally denormalized/cached fields, recalculated by
 * services/metrics.service.js whenever grading, attendance, or engagement
 * events occur for this student. They exist so the dashboard, leaderboard,
 * and at-risk views can list/sort/filter 100s of students without an
 * expensive fan-out aggregation on every request — the tradeoff (possible
 * staleness between the triggering write and the recalculation) is resolved
 * by recalculating synchronously, in the same request, right after the
 * write that could change it.
 */
const studentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    phone: { type: String, default: null, trim: true },
    avatarUrl: { type: String, default: null },
    rollNumber: { type: String, default: null, trim: true },

    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    linkedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // The student portal's business enrollment identifier (ENR-YYYY-NNNNNN) -
    // the authoritative identity for matching during sync. Email was the only
    // join key before, so a student who changed their address on the student
    // portal came back as a SECOND roster row, orphaning their grades and
    // attendance under the old one. No `default: null`: the unique index below
    // is sparse, and a sparse index only skips a genuinely ABSENT field.
    enrollmentId: { type: String, trim: true, uppercase: true },

    guardianName: { type: String, default: null, trim: true },
    guardianPhone: { type: String, default: null, trim: true },
    guardianEmail: { type: String, default: null, trim: true },

    // From the student portal, never set by a teacher (see
    // services/portalStudentSync.service.js): the student's institution-wide
    // enrollment number (NN26-000124), their class as they recorded it, and when
    // the record last applied here was read there - so an older record delivered
    // late cannot overwrite a newer one. No default on the number; it is absent
    // until the student portal supplies it.
    enrollmentNumber: { type: String, trim: true, uppercase: true },
    grade: { type: String, default: null, trim: true },
    portalSyncedAt: { type: Date, default: null },

    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    enrollmentDate: { type: Date, default: Date.now },

    // concept key (see Concept.js) -> mastery score 0-100
    conceptScores: { type: Map, of: Number, default: {} },

    metrics: {
      currentScore: { type: Number, default: 0, min: 0, max: 100 },
      previousScore: { type: Number, default: 0, min: 0, max: 100 },
      scoreChange: { type: Number, default: 0 },
      classAverage: { type: Number, default: 0, min: 0, max: 100 },
      attendanceRate: { type: Number, default: 0, min: 0, max: 100 },
      submissionRate: { type: Number, default: 0, min: 0, max: 100 },
      engagementScore: { type: Number, default: 0, min: 0, max: 100 },
      riskLevel: { type: String, enum: ['act_now', 'watch', 'good'], default: 'good', index: true },
      atRiskReason: { type: String, default: null },
      lastRecalculatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

studentSchema.index({ teacher: 1, class: 1 });
studentSchema.index({ teacher: 1, 'metrics.riskLevel': 1 });
studentSchema.index({ teacher: 1, status: 1 });
studentSchema.index({ class: 1, email: 1 }, { unique: true });
// One roster row per enrollment, globally: an enrollment belongs to exactly one
// batch, so this also stops a student being placed into two batches at once.
studentSchema.index({ enrollmentId: 1 }, { unique: true, sparse: true });
// Finds a student's rows when their record arrives from the student portal.
studentSchema.index({ linkedUserId: 1 });
studentSchema.index({ name: 'text', email: 'text' });

/** Deterministic risk classification used everywhere a score needs a tier. */
studentSchema.statics.classifyRisk = function classifyRisk(score) {
  if (score < 60) return 'act_now';
  if (score < 75) return 'watch';
  return 'good';
};

export const Student = mongoose.model('Student', studentSchema);
export default Student;
