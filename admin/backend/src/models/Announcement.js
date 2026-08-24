import mongoose from 'mongoose';

const { Schema } = mongoose;

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    audience: { type: String, enum: ['ALL', 'TEACHERS', 'STUDENTS'], default: 'ALL', index: true },
    author: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    publishedAt: { type: Date, default: Date.now, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model('Announcement', announcementSchema);
export default Announcement;
