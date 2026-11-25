import React from 'react';
import CourseStructureManager from '../components/courseContent/CourseStructureManager';
import { adminApi } from '../services/adminApi';

/**
 * Module and lesson structure for every course - PRARAMBH, GARUD, YODDHA and
 * any course bridged from this portal. The backend route sits behind
 * `courses.manage`, like Lesson Videos and Course Subjects.
 */

// Module-level so the manager's effects see one stable object across renders.
const API = {
  // The same course list Lesson Videos uses - both read the student
  // service's catalogue, not this portal's own governance records.
  listCourses: () => adminApi.getLessonVideoCourses(),
  getStructure: (slug) => adminApi.getCourseStructure(slug),
  addModule: (slug, payload) => adminApi.addCourseModule(slug, payload),
  updateModule: (slug, moduleId, payload) => adminApi.updateCourseModule(slug, moduleId, payload),
  reorderModules: (slug, orderedModuleIds) => adminApi.reorderCourseModules(slug, orderedModuleIds),
  addLesson: (slug, moduleId, payload) => adminApi.addCourseLesson(slug, moduleId, payload),
  updateLesson: (slug, moduleId, lessonId, payload) => adminApi.updateCourseLesson(slug, moduleId, lessonId, payload),
  reorderLessons: (slug, moduleId, orderedLessonIds) => adminApi.reorderCourseLessons(slug, moduleId, orderedLessonIds),
  removeLesson: (slug, moduleId, lessonId, payload) => adminApi.removeCourseLesson(slug, moduleId, lessonId, payload),
  updateCourseSettings: (slug, payload) => adminApi.updateCourseSettings(slug, payload),
  previewGatingImpact: (slug) => adminApi.previewCourseGatingImpact(slug),
};

export default function CourseContentPage() {
  return (
    <CourseStructureManager
      api={API}
      heading="Course Content"
      description="Rename, reorder, add or remove modules and lessons. A student sees a lesson only once it is published."
      emptyMessage="No courses were found in the student catalogue."
      canManageGating
    />
  );
}
