import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Catalog task/reflection/activity definition, authored per-course (not per-student). */
const taskSchema = new Schema(
  {
    taskId: { type: String, required: true, unique: true, index: true }, // e.g. "orientation-reflection"
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
    type: { type: String, enum: ['Reflection', 'Quiz', 'Task', 'Activity'], default: 'Task' },
    description: { type: String, default: '' },
    moduleTitle: { type: String, default: '' },
    dueOffsetDays: { type: Number, default: 7 }, // relative to enrollment date
    urgency: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    iconName: { type: String, default: 'FileText' },
    pointsReward: { type: Number, default: 30 },
    isPublished: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    // Bridged tasks (from a linked teacher/backend Assignment) carry a real
    // absolute deadline instead of the relative dueOffsetDays above - when
    // set, this takes priority (see task.controller.js).
    dueDate: { type: Date, default: null },
    // No `default` on either field below, deliberately: a sparse index only
    // excludes a document when the field is genuinely ABSENT, not merely
    // `null` - giving these a `default: null` would put every native task
    // in the index with the same {null} key and collide on the second one.
    // (Caught by a real duplicate-key error while seeding real bridged data
    // during verification - see the same fix on LiveClass/Quiz.)
    source: { type: String, enum: ['teacher-portal'] },
    sourceId: { type: String },
  },
  { timestamps: true }
);

taskSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

export const Task = mongoose.model('Task', taskSchema);
