import { apiClient } from './apiClient';

function formatReviewsCount(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function formatPrice(priceInPaise) {
  return `₹${Math.round(priceInPaise / 100).toLocaleString('en-IN')}`;
}

/**
 * Adapts the backend's Course shape (see backend/src/controllers/public.controller.js
 * toPublicCourse) into the display-model shape the existing marketing
 * components (CourseCard, ExploreCourses, Learn, SearchModal) already expect
 * - keeps those components unchanged while swapping the data source from the
 * static frontend/src/data/courses.js file to the real database.
 */
function toDisplayCourse(c) {
  return {
    id: c.slug,
    slug: c.slug,
    title: c.title,
    tagline: c.tagline,
    description: c.description,
    category: c.category,
    pillar: c.pillar,
    // Raw count kept alongside the display string so the UI can decide
    // whether there is anything to show at all. A course with no reviews must
    // render no stars rather than "0" next to an empty rating.
    rating: c.rating,
    reviewsCount: c.reviewsCount || 0,
    reviewsCountLabel: formatReviewsCount(c.reviewsCount),
    hasRating: Boolean(c.reviewsCount > 0),
    difficulty: c.difficulty,
    duration: c.duration,
    image: c.bannerImage,
    price: formatPrice(c.priceInPaise),
    originalPrice: c.originalPriceInPaise ? formatPrice(c.originalPriceInPaise) : null,
    isFree: c.priceInPaise === 0,
    isUpcoming: !c.isPurchasable,
    isEnrolled: c.isEnrolled,
    isFeatured: c.isFeatured,
    isPopular: c.isPopular,
    instructor: c.instructor,
    skills: c.skills,
    totalLessons: c.totalLessons,
  };
}

export const courseService = {
  /** Publicly readable list of a course's real reviews. */
  async listCourseReviews(slug, { page = 1, pageSize = 10 } = {}) {
    const res = await apiClient.get(`/public/courses/${slug}/reviews?page=${page}&pageSize=${pageSize}`);
    return { reviews: res.data, meta: res.meta };
  },

  /** The signed-in student's own review for a course, or null. Enrolled students only. */
  async getMyReview(slug) {
    const res = await apiClient.get(`/student/courses/${slug}/review`);
    return res.data;
  },

  async createReview(slug, { rating, comment }) {
    const res = await apiClient.post(`/student/courses/${slug}/review`, { rating, comment });
    return res.data;
  },

  async updateReview(slug, { rating, comment }) {
    const res = await apiClient.patch(`/student/courses/${slug}/review`, { rating, comment });
    return res.data;
  },

  async deleteReview(slug) {
    const res = await apiClient.delete(`/student/courses/${slug}/review`);
    return res.data;
  },

  async listPublicCourses() {
    const res = await apiClient.get('/public/courses');
    return res.data.map(toDisplayCourse);
  },

  /** Real, admin-controlled "Popular Courses" - filters on Course.isPopular server-side, never a client-side .slice(). */
  async listPopularCourses() {
    const res = await apiClient.get('/public/courses?popular=true');
    return res.data.map(toDisplayCourse);
  },

  async getPublicCourse(slug) {
    const res = await apiClient.get(`/public/courses/${slug}`);
    return res.data;
  },

  async getMyCourses() {
    const res = await apiClient.get('/student/courses');
    return res.data;
  },

  async getEnrolledCourseContent(slug) {
    const res = await apiClient.get(`/student/courses/${slug}/content`);
    return res.data;
  },

  async markLessonComplete(lessonId) {
    const res = await apiClient.post(`/student/courses/lessons/${lessonId}/progress`);
    return res.data;
  },
};
