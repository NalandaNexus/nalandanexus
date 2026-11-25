import React, { useEffect, useState } from 'react';
import CourseStructureManager from '../components/courseContent/CourseStructureManager';
import { teacherApiService } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

/**
 * Module and lesson structure for the courses an administrator has assigned
 * to this teacher. The list and every save are scoped by the backend's own
 * CourseAccess records; this page only shows what it is given.
 */

const API = {
  // The same course list Lesson Videos uses - both read this teacher's
  // CourseAccess-assigned courses, not a second, independent list.
  listCourses: () => teacherApiService.getLessonVideoCourses(),
  getStructure: (slug) => teacherApiService.getCourseStructure(slug),
  addModule: (slug, payload) => teacherApiService.addCourseModule(slug, payload),
  updateModule: (slug, moduleId, payload) => teacherApiService.updateCourseModule(slug, moduleId, payload),
  reorderModules: (slug, orderedModuleIds) => teacherApiService.reorderCourseModules(slug, orderedModuleIds),
  addLesson: (slug, moduleId, payload) => teacherApiService.addCourseLesson(slug, moduleId, payload),
  updateLesson: (slug, moduleId, lessonId, payload) => teacherApiService.updateCourseLesson(slug, moduleId, lessonId, payload),
  reorderLessons: (slug, moduleId, orderedLessonIds) => teacherApiService.reorderCourseLessons(slug, moduleId, orderedLessonIds),
  removeLesson: (slug, moduleId, lessonId, payload) => teacherApiService.removeCourseLesson(slug, moduleId, lessonId, payload),
};

export default function CourseContentPage() {
  // An administrator assigning or removing a course reloads the list live.
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    socketService.connect();
    const bump = () => setGeneration((g) => g + 1);
    const offs = ['course.access_changed', 'course.assigned', 'course.unassigned'].map((e) => socketService.on(e, bump));
    return () => offs.forEach((off) => off());
  }, []);

  return (
    <CourseStructureManager
      key={generation}
      api={API}
      heading="Course Content"
      description="Rename, reorder, add or remove modules and lessons on your assigned courses. A student sees a lesson only once it is published."
      emptyMessage="No courses have been assigned to you yet. An administrator assigns courses from the Admin portal."
    />
  );
}
