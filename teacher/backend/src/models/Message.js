import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * senderRole/senderId is a lightweight polymorphic reference (Teacher or
 * Student document) instead of a Mongoose refPath into `User`, because — as
 * noted in Student.js — students are not User documents in this service.
 */
const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderRole: { type: String, enum: ['teacher', 'student'], required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
export default Message;
