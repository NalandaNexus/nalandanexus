import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * A real, propagating HTTP client for the student backend's service-key
 * bridge - distinct from studentBridge.service.js's best-effort, never-throws
 * push helpers (announcements, resources, grades, ...), where a delivery
 * failure is always tolerable because the teacher-side record is already the
 * source of truth. Lesson videos and course structure are the opposite: the
 * student backend OWNS that data, so "did this save" has to reach the caller
 * as a real answer, not a silently-dropped best-effort attempt.
 *
 * The student service sleeps when idle and can take 30-60s to answer the
 * first request. Two attempts, the second long enough to outlast a cold
 * start; only transport failures and 5xx are retried. Safe to retry blindly
 * because every caller here targets one specific record with PUT/PATCH/POST/
 * DELETE (never "append one more"), so a retried request repeats the same
 * effect rather than duplicating it.
 */
const ATTEMPT_TIMEOUTS_MS = [8000, 35000];
const RETRY_BACKOFF_MS = 1000;

/** `label` fills "...so {label}." in the unavailable message, e.g. "lesson videos cannot be loaded or saved right now". */
function unavailable(label) {
  return ApiError.serviceUnavailable(
    `The Student service is unavailable, so ${label}. Nothing was changed - please try again in a moment.`,
    'STUDENT_SERVICE_UNAVAILABLE'
  );
}

async function attempt(path, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.studentBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.studentBridge.serviceKey },
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (res.ok) return { body };
    if (res.status >= 400 && res.status < 500) {
      // The student service judged the request on its merits (unknown
      // course/module/lesson, a stale expectedUpdatedAt, a rejected edit).
      // That answer is the useful one, so its status and code reach the
      // caller unchanged rather than being flattened into a generic failure.
      const err = new ApiError(
        res.status,
        body?.error?.message || body?.message || 'The Student service rejected this request.',
        body?.error?.code || body?.code || 'STUDENT_SERVICE_REJECTED',
        body?.error?.details
      );
      err.retryable = false;
      throw err;
    }
    const err = new Error(`Student backend returned ${res.status}`);
    err.retryable = true;
    throw err;
  } catch (err) {
    if (err instanceof ApiError || err.retryable !== undefined) throw err;
    const wrapped = new Error(err.name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : err.message);
    wrapped.retryable = true;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls one student-backend internal route, retrying transport failures and
 * 5xx once. Resolves to the route's `data` payload (or null). A 4xx from the
 * student service is re-thrown as the same ApiError status/code/message/
 * details it answered with; anything else that still fails after retrying
 * becomes a 503 STUDENT_SERVICE_UNAVAILABLE naming `label`.
 */
export async function callStudentBridge(path, options, label) {
  if (!env.studentBridge.url || !env.studentBridge.serviceKey) throw unavailable(label);
  let last;
  for (let i = 0; i < ATTEMPT_TIMEOUTS_MS.length; i += 1) {
    try {
      const { body } = await attempt(path, options, ATTEMPT_TIMEOUTS_MS[i]);
      return body?.data ?? null;
    } catch (err) {
      last = err;
      if (!err.retryable || i === ATTEMPT_TIMEOUTS_MS.length - 1) break;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    }
  }
  if (last instanceof ApiError) throw last;
  console.error('[studentBridgeClient] Student service call failed:', path, last?.message);
  throw unavailable(label);
}

export default { callStudentBridge };
