import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * What a learning activity actually teaches.
 *
 * Deliberately a collection rather than an enum baked into every schema: the
 * platform launches with three subjects, and the progression rules, skill
 * scores, dashboards and stage requirements all iterate over whatever is
 * enabled here. Adding a fourth must not mean editing a dozen files.
 *
 * Activities reference a subject by CODE, not by _id. The code is stable,
 * readable in a database dump, and - unlike an ObjectId - means the same thing
 * in the teacher and admin services, which keep their own databases.
 */
const subjectSchema = new Schema(
  {
    // Stored uppercase so 'english' and 'ENGLISH' cannot become two subjects.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    // A lucide icon name; the frontend maps it, so an unknown one degrades to a
    // default rather than breaking the page.
    icon: { type: String, default: 'BookOpen', trim: true, maxlength: 64 },
    // Display colour for progress bars, as a hex string the UI can use directly.
    color: { type: String, default: '#22355E', trim: true, maxlength: 16 },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

subjectSchema.index({ enabled: 1, order: 1 });

/**
 * The subject an activity falls into when it has no explicit one AND its course
 * has no usable pillar.
 *
 * It is a real, reserved code rather than null so that unclassified work is
 * visible and countable - "37 activities need a subject" is an answerable
 * question, where a scatter of nulls silently contributes to nothing.
 */
export const UNASSIGNED_SUBJECT = 'UNASSIGNED';

/**
 * Course pillar -> default subject.
 *
 * Only a DEFAULT. An activity's own subject always wins (see
 * progression/subject.service.js). Kept here beside the subject definitions
 * because it is a statement about subjects, not about courses.
 */
export const PILLAR_DEFAULT_SUBJECT = Object.freeze({
  communicate: 'ENGLISH',
  compute: 'COMPUTER',
  create: 'CYBERSECURITY',
});

/** The three the platform launches with. Seeded, not hard-coded into logic. */
export const DEFAULT_SUBJECTS = Object.freeze([
  {
    code: 'ENGLISH',
    name: 'English & Communication',
    description: 'Speaking, writing and the confidence to be understood.',
    icon: 'MessageSquare',
    color: '#22355E',
    order: 1,
  },
  {
    code: 'COMPUTER',
    name: 'Computer Skills',
    description: 'The practical computing every modern role assumes.',
    icon: 'Monitor',
    color: '#5C7A5E',
    order: 2,
  },
  {
    code: 'CYBERSECURITY',
    name: 'Cybersecurity',
    description: 'Staying safe, and keeping others safe, online.',
    icon: 'ShieldCheck',
    color: '#AB5236',
    order: 3,
  },
]);

export const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);

export default Subject;
