import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Single-thread student<->teacher inbox, per student (backed by the real
 * teacher assigned to their primary course - see
 * services/teacherBridge.service.js#fetchTeacherForCourse - rather than a
 * placeholder "mentor" identity). A teacher-authored message is delivered
 * live via the bidirectional bridge (teacher/backend's message.service.js
 * -> POST /api/internal/messages here), never simulated client-side.
 */
const messageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender: { type: String, enum: ['student', 'teacher'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    isRead: { type: Boolean, default: false },
    // Denormalized at send-time so a message still shows the right name
    // even if the teacher link later changes.
    teacherId: { type: String, default: null },
    teacherName: { type: String, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ userId: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
