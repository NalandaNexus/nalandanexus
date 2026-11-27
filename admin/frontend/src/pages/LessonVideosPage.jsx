import React from 'react';
import LessonVideoManager from '../components/lessonVideos/LessonVideoManager';
import VideoActivityPanel from '../components/lessonVideos/VideoActivityPanel';
import { adminApi } from '../services/adminApi';
import { getSocket } from '../services/socket';

/**
 * Module videos on every course - PRARAMBH, GARUD, YODDHA and any course
 * bridged from this portal: which modules have a video and which do not, its
 * source, its upload and processing state, who put it there, and every
 * failure. Administrators can add, replace or remove any of them. The backend
 * routes sit behind `courses.manage`, like Course Subjects.
 */

// Module-level so the manager's effects see one stable object across renders.
const API = {
  listCourses: () => adminApi.getLessonVideoCourses(),
  getCourse: (slug) => adminApi.getLessonVideos(slug),
  listActivity: (slug) => adminApi.getVideoActivity({ slug, limit: 50 }),
  inspect: (url, opts) => adminApi.inspectLessonVideo(url, opts),
  save: (slug, target, payload) => adminApi.saveCourseVideo(slug, target, payload),
  update: (slug, target, payload) => adminApi.updateCourseVideo(slug, target, payload),
  remove: (slug, target, payload) => adminApi.removeCourseVideo(slug, target, payload),
  startUpload: (slug, target, payload) => adminApi.startCourseVideoUpload(slug, target, payload),
  partUrls: (slug, uploadId, partNumbers) => adminApi.getCourseVideoPartUrls(slug, uploadId, partNumbers),
  resume: (slug, uploadId) => adminApi.resumeCourseVideoUpload(slug, uploadId),
  complete: (slug, uploadId, body) => adminApi.completeCourseVideoUpload(slug, uploadId, body),
  abortUpload: (slug, uploadId) => adminApi.abortCourseVideoUpload(slug, uploadId),
  addModule: (slug, payload) => adminApi.addCourseModule(slug, payload),
  removeModule: (slug, moduleId) => adminApi.removeCourseModule(slug, moduleId),
};

// Every signed-in administrator hears about every video change, whoever made it.
const LIVE = {
  subscribe(onChange, onReconnect) {
    const socket = getSocket();
    let seenConnect = socket.connected;
    const onConnect = () => {
      // The first connect is the page loading; later ones are reconnections.
      if (seenConnect) onReconnect?.();
      seenConnect = true;
    };
    socket.on('course_video.changed', onChange);
    socket.on('connect', onConnect);
    return () => {
      socket.off('course_video.changed', onChange);
      socket.off('connect', onConnect);
    };
  },
};

const loadProblems = () => adminApi.getVideoActivity({ level: 'problems', limit: 50 });

export default function LessonVideosPage() {
  return (
    <div className="space-y-6">
      <LessonVideoManager
        portal="admin"
        api={API}
        live={LIVE}
        heading="Module Videos"
        description="Every module's video across all courses: upload a file or attach a YouTube or Google Drive link, replace or remove it. Changes reach students and teachers immediately; an uploaded file once it is verified."
        emptyMessage="No courses were found in the student catalogue."
      />
      <VideoActivityPanel
        title="Video problems across all courses"
        load={loadProblems}
        showCourse
        emptyText="No failed uploads, broken links or storage clean-up errors."
      />
    </div>
  );
}
