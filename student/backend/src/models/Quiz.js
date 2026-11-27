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
    // Which module this counts toward for the mandatory-progression gate
    // (see services/courseGating.service.js) - the real id from
    // Course.modules[], not the free-text moduleTitle label below. Null
    // means "not tagged", which the gating engine treats as exempt from
    // that module's requirement rather than miscounting it as missing.
    moduleId: { type: String, default: null, index: true },
    // What this actually teaches. Null means "not explicitly set", which the
    // subject resolver fills in from the course pillar - see
    // progression/subject.service.js. Null is meaningfully different from
    // UNASSIGNED: one has not been decided, the other could not be.
    subject: { type: String, default: null, uppercase: true, trim: true, index: true },
    title: { type: String, required: true },
    moduleTitle: { type: String, default: '' },
    pointsReward: { type: Number, default: 50 },
    timeLimitMins: { type: Number, default: 10 },
    // The mandatory-progression gate's bar for this quiz (see
    // services/courseGating.service.js) - a student must score at least this
    // to count as having passed it. Previously only ever read as `?? 50` at
    // grading time (quiz.controller.js#submitQuiz); this makes that default
    // a real, persisted field an admin can actually change, rather than a
    // number baked into the code with nothing to edit.
    passingScore: { type: Number, default: 50, min: 0, max: 100 },
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
