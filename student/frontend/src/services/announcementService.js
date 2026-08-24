import { apiClient } from './apiClient';

/**
 * Public, unauthenticated announcements for the Landing Page - a real
 * MongoDB-backed feed (see backend/src/controllers/public.controller.js
 * #listPublicAnnouncements), never hardcoded copy. Separate from
 * studentApiService's authenticated getAnnouncements(), which returns a
 * logged-in student's own read-state and course-scoped announcements too.
 */
export const announcementService = {
  async listPublicAnnouncements(limit = 6) {
    const res = await apiClient.get(`/public/announcements?limit=${limit}`);
    return res.data;
  },
};
