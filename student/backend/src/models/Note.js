import mongoose from 'mongoose';

const { Schema } = mongoose;

const noteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    content: { type: String, default: '' },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, createdAt: -1 });

export const Note = mongoose.model('Note', noteSchema);
