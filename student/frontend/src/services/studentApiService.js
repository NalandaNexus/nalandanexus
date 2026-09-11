import { apiClient } from './apiClient';

/**
 * Real backend-backed replacement for the old localStorage-only
 * `studentService` (see src/services/studentService.js, now deprecated).
 * Every value here is sourced from MongoDB through the Express API -
 * nothing is read from or written to localStorage anymore.
 */
export const studentApiService = {
  async getDashboard() {
    const res = await apiClient.get('/student/dashboard');
    return res.data;
  },

  async getCourses() {
    const res = await apiClient.get('/student/courses');
    return res.data;
  },

  /**
   * The Digital Learner Profile.
   *
   * Every figure here - XP, level, rank, the three skill scores, overall power,
   * eligibility - is computed by the backend from recorded activity. Nothing on
   * this side recalculates any of it; the card renders what it is given.
   */
  async getProgression() {
    const res = await apiClient.get('/student/progression');
    return res.data;
  },

  async getProgressionActivity(limit = 25) {
    const res = await apiClient.get(`/student/progression/activity?limit=${limit}`);
    return res.data;
  },

  async getProfile() {
    const res = await apiClient.get('/student/profile');
    return res.data;
  },

  async updateProfile(updates) {
    const res = await apiClient.patch('/student/profile', updates);
    return res.data;
  },

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.post('/student/profile/avatar', formData);
    return res.data;
  },

  async completeOnboarding() {
    const res = await apiClient.post('/student/onboarding/complete');
    return res.data;
  },

  async getTasks() {
    const res = await apiClient.get('/student/tasks');
    return res.data;
  },

  async getTask(taskId) {
    const res = await apiClient.get(`/student/tasks/${taskId}`);
    return res.data;
  },

  async submitTask(taskId, submissionText) {
    const res = await apiClient.post(`/student/tasks/${taskId}/submit`, { submissionText });
    return res.data;
  },

  async getQuizzes() {
    const res = await apiClient.get('/student/quizzes');
    return res.data;
  },

  async getQuiz(quizId) {
    const res = await apiClient.get(`/student/quizzes/${quizId}`);
    return res.data;
  },

  async startQuiz(quizId) {
    const res = await apiClient.post(`/student/quizzes/${quizId}/start`);
    return res.data;
  },

  async submitQuiz(quizId, answers) {
    const res = await apiClient.post(`/student/quizzes/${quizId}/submit`, { answers });
    return res.data;
  },

  async getNotifications() {
    const res = await apiClient.get('/student/notifications');
    return res.data;
  },

  async markNotificationRead(id) {
    const res = await apiClient.patch(`/student/notifications/${id}/read`);
    return res.data;
  },

  async markAllNotificationsRead() {
    await apiClient.patch('/student/notifications/read-all');
  },

  async getLeaderboard(courseSlug, period = 'thisWeek') {
    const res = await apiClient.get(`/leaderboard/${courseSlug}?period=${period}`);
    return res.data;
  },

  async getNotes() {
    const res = await apiClient.get('/student/notes');
    return res.data;
  },

  async getMaterials() {
    const res = await apiClient.get('/student/materials');
    return res.data;
  },

  async saveNote(note) {
    if (note.id) {
      const res = await apiClient.patch(`/student/notes/${note.id}`, note);
      return res.data;
    }
    const res = await apiClient.post('/student/notes', note);
    return res.data;
  },

  async deleteNote(noteId) {
    await apiClient.delete(`/student/notes/${noteId}`);
  },

  async getMessages() {
    const res = await apiClient.get('/student/messages');
    return { messages: res.data, teacherName: res.meta?.teacherName || null };
  },

  async sendMessage(body) {
    const res = await apiClient.post('/student/messages', { body });
    return res.data;
  },

  async getCommunityPosts({ page = 1, limit = 20 } = {}) {
    const res = await apiClient.get(`/student/community/posts?page=${page}&limit=${limit}`);
    return { posts: res.data, meta: res.meta };
  },

  async createCommunityPost(body) {
    const res = await apiClient.post('/student/community/posts', { body });
    return res.data;
  },

  async deleteCommunityPost(postId) {
    await apiClient.delete(`/student/community/posts/${postId}`);
    return postId;
  },

  async toggleCommunityPostLike(postId) {
    const res = await apiClient.post(`/student/community/posts/${postId}/like`);
    return res.data;
  },

  async getLiveClasses() {
    const res = await apiClient.get('/student/live-classes');
    return res.data;
  },

  async getSupportTickets() {
    const res = await apiClient.get('/student/support-tickets');
    return res.data;
  },

  async createSupportTicket({ subject, message }) {
    const res = await apiClient.post('/student/support-tickets', { subject, message });
    return res.data;
  },

  async getAnnouncements() {
    const res = await apiClient.get('/student/announcements');
    return res.data;
  },

  async markAnnouncementRead(id) {
    await apiClient.patch(`/student/announcements/${id}/read`);
  },
};
