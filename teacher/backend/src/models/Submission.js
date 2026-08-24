import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One row per (assignment, student) pair, created up-front in 'pending'
 * status when an assignment is published to a class (see
 * services/assignment.service.js#createAssignment). This lets "submitted /
 * toGrade / missing" counts be simple indexed counts instead of having to
 * infer "missing" from absence-of-a-row, and gives students a stable place
 * to submit into.
 *
 * `status` stays one of the four stored states below; a submission that is
 * still 'pending' after its assignment's due date is treated as effectively
 * "missing" by the read layer (services compute this on the way out) rather
 * than by a background job flipping the stored value.
 */
const submissionSchema = new Schema(
  {
    assignment: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    class: { type: Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },

    status: { type: String, enum: ['pending', 'submitted', 'late', 'graded'], default: 'pending', index: true },
    submittedAt: { type: Date, default: null },
    content: { type: String, default: null, maxlength: 10000 },
    attachments: [{ filename: String, url: String, size: Number }],

    score: { type: Number, default: null, min: 0 },
    maxScore: { type: Number, default: 100 },
    feedback: { type: String, default: null, maxlength: 2000 },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    gradedAt: { type: Date, default: null },

    // student/backend's own TaskSubmission._id, present only when this
    // submission arrived via receiveBridgedSubmission - lets gradeSubmission
    // push the real grade back to the originating student portal (the
    // return leg of the task bridge, see services/studentBridge.service.js).
    studentSubmissionSourceId: { type: String, default: null },
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ student: 1, status: 1 });
submissionSchema.index({ teacher: 1, status: 1 });

export const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
