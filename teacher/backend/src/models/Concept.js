import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A curriculum topic/domain (e.g. "Optics", "Mechanics") used to tag
 * assignments and to roll student.conceptScores up into the class-wide
 * "Concept Performance Analytics" diagnostics on the dashboard.
 *
 * `previousAvgScore` is a cache updated each time
 * services/metrics.service.js#recomputeConceptAnalytics runs; it is the
 * baseline the UI's "trend" arrow is computed against (current avg minus
 * this value), since there is no dedicated time-series collection for it.
 */
const conceptSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true }, // 'optics'
    name: { type: String, required: true, trim: true }, // 'Optics'
    subject: { type: String, default: null, trim: true },
    description: { type: String, default: null, maxlength: 500 },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    previousAvgScore: { type: Number, default: null },
    lastComputedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conceptSchema.index({ teacher: 1, key: 1 }, { unique: true });

export const Concept = mongoose.model('Concept', conceptSchema);
export default Concept;
