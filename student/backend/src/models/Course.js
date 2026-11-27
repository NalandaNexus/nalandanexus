import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A YouTube video attached to one lesson by an administrator or an assigned
 * teacher (services/lessonVideo.service.js is the only writer).
 *
 * Only facts are stored. The embed URL, watch URL and thumbnail URLs are pure
 * functions of `videoId` (utils/youtube.js) and are computed on every read, so
 * there is no second copy of the id to fall out of step with the first.
 *
 * Absent on every lesson nobody has managed, which is how the many lessons
 * that predate this field keep behaving exactly as they did.
 */
const lessonVideoSchema = new Schema(
  {
    provider: { type: String, enum: ['youtube'], default: 'youtube', required: true },
    videoId: { type: String, required: true, match: /^[A-Za-z0-9_-]{11}$/ },
    // What the editor pasted, after validation - shown back to them so they
    // recognise their own link. Never rendered into an iframe.
    originalUrl: { type: String, required: true, maxlength: 2048 },
    title: { type: String, default: '', maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    // 'embed' plays inside Nalanda Nexus; 'external' only offers YouTube.
    playbackMode: { type: String, enum: ['embed', 'external'], default: 'embed' },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    // What YouTube's oEmbed endpoint said when the link was last saved:
    // 'restricted' is embedding disabled (or private), 'unavailable' is no
    // such public video, 'unknown' is that the check could not be made.
    availability: { type: String, enum: ['available', 'restricted', 'unavailable', 'unknown'], default: 'unknown' },
    checkedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
    updatedBy: {
      portal: { type: String, enum: ['admin', 'teacher'], default: null },
      userId: { type: String, default: null },
      name: { type: String, default: null },
    },
  },
  { _id: false }
);

const lessonSchema = new Schema(
  {
    lessonId: { type: String, required: true }, // stable slug, e.g. "l-4"
    title: { type: String, required: true },
    duration: { type: String, default: '' },
    order: { type: Number, required: true },
    // Legacy: a directly-hosted file (e.g. /PRARAMBH.mp4). Superseded by
    // `video` on any lesson that has one; kept so seeded lessons still play.
    videoUrl: { type: String, default: '' },
    video: { type: lessonVideoSchema, default: undefined },
    /**
     * What the lesson actually teaches.
     *
     * A lesson used to carry a title, a duration and a video URL and nothing
     * else, so a course with no video was a list of headings. `summary` is the
     * one-line description the syllabus shows beside each lesson; `content` is
     * the written material a student reads, which is what makes a lesson usable
     * before any video exists for it.
     *
     * Both default to empty, so every existing lesson keeps working untouched.
     */
    summary: { type: String, default: '' },
    content: { type: String, default: '' },
    isPublished: { type: Boolean, default: true },
    isLocked: { type: Boolean, default: false },
    // Set per lesson so one purchased course can teach - and score - all three
    // subjects. Falls back to the module's, then the course pillar's default.
    subject: { type: String, default: null, uppercase: true, trim: true },
    // Who last changed this lesson's structure (title/summary/content/order/
    // publish state) and when - via courseStructure.service.js, independent
    // of `video.updatedAt`/`video.updatedBy` above, so editing a title cannot
    // be blocked by (or silently race) editing its video. Absent on every
    // lesson nobody has structurally edited since this field existed.
    updatedAt: { type: Date, default: null },
    updatedBy: {
      portal: { type: String, enum: ['admin', 'teacher'], default: null },
      userId: { type: String, default: null },
      name: { type: String, default: null },
    },
  },
  { _id: false }
);

const moduleSchema = new Schema(
  {
    moduleId: { type: String, required: true }, // e.g. "mod-2"
    title: { type: String, required: true },
    order: { type: Number, required: true },
    // What the module covers, shown to admins/teachers editing it and to
    // students on the syllabus. Defaults to empty, so every module that
    // predates this field keeps behaving exactly as it did.
    description: { type: String, default: '' },
    // A module-level default, so tagging a whole unit does not mean editing
    // every lesson in it. An individual lesson still overrides this.
    subject: { type: String, default: null, uppercase: true, trim: true },
    // The module's introduction video, shown to students as the first item of
    // the module. Same shape and rules as a lesson's; absent on most modules.
    video: { type: lessonVideoSchema, default: undefined },
    lessons: [lessonSchema],
    // Overrides the course's own `progressionGatingEnabled` for the gate
    // leading INTO this module (see services/courseGating.service.js).
    // null (the default) means "inherit the course setting" - a module never
    // silently opts itself out just because nobody has visited this field.
    gatingEnabled: { type: Boolean, default: null },
    // Same structural-edit bookkeeping as a lesson's, see above.
    updatedAt: { type: Date, default: null },
    updatedBy: {
      portal: { type: String, enum: ['admin', 'teacher'], default: null },
      userId: { type: String, default: null },
      name: { type: String, default: null },
    },
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

    // Course-wide default for the mandatory-progression gate (see
    // services/courseGating.service.js): must a student finish a module's
    // required assignment(s) and pass its quiz(zes) before the next module
    // unlocks, and finish each lesson before the next one in the same module
    // does? Defaults to true (every course is gated unless turned off),
    // matching what the gating feature was built for; an admin can disable it
    // per course here, or override one specific module via that module's own
    // `gatingEnabled`.
    progressionGatingEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

// Lessons a student can actually take: a draft (isPublished false) is withheld
// from students, so counting it made the catalogue overstate the course and kept
// every student's progress short of 100%.
courseSchema.virtual('totalLessons').get(function computeTotalLessons() {
  return (this.modules || []).reduce((sum, m) => sum + (m.lessons || []).filter((l) => l.isPublished !== false).length, 0);
});

courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

export const Course = mongoose.model('Course', courseSchema);
