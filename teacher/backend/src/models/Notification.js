import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    type: {
      type: String,
      enum: [
        'submission',
        'grading',
        'attendance',
        'announcement',
        'system',
        'subscription',
        'student_activity',
        'message',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    isRead: { type: Boolean, default: false, index: true },
    relatedEntityType: { type: String, default: null }, // 'Student' | 'Assignment' | 'Submission' | ...
    relatedEntityId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
