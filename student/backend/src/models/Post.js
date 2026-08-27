import mongoose from 'mongoose';

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Gates ONLY the anonymous Landing Page feed (/api/public/highlights) -
    // the in-app student community feed still shows every post, so this
    // changes no student-facing behaviour. Without it, any account that can
    // register could publish arbitrary text straight onto the institution's
    // public homepage with no review and no way to take it down.
    isApprovedForPublic: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

export const Post = mongoose.model('Post', postSchema);
