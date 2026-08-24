import { apiClient } from './apiClient';

/**
 * Public, unauthenticated resources (magazines, event photos, program
 * materials) for the Landing Page - a real MongoDB-backed feed bridged from
 * admin uploads (see backend/src/controllers/public.controller.js
 * #listPublicResources), never hardcoded copy.
 */
export const resourceService = {
  async listPublicResources({ type, search, page = 1, pageSize = 12 } = {}) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (type && type !== 'all') params.set('type', type);
    if (search) params.set('search', search);
    const res = await apiClient.get(`/public/resources?${params.toString()}`);
    return res;
  },
};
