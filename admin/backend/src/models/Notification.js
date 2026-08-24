import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    type: {
      type: String,
      enum: [
        'TEACHER_APPLICATION', 'TEACHER_STATUS', 'STUDENT_STATUS', 'COURSE_SUBMITTED',
        'COURSE_STATUS', 'PAYMENT', 'ENROLLMENT', 'SYSTEM', 'ANNOUNCEMENT',
      ],
      default: 'SYSTEM',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    relatedEntityType: { type: String },
    relatedEntityId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
