import mongoose from 'mongoose';

const { Schema } = mongoose;

const lessonSchema = new Schema(
  {
    lessonId: { type: String, required: true }, // stable slug, e.g. "l-4"
    title: { type: String, required: true },
    duration: { type: String, default: '' },
    order: { type: Number, required: true },
    videoUrl: { type: String, default: '' },
    isPublished: { type: Boolean, default: true },
    isLocked: { type: Boolean, default: false },
    // Set per lesson so one purchased course can teach - and score - all three
    // subjects. Falls back to the module's, then the course pillar's default.
    subject: { type: String, default: null, uppercase: true, trim: true },
  },
  { _id: false }
);

const moduleSchema = new Schema(
  {
    moduleId: { type: String, required: true }, // e.g. "mod-2"
    title: { type: String, required: true },
    order: { type: Number, required: true },
    // A module-level default, so tagging a whole unit does not mean editing
    // every lesson in it. An individual lesson still overrides this.
    subject: { type: String, default: null, uppercase: true, trim: true },
    lessons: [lessonSchema],
  },
  { _id: false }
);

const courseSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    category: { type: String, default: 'foundation', index: true },
    // Which of the 3 pillars (Communicate/Compute/Create) this course belongs
    // to - drives the public Learn page's pillar filter.
    pillar: { type: String, enum: ['communicate', 'compute', 'create'], default: 'compute' },
    // DERIVED FIELDS - never set these by hand. They are recomputed from the
    // course's Review documents by services/review.service.js on every review
    // create/update/delete. A new course starts at 0/0, meaning "no rating
    // yet", and the UI shows nothing rather than a number. The previous
    // default of 4.8 gave every course a five-star reputation the moment it
    // was created, with no reviews behind it.
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    grades: [{ type: String }], // e.g. ["3","4",...,"12"] - class/grade applicability
    difficulty: { type: String, default: 'Beginner Friendly' },
    // Human-readable label, kept for the existing catalogue UI.
    duration: { type: String, default: '' },

    /**
     * The same fact as a number the system can compute with.
     *
     * `duration` alone is presentation text - "9 Months" cannot be added to an
     * enrolment date. These two carry the real value so an enrolment can work
     * out when a course ends, and the label above is derived from them when a
     * course is created or its duration changed.
     */
    durationValue: { type: Number, default: null, min: 0 },
    durationUnit: { type: String, enum: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS', null], default: null },
    bannerImage: { type: String, default: '' },
    videoUrl: { type: String, default: '' },

    priceInPaise: { type: Number, required: true, default: 0 }, // 0 = free course
    originalPriceInPaise: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    isPurchasable: { type: Boolean, default: true }, // false = "Upcoming" catalog placeholder
    isPublished: { type: Boolean, default: true },
    // Admin-controlled visibility flags for the public Landing Page's
    // Popular/Featured sections (see public.controller.js#listCourses) -
    // real fields a course either has or doesn't, never a frontend-side
    // .slice() over arbitrary DB order. isFeatured marks the single
    // primary/hero course (e.g. Prarambh); isPopular marks the broader
    // "Popular Courses" set.
    isFeatured: { type: Boolean, default: false, index: true },
    isPopular: { type: Boolean, default: false, index: true },

    instructor: {
      name: { type: String, default: '' },
      role: { type: String, default: '' },
      avatar: { type: String, default: '' },
    },
    skills: [{ type: String }],

    modules: [moduleSchema],

    // Set only for courses delivered by admin/backend's cross-portal bridge
    // (see routes/internal.routes.js) rather than authored/seeded natively
    // here. sourceId is the admin portal's own Course _id. Deliberately NO
    // default on sourceId - a sparse index only excludes a document when
    // the field is genuinely ABSENT, not merely `null` (see the identical,
    // real bug already fixed on Task/LiveClass/Quiz/Announcement).
    source: { type: String, enum: ['native', 'admin-portal'], default: 'native' },
    sourceId: { type: String },
  },
  { timestamps: true }
);

courseSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

courseSchema.virtual('totalLessons').get(function computeTotalLessons() {
  return (this.modules || []).reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
});

courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

export const Course = mongoose.model('Course', courseSchema);
