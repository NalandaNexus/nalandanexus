/**
 * Centralized API client for the Nalanda Nexus backend.
 *
 * - Single base URL (VITE_API_URL, or VITE_STUDENT_API_URL to match the
 *   admin/teacher portals' naming convention - both are accepted so a
 *   deploy-time env var name mismatch can't silently fall back to
 *   localhost), single place to attach auth headers, normalize errors,
 *   and transparently refresh an expired access token.
 * - Access token is kept in memory (module-level) + mirrored into
 *   sessionStorage only so it survives a hard page reload without relying
 *   on a JS-readable long-lived secret in localStorage. The *real* session
 *   persistence is the httpOnly refresh-token cookie the backend sets -
 *   this in-memory token is just a short-lived convenience copy.
 */
const API_BASE_URL =
  import.meta.env.VITE_STUDENT_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Origin that serves backend-hosted files (avatars under /uploads/...).
 * The API returns those as ROOT-RELATIVE paths ("/uploads/avatars/x.png").
 * Rendering them directly resolves against the frontend origin, which on a
 * split-domain deployment (frontend on Vercel, backend on Render) 404s every
 * uploaded avatar - confirmed live. Strip the trailing "/api" to get the
 * backend origin and prefix such paths with it.
 */
const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

/** Absolute URL for a backend-served asset path; passes through absolute URLs, data: URIs and empty values. */
export function resolveAssetUrl(pathOrUrl) {
  if (!pathOrUrl) return pathOrUrl;
  if (/^(https?:)?\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('data:')) return pathOrUrl;
  if (pathOrUrl.startsWith('/uploads/')) return `${ASSET_BASE_URL}${pathOrUrl}`;
  return pathOrUrl;
}

let accessToken = null;
try {
  accessToken = sessionStorage.getItem('nalanda_access_token') || null;
} catch {
  accessToken = null;
}

let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
  try {
    if (token) sessionStorage.setItem('nalanda_access_token', token);
    else sessionStorage.removeItem('nalanda_access_token');
  } catch {
    // sessionStorage unavailable (e.g. private mode) - in-memory token still works for this tab session.
  }
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function rawRequest(path, { method = 'GET', body, skipAuth = false, isRetry = false } = {}) {
  // A FormData body (file uploads) must NOT be JSON-stringified, and must
  // NOT get an explicit Content-Type - the browser sets one itself
  // (multipart/form-data with the correct boundary) only when it's absent.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (!skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // send/receive httpOnly refresh cookie
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (res.ok) {
    return payload;
  }

  const code = payload?.error?.code;

  // Access token expired - try exactly one silent refresh, then retry the original request.
  if (res.status === 401 && !skipAuth && !isRetry && (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN' || code === 'NO_TOKEN')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return rawRequest(path, { method, body, skipAuth, isRetry: true });
    }
  }

  throw new ApiError(payload?.error?.message || 'Something went wrong. Please try again.', {
    status: res.status,
    code: code || 'UNKNOWN_ERROR',
    details: payload?.error?.details,
  });
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const payload = await res.json();
        setAccessToken(payload?.data?.accessToken || null);
        return Boolean(payload?.data?.accessToken);
      })
      .catch(() => {
        setAccessToken(null);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export const apiClient = {
  get: (path) => rawRequest(path, { method: 'GET' }),
  post: (path, body, opts) => rawRequest(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => rawRequest(path, { method: 'PATCH', body }),
  delete: (path) => rawRequest(path, { method: 'DELETE' }),
  tryRefreshSession: refreshAccessToken,
};
