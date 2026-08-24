import mongoose from 'mongoose';

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    questionId: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true }, // NEVER serialize to the client pre-submission
    explanation: { type: String, default: '' }, // only revealed after grading
  },
  { _id: false }
);

const quizSchema = new Schema(
  {
    quizId: { type: String, required: true, unique: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true },
    moduleTitle: { type: String, default: '' },
    pointsReward: { type: Number, default: 50 },
    timeLimitMins: { type: Number, default: 10 },
    questions: [questionSchema],
    isPublished: { type: Boolean, default: true },
    // Set only for quizzes delivered by teacher/backend's cross-portal
    // bridge (see routes/internal.routes.js) rather than authored/seeded
    // natively here. sourceId is the teacher portal's own Exam _id.
    // `sourceId` deliberately has NO default - a sparse index only excludes
    // a document when the field is genuinely ABSENT, not merely `null`, so
    // a `default: null` here would put every native/seeded quiz in the
    // index under the same key and collide on the second one (confirmed by
    // a real duplicate-key error while seeding during verification).
    source: { type: String, enum: ['native', 'teacher-portal'], default: 'native' },
    sourceId: { type: String },
  },
  { timestamps: true }
);

quizSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

/**
 * Returns a client-safe representation with correct answers/explanations
 * stripped out. Used for GET /quizzes/:id BEFORE submission.
 */
quizSchema.methods.toPublicJSON = function toPublicJSON() {
  const obj = this.toObject();
  return {
    quizId: obj.quizId,
    title: obj.title,
    moduleTitle: obj.moduleTitle,
    pointsReward: obj.pointsReward,
    timeLimitMins: obj.timeLimitMins,
    questions: obj.questions.map((q) => ({
      questionId: q.questionId,
      question: q.question,
      options: q.options,
    })),
  };
};

export const Quiz = mongoose.model('Quiz', quizSchema);
