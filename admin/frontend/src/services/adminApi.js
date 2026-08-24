/**
 * Nalanda Nexus - Admin API Service
 * Talks to the real MongoDB-backed admin backend at http://localhost:5003/api/admin.
 * No dev-mode bypass token exists anymore — every request is either
 * unauthenticated (login) or carries a real JWT issued by /auth/login.
 */

const API_BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5003/api/admin';
export const SOCKET_URL = import.meta.env.VITE_ADMIN_SOCKET_URL || 'http://localhost:5003';

// Cross-portal navigation links (e.g. "Return to Faculty Portal" buttons) — env-driven so they resolve correctly once each portal has a real deployed URL, falling back to local dev ports.
export const TEACHER_PORTAL_URL = import.meta.env.VITE_TEACHER_PORTAL_URL || 'http://localhost:5174';
export const STUDENT_PORTAL_URL = import.meta.env.VITE_STUDENT_PORTAL_URL || 'http://localhost:3000';

const TOKEN_KEY = 'nalanda_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Course create/update carries an optional image file, so it goes as multipart, not JSON. */
function toCourseFormData(courseData) {
  const form = new FormData();
  Object.entries(courseData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, value);
  });
  return form;
}

/** Resource create/update always carries a file (magazine PDF / event image), so it goes as multipart too. */
function toResourceFormData(resourceData) {
  const form = new FormData();
  Object.entries(resourceData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, value);
  });
  return form;
}

async function request(path, { method = 'GET', body, query, isFormData = false } = {}) {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      // multipart/form-data needs its own auto-generated boundary — the
      // browser sets Content-Type itself when the body is a FormData.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
    },
    body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401) {
    // Session is gone (expired/revoked/never existed) — let the auth
    // context know so it can clear state and redirect to /login, without
    // adminApi importing the context module directly (avoids a cycle).
    window.dispatchEvent(new CustomEvent('nalanda-admin-unauthorized'));
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response (e.g. CSV download handled separately) — ignore.
  }

  if (!res.ok) {
    const error = new Error(json?.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.code = json?.code;
    error.errors = json?.errors;
    throw error;
  }

  return json;
}

export const adminApi = {
  // ── Auth ──────────────────────────────────────────────────────────────
  async login({ email, password }) {
    const json = await request('/auth/login', { method: 'POST', body: { email, password } });
    if (json.data?.token) setToken(json.data.token);
    return json.data;
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setToken(null);
    }
  },

  async getMe() {
    const json = await request('/auth/me');
    return json.data;
  },

  async changePassword({ currentPassword, newPassword }) {
    const json = await request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    if (json.data?.token) setToken(json.data.token);
    return json.data;
  },

  // ── Dashboard ─────────────────────────────────────────────────────────
  async getOverview() {
    const json = await request('/overview');
    return json.data;
  },

  async getLeaderboard() {
    const json = await request('/leaderboard');
    return json.data;
  },

  // Real-time SSE Live Telemetry (aggregate counts only — see backend note
  // on why this can't carry an Authorization header).
  subscribeLiveTelemetry(onData, onError, onStatusChange) {
    let eventSource = null;
    let reconnectTimeout = null;
    let isExplicitlyClosed = false;

    function connect() {
      if (isExplicitlyClosed) return;

      onStatusChange?.('CONNECTING');
      try {
        eventSource = new EventSource(`${API_BASE}/live-telemetry`);

        eventSource.addEventListener('telemetry', (event) => {
          try {
            const data = JSON.parse(event.data);
            onStatusChange?.('LIVE');
            onData(data);
          } catch (e) {
            console.error('Error parsing SSE event:', e);
          }
        });

        eventSource.onopen = () => {
          onStatusChange?.('LIVE');
        };

        eventSource.onerror = (err) => {
          onStatusChange?.('DISCONNECTED');
          onError?.(err);
          eventSource.close();

          if (!isExplicitlyClosed) {
            reconnectTimeout = setTimeout(connect, 4000);
          }
        };
      } catch (e) {
        onStatusChange?.('DISCONNECTED');
        onError?.(e);
        if (!isExplicitlyClosed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isExplicitlyClosed = true;
      clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  },

  // ── Teachers ──────────────────────────────────────────────────────────
  async getTeachers(params = {}) {
    const json = await request('/teachers', { query: params });
    return json.data || [];
  },

  async getTeacher(id) {
    const json = await request(`/teachers/${id}`);
    return json.data;
  },

  async createTeacher(teacherData) {
    return request('/teachers', { method: 'POST', body: teacherData });
  },

  async updateTeacher(id, updateData) {
    const json = await request(`/teachers/${id}`, { method: 'PUT', body: updateData });
    return json.data;
  },

  async deleteTeacher(id) {
    return request(`/teachers/${id}`, { method: 'DELETE' });
  },

  async resendInvite(id) {
    return request(`/teachers/${id}/resend-invite`, { method: 'POST' });
  },

  async resendCredentials(id) {
    return request(`/teachers/${id}/resend-credentials`, { method: 'POST' });
  },

  async revokeInvite(id) {
    return request(`/teachers/${id}/revoke-invite`, { method: 'POST' });
  },

  async suspendTeacher(id, reason) {
    const json = await request(`/teachers/${id}/suspend`, { method: 'POST', body: { reason } });
    return json.data;
  },

  async reactivateTeacher(id) {
    const json = await request(`/teachers/${id}/reactivate`, { method: 'POST' });
    return json.data;
  },

  async resetPassword(id) {
    return request(`/teachers/${id}/reset-password`, { method: 'POST' });
  },

  // Public teacher activation endpoints — no auth header needed/available.
  async verifyInviteToken(token) {
    try {
      const json = await request(`/teachers/invite/${token}`);
      return { valid: true, teacher: json.data };
    } catch (err) {
      return { valid: false, error: err.code, message: err.message };
    }
  },

  async activateTeacherAccount({ token, password }) {
    return request('/teachers/activate', { method: 'POST', body: { token, password } });
  },

  // ── Students ──────────────────────────────────────────────────────────
  async getStudents(params = {}) {
    const json = await request('/students', { query: params });
    return json.data || [];
  },

  async createStudent(studentData) {
    const json = await request('/students', { method: 'POST', body: studentData });
    return json.data;
  },

  async updateStudent(id, updateData) {
    const json = await request(`/students/${id}`, { method: 'PUT', body: updateData });
    return json.data;
  },

  async deleteStudent(id) {
    return request(`/students/${id}`, { method: 'DELETE' });
  },

  // ── Courses ───────────────────────────────────────────────────────────
  async getCourses(params = {}) {
    const json = await request('/courses', { query: params });
    return json.data || [];
  },

  async createCourse(courseData) {
    const json = await request('/courses', { method: 'POST', body: toCourseFormData(courseData), isFormData: true });
    return json.data;
  },

  async updateCourse(id, courseData) {
    const json = await request(`/courses/${id}`, { method: 'PUT', body: toCourseFormData(courseData), isFormData: true });
    return json.data;
  },

  async updateCourseStatus(id, status, notes) {
    const json = await request(`/courses/${id}/status`, { method: 'PATCH', body: { status, notes } });
    return json.data;
  },

  // ── Resources (magazines, event photos, program materials) ─────────────
  async getResources(params = {}) {
    const json = await request('/resources', { query: params });
    return { items: json.data || [], meta: json.meta };
  },

  async createResource(resourceData) {
    const json = await request('/resources', { method: 'POST', body: toResourceFormData(resourceData), isFormData: true });
    return json;
  },

  async updateResource(id, resourceData) {
    const json = await request(`/resources/${id}`, { method: 'PUT', body: toResourceFormData(resourceData), isFormData: true });
    return json;
  },

  async deleteResource(id) {
    return request(`/resources/${id}`, { method: 'DELETE' });
  },

  // ── Enrollments ───────────────────────────────────────────────────────
  async getEnrollments(params = {}) {
    const json = await request('/enrollments', { query: params });
    return json.data || [];
  },

  async createEnrollment(data) {
    const json = await request('/enrollments', { method: 'POST', body: data });
    return json.data;
  },

  // ── Announcements ─────────────────────────────────────────────────────
  async getAnnouncements(params = {}) {
    const json = await request('/announcements', { query: params });
    return json.data || [];
  },

  async createAnnouncement(data) {
    const json = await request('/announcements', { method: 'POST', body: data });
    return json.data;
  },

  async getTeacherAnnouncements(params = {}) {
    const json = await request('/announcements/teachers', { query: params });
    return json.data || [];
  },

  // ── Audit Logs ────────────────────────────────────────────────────────
  async getAuditLogs(params = {}) {
    const json = await request('/audit-logs', { query: params });
    return json.data || [];
  },

  // ── Notifications ─────────────────────────────────────────────────────
  async getNotifications(params = {}) {
    const json = await request('/notifications', { query: params });
    return { items: json.data || [], meta: json.meta };
  },

  async markNotificationRead(id) {
    return request(`/notifications/${id}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead() {
    return request('/notifications/read-all', { method: 'POST' });
  },

  // ── Payments ──────────────────────────────────────────────────────────
  async getPayments(params = {}) {
    const json = await request('/payments', { query: params });
    return { items: json.data || [], meta: json.meta };
  },

  async createPayment(data) {
    const json = await request('/payments', { method: 'POST', body: data });
    return json.data;
  },

  async updatePaymentStatus(id, status) {
    const json = await request(`/payments/${id}/status`, { method: 'PATCH', body: { status } });
    return json.data;
  },

  // ── Settings ──────────────────────────────────────────────────────────
  async getSettings() {
    const json = await request('/settings');
    return json.data;
  },

  async updateSettings(data) {
    const json = await request('/settings', { method: 'PUT', body: data });
    return json.data;
  },

  // ── Academics & System Health ─────────────────────────────────────────
  async getAcademicsOverview() {
    const json = await request('/academics/overview');
    return json.data;
  },

  async getAttendanceSummaries() {
    const json = await request('/academics/attendance-summaries');
    return json.data || [];
  },

  async getSystemHealth() {
    const json = await request('/system-health');
    return json.data || [];
  },

  // ── CSV Report Download ───────────────────────────────────────────────
  // A plain <a href> can't carry an Authorization header, so this fetches
  // the CSV as an authenticated blob and triggers a client-side download —
  // no token is ever put in the URL/browser history/server access logs.
  async downloadReport(type) {
    const res = await fetch(`${API_BASE}/reports/export?type=${encodeURIComponent(type)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || 'Failed to generate report');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nalanda-${type}-report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default adminApi;
