import { couponCall as callStudentBridge } from './studentCourseBridge.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Module/lesson structure for any course - Prarambh, Garud, Yoddha and every
 * bridged course alike, mirroring lesson videos exactly: this portal holds no
 * modules or lessons, so every call here forwards to the student service
 * (which owns them and is the only writer) over the same retrying,
 * error-propagating leg the rest of studentCourseBridge.service.js already
 * uses for coupons, progression and lesson videos - reused rather than
 * duplicated, with only the "unavailable" message reworded for course content.
 */
async function call(path, options) {
  try {
    return await callStudentBridge(path, options);
  } catch (err) {
    if (err?.code === 'STUDENT_SERVICE_UNAVAILABLE') {
      throw ApiError.serviceUnavailable(
        'The Student service is unavailable, so course content cannot be loaded or saved right now. Nothing was changed - please try again in a moment.',
        'STUDENT_SERVICE_UNAVAILABLE'
      );
    }
    throw err;
  }
}

const base = (slug) => `/api/internal/course-structure/courses/${encodeURIComponent(slug)}`;

export async function getCourseStructure(slug) {
  const body = await call(base(slug), { method: 'GET' });
  return body?.data || null;
}

export async function updateCourseSettings(slug, payload) {
  const body = await call(base(slug), { method: 'PATCH', body: JSON.stringify(payload) });
  return body?.data || null;
}

export async function addModule(slug, payload) {
  const body = await call(`${base(slug)}/modules`, { method: 'POST', body: JSON.stringify(payload) });
  return body?.data || null;
}

export async function updateModule(slug, moduleId, payload) {
  const body = await call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return body?.data || null;
}

export async function reorderModules(slug, payload) {
  const body = await call(`${base(slug)}/modules/order`, { method: 'PUT', body: JSON.stringify(payload) });
  return body?.data || null;
}

export async function addLesson(slug, moduleId, payload) {
  const body = await call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return body?.data || null;
}

export async function updateLesson(slug, moduleId, lessonId, payload) {
  const body = await call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return body?.data || null;
}

export async function reorderLessons(slug, moduleId, payload) {
  const body = await call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons/order`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return body?.data || null;
}

export async function removeLesson(slug, moduleId, lessonId, payload) {
  const body = await call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'DELETE',
    body: JSON.stringify(payload || {}),
  });
  return body?.data || null;
}

/**
 * Preview-before-flip for the mandatory-progression gate: reports exactly
 * which actively-enrolled students would newly lose access to which module
 * or lesson if this course's gate were turned on right now - the required
 * first step before actually flipping `progressionGatingEnabled`, per the
 * rollout-safety plan. Writes nothing; there is no audit log entry for a
 * preview, same as getCourseStructure above.
 */
export async function previewGatingImpact(slug) {
  // The student service mounts every internal route under /api/internal; without
  // the prefix this preview answered 404 and the button could never work.
  const body = await call('/api/internal/progression/module-gating/dry-run', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  });
  return body?.data?.reports?.[0] || null;
}

export default {
  getCourseStructure,
  updateCourseSettings,
  addModule,
  updateModule,
  reorderModules,
  addLesson,
  updateLesson,
  reorderLessons,
  removeLesson,
  previewGatingImpact,
};
