import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One thread per (teacher, student) pair — mirrors MessagesPage's thread
 * list. `student` is a *local* roster entry (this backend's own Student
 * collection); a real, paying student portal account is not one, since it
 * lives in a separate service/database with no shared identity. For those
 * — a conversation bridged in from the student portal's own message send —
 * `student` is left null and `externalStudentId`/`externalStudentName`
 * identify the other party instead. Exactly one of the two is set, never
 * both, never neither.
 */
const conversationSchema = new Schema(
  {
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    externalStudentId: { type: String, default: null, index: true }, // student/backend's User._id
    externalStudentName: { type: String, default: null, trim: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSnippet: { type: String, default: null },
    unreadForTeacher: { type: Number, default: 0, min: 0 },
    unreadForStudent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

conversationSchema.index({ teacher: 1, student: 1 }, { unique: true, partialFilterExpression: { student: { $type: 'objectId' } } });
conversationSchema.index({ teacher: 1, externalStudentId: 1 }, { unique: true, partialFilterExpression: { externalStudentId: { $type: 'string' } } });
conversationSchema.index({ teacher: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
