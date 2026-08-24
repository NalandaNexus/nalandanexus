import mongoose from 'mongoose';

const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    instructor: { type: Schema.Types.ObjectId, ref: 'Teacher', index: true },
    department: { type: String, trim: true, index: true },
    credits: { type: Number, default: 3, min: 0 },
    modulesCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      default: 'PENDING_REVIEW',
      index: true,
    },
    completionRate: { type: Number, default: 0, min: 0, max: 100 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    notes: { type: String },

    // Real commerce fields, needed to bridge an APPROVED course into
    // student/backend's actual purchasable catalog (see
    // services/studentCourseBridge.service.js) — this admin Course was
    // previously a pure governance/accreditation record with no price,
    // description, image, or slug at all.
    description: { type: String, default: '', trim: true, maxlength: 4000 },
    features: [{ type: String, trim: true, maxlength: 200 }],
    priceInPaise: { type: Number, default: 0, min: 0 },
    image: { type: String, default: null },
    slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    // Bridge delivery bookkeeping, mirroring the pattern already used for
    // teacher-provisioning: never silently claim a course is live for sale.
    catalogSyncedAt: { type: Date, default: null },
    catalogSyncStatus: { type: String, enum: ['synced', 'failed', null], default: null },

    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

courseSchema.index({ title: 'text', code: 'text', department: 'text', category: 'text' });

export const Course = mongoose.model('Course', courseSchema);
export default Course;
