import React from 'react';
import LessonVideoManager from '../components/lessonVideos/LessonVideoManager';
import { adminApi } from '../services/adminApi';

/**
 * YouTube videos on every course's lessons - PRARAMBH, GARUD, YODDHA and any
 * course bridged from this portal. The backend route sits behind
 * `courses.manage`, like Course Subjects.
 */

// Module-level so the manager's effects see one stable object across renders.
const API = {
  listCourses: () => adminApi.getLessonVideoCourses(),
  getCourse: (slug) => adminApi.getLessonVideos(slug),
  inspect: (url, opts) => adminApi.inspectLessonVideo(url, opts),
  save: (slug, target, payload) => adminApi.saveCourseVideo(slug, target, payload),
  remove: (slug, target, payload) => adminApi.removeCourseVideo(slug, target, payload),
  startUpload: (slug, target, payload) => adminApi.startCourseVideoUpload(slug, target, payload),
  partUrls: (uploadId, partNumbers) => adminApi.getCourseVideoPartUrls(uploadId, partNumbers),
  completeUpload: (uploadId, payload) => adminApi.completeCourseVideoUpload(uploadId, payload),
  abortUpload: (uploadId) => adminApi.abortCourseVideoUpload(uploadId),
};

export default function LessonVideosPage() {
  return (
    <LessonVideoManager
      api={API}
      heading="Module Videos"
      description="Monitor, upload, replace, or remove the primary video for every module and lesson. Students receive verified changes immediately."
      emptyMessage="No courses were found in the student catalogue."
    />
  );
}
