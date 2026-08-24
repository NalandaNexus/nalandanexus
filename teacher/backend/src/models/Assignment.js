import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Assignment counts (submitted / toGrade / avgScore) are deliberately NOT
 * stored here — they are always derived live from the Submission collection
 * (see services/assignment.service.js) so they can never drift out of sync
 * with the source of truth ("do not fake assignment counts").
 */
const assignmentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 4000 },
    instructions: { type: String, default: '', maxlength: 4000 },

    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    course: { type: String, default: null, trim: true }, // free-text curriculum label, e.g. 'Advanced Physics'
    concept: { type: Schema.Types.ObjectId, ref: 'Concept', default: null },

    dueDate: { type: Date, required: true, index: true },
    maxScore: { type: Number, default: 100, min: 1, max: 1000 },
    attachments: [{ filename: String, url: String, size: Number }],

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published', index: true },
  },
  { timestamps: true }
);

assignmentSchema.index({ teacher: 1, status: 1, dueDate: -1 });
assignmentSchema.index({ class: 1, status: 1 });

export const Assignment = mongoose.model('Assignment', assignmentSchema);
export default Assignment;
