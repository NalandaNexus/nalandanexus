import { apiClient, setAccessToken, settleSessionRefresh } from './apiClient';

export const authService = {
  /**
   * Registration no longer issues a session - the backend refuses login
   * until the email is verified (see auth.controller.js#register). Returns
   * the full response body (not just `user`) so the caller can show a
   * "check your email" state and the honest verificationUrlFallback when
   * this environment's SMTP isn't configured.
   */
  async register({ name, email, password, grade }) {
    const res = await apiClient.post('/auth/register', { name, email, password, grade }, { skipAuth: true });
    return res.data;
  },

  async verifyEmail(token) {
    await settleSessionRefresh();
    const res = await apiClient.post('/auth/verify-email', { token }, { skipAuth: true });
    setAccessToken(res.data.accessToken);
    return res.data.user;
  },

  async resendVerification(email) {
    const res = await apiClient.post('/auth/resend-verification', { email }, { skipAuth: true });
    return res.message;
  },

  async login({ email, password }) {
    // Every sign-in waits for the page-load session refresh to settle first, so
    // the previous account's refreshed cookie cannot land after this one's.
    await settleSessionRefresh();
    const res = await apiClient.post('/auth/login', { email, password }, { skipAuth: true });
    setAccessToken(res.data.accessToken);
    return res.data.user;
  },

  async googleAuth(idToken) {
    await settleSessionRefresh();
    const res = await apiClient.post('/auth/google', { idToken }, { skipAuth: true });
    setAccessToken(res.data.accessToken);
    return res.data.user;
  },

  async me() {
    const res = await apiClient.get('/auth/me');
    return res.data; // { user, profile }
  },

  async logout() {
    // A refresh still in flight would rotate the session this is about to revoke,
    // leaving its replacement alive after sign-out.
    await settleSessionRefresh();
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },

  async forgotPassword(email) {
    const res = await apiClient.post('/auth/forgot-password', { email }, { skipAuth: true });
    return res.message;
  },

  async resetPassword(token, password) {
    const res = await apiClient.post('/auth/reset-password', { token, password }, { skipAuth: true });
    return res.message;
  },

  /** Attempts to restore a session on app load using the httpOnly refresh cookie. */
  async restoreSession() {
    const refreshed = await apiClient.tryRefreshSession();
    if (!refreshed) return null;
    try {
      return await authService.me();
    } catch {
      return null;
    }
  },
};
