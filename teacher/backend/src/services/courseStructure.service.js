import { callStudentBridge } from './studentBridgeClient.service.js';

/**
 * Module/lesson structure for the courses a teacher is assigned - the
 * teacher-side half of the same course-structure bridge the student service
 * exposes to Admin. Course assignment (CourseAccess) is checked once per
 * request by the caller (courseStructure.controller.js, via
 * assertCourseAccess), before any of these run; nothing here re-checks it,
 * matching how lessonVideo.service.js's own functions trust the slug they
 * are handed.
 *
 * Modules and lessons live only in the student service; every write here is
 * forwarded there over the service-key bridge and comes back with the
 * whole course's current structure, so the caller never needs a second
 * round trip to see the effect of its own write.
 */

const UNAVAILABLE_LABEL = 'course content cannot be loaded or saved right now';
const base = (slug) => `/api/internal/course-structure/courses/${encodeURIComponent(slug)}`;

async function call(path, options) {
  return callStudentBridge(path, options, UNAVAILABLE_LABEL);
}

export async function getCourseStructure(slug) {
  return call(base(slug), { method: 'GET' });
}

export async function updateCourseSettings(slug, body) {
  return call(base(slug), { method: 'PATCH', body: JSON.stringify(body) });
}

export async function addModule(slug, body) {
  return call(`${base(slug)}/modules`, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateModule(slug, moduleId, body) {
  return call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function reorderModules(slug, body) {
  return call(`${base(slug)}/modules/order`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function addLesson(slug, moduleId, body) {
  return call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons`, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateLesson(slug, moduleId, lessonId, body) {
  return call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function reorderLessons(slug, moduleId, body) {
  return call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons/order`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function removeModule(slug, moduleId, body) {
  return call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}`, {
    method: 'DELETE',
    body: JSON.stringify(body || {}),
  });
}

export async function removeLesson(slug, moduleId, lessonId, body) {
  return call(`${base(slug)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'DELETE',
    body: JSON.stringify(body || {}),
  });
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
  removeModule,
  removeLesson,
};
