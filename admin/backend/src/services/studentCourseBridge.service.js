import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Bridges an APPROVED admin-authored course into student/backend's real
 * purchasable Course catalog — a separate service/database. Mirrors
 * studentBridge.service.js's announcement bridge exactly (shared-secret
 * auth, idempotent on sourceId), reusing the same STUDENT_BACKEND_* config.
 *
 * Non-destructive by design: this never deletes a course on the student
 * side (students may already have paid for it) — "retract" unpublishes it
 * (isPurchasable/isPublished: false) rather than removing it.
 */

function isConfigured() {
  return Boolean(env.studentBridge.url && env.studentBridge.serviceKey);
}

async function call(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${env.studentBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.studentBridge.serviceKey, ...options.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Student backend returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Publishes (creates or updates) a course in the real student catalog. Never throws; returns a real status. */
export async function publishCourseToStudents(course) {
  if (!isConfigured()) return { synced: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/courses', {
      method: 'POST',
      body: JSON.stringify({
        sourceId: String(course._id),
        slug: course.slug,
        title: course.title,
        description: course.description || '',
        features: course.features || [],
        priceInPaise: course.priceInPaise || 0,
        // Resolved to an absolute URL here (this backend already serves
        // /uploads statically) - student backend just stores whatever it's
        // given, no extra config needed on that side, mirroring how
        // teacher/backend's resource bridge resolves its own file URLs.
        image: course.image ? `${env.serverUrl}${course.image}` : null,
      }),
    });
    return { synced: true };
  } catch (err) {
    console.error('[studentCourseBridge] Failed to publish course to student catalog:', err.message);
    return { synced: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Unpublishes a previously-bridged course (status left ARCHIVED/REJECTED here). Never deletes — existing enrollments must stay resolvable. */
export async function unpublishCourseFromStudents(sourceId) {
  if (!isConfigured()) return { synced: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/courses/${sourceId}/unpublish`, { method: 'PATCH' });
    return { synced: true };
  } catch (err) {
    console.error('[studentCourseBridge] Failed to unpublish course from student catalog:', err.message);
    return { synced: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Coupon administration, proxied to the student service.
 *
 * Unlike the publish/unpublish bridges above - which are best-effort side
 * channels - these THROW on failure. An admin pressing "Generate" needs to know
 * whether 25 free places now exist, and a swallowed error there would be
 * answered by silence.
 */
function couponsUnavailable() {
  return ApiError.serviceUnavailable(
    'The Student service is unavailable, so coupons cannot be managed right now. Nothing was changed - please try again in a moment.',
    'STUDENT_SERVICE_UNAVAILABLE'
  );
}

async function couponCall(path, options) {
  if (!isConfigured()) throw couponsUnavailable();
  try {
    return await call(path, options);
  } catch (err) {
    // A 4xx is the student service rejecting this on its merits (unknown
    // course, a campaign name already in use); that judgement is the useful
    // one and must reach the admin rather than being flattened into
    // "unavailable".
    //
    // Its body is unwrapped rather than passed through: `call` puts the whole
    // JSON payload into the error message, and forwarding that verbatim put a
    // raw {"success":false,...} blob on screen where a sentence belonged.
    const match = /returned (\d{3}):\s*([\s\S]*)$/.exec(err.message);
    const status = Number(match?.[1]);
    if (status >= 400 && status < 500) {
      let message = match?.[2] || err.message;
      let code = 'COUPON_REJECTED';
      try {
        const body = JSON.parse(message);
        message = body?.error?.message || body?.message || message;
        code = body?.error?.code || code;
      } catch {
        // Not JSON - the raw text is still better than nothing.
      }
      throw ApiError.unprocessable(message, code);
    }
    console.error('[studentCourseBridge] Coupon administration failed:', err.message);
    throw couponsUnavailable();
  }
}

export async function listCoupons(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '' && v !== 'ALL') params.set(k, v);
  const qs = params.toString();
  const body = await couponCall(`/api/internal/coupons${qs ? `?${qs}` : ''}`, { method: 'GET' });
  return { coupons: body?.data || [], summary: body?.meta?.summary || {} };
}

export async function createCampaign(payload) {
  const body = await couponCall('/api/internal/coupon-campaigns', { method: 'POST', body: JSON.stringify(payload) });
  return body?.data || { campaign: null, coupons: [] };
}

export async function listCampaigns(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, v);
  const qs = params.toString();
  const body = await couponCall(`/api/internal/coupon-campaigns${qs ? `?${qs}` : ''}`, { method: 'GET' });
  return body?.data || [];
}

export async function exportCampaign(id) {
  const body = await couponCall(`/api/internal/coupon-campaigns/${encodeURIComponent(id)}/export`, { method: 'GET' });
  return body?.data || { campaign: null, coupons: [] };
}

export async function updateCoupon(id, payload) {
  const body = await couponCall(`/api/internal/coupons/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  return body?.data || null;
}

export async function deleteCoupon(id) {
  await couponCall(`/api/internal/coupons/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export default {
  listCoupons,
  createCampaign,
  listCampaigns,
  exportCampaign,
  updateCoupon,
  deleteCoupon, publishCourseToStudents, unpublishCourseFromStudents };
