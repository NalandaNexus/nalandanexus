/**
 * Static category filter pills used by the Learn page and the homepage's
 * Explore Courses carousel. Course *content* itself is real, fetched from
 * the backend via courseService.listPublicCourses() (see
 * src/pages/Learn.jsx, src/components/courses/ExploreCourses.jsx) - these
 * ids must match the `category` values seeded on the Course model
 * (backend/src/seed/seed.js).
 */
export const categories = [
  { id: 'all', label: 'All' },
  { id: 'foundation', label: 'Foundation' },
  { id: 'communication', label: 'Communication' },
  { id: 'programming', label: 'Programming' },
  { id: 'data-science', label: 'Data Science' },
  { id: 'ai-ml', label: 'AI & ML' },
  { id: 'design', label: 'Design' },
];
