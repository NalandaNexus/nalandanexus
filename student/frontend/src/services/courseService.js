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
    rating: c.rating,
    reviewsCount: formatReviewsCount(c.reviewsCount),
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
