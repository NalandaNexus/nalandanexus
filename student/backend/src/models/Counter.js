import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Atomic sequence source for human-facing business identifiers.
 *
 * An enrollment ID is printed on receipts, quoted in support tickets and used
 * as the join key by the other two portals, so it has to be both readable and
 * genuinely unique - a random suffix would eventually collide and a
 * count-then-increment would race two simultaneous purchases onto the same
 * number. `$inc` inside findOneAndUpdate is a single atomic document update, so
 * every caller gets a distinct value even under concurrent checkout.
 */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. 'enrollment:2026'
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

counterSchema.statics.next = async function next(key) {
  const doc = await this.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};

export const Counter = mongoose.model('Counter', counterSchema);
export default Counter;
