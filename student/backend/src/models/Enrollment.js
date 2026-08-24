import mongoose from 'mongoose';

const { Schema } = mongoose;

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null }, // null only for free courses
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

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
