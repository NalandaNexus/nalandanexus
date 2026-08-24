import { apiClient } from './apiClient';

/**
 * Real, aggregated platform stats for the Landing Page's stat strip - see
 * backend/src/controllers/public.controller.js#listPublicStats. Never a
 * hardcoded marketing figure.
 */
export const statsService = {
  async getPublicStats() {
    const res = await apiClient.get('/public/stats');
    return res.data;
  },

  /** Real recent community posts, shown as genuine impact stories - never a fabricated testimonial. */
  async getPublicHighlights(limit = 5) {
    const res = await apiClient.get(`/public/highlights?limit=${limit}`);
    return res.data;
  },
};
