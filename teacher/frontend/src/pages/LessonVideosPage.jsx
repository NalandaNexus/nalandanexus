import React, { useEffect, useState } from 'react';
import LessonVideoManager from '../components/lessonVideos/LessonVideoManager';
import { teacherApiService } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

/**
 * Module videos on the courses an administrator has assigned to this teacher:
 * upload a file, or attach a YouTube or Google Drive link, for each module.
 * The list and every change are scoped by the backend's own assignment
 * records; this page only shows what it is given.
 */

// Module-level so the manager's effects see one stable object across renders.
const API = {
  listCourses: () => teacherApiService.getLessonVideoCourses(),
  getCourse: (slug) => teacherApiService.getLessonVideos(slug),
  listActivity: (slug) => teacherApiService.getLessonVideoActivity(slug),
  inspect: (url, opts) => teacherApiService.inspectLessonVideo(url, opts),
  save: (slug, target, payload) => teacherApiService.saveCourseVideo(slug, target, payload),
  update: (slug, target, payload) => teacherApiService.updateCourseVideo(slug, target, payload),
  remove: (slug, target, payload) => teacherApiService.removeCourseVideo(slug, target, payload),
  startUpload: (slug, target, payload) => teacherApiService.startCourseVideoUpload(slug, target, payload),
  partUrls: (slug, uploadId, partNumbers) => teacherApiService.getCourseVideoPartUrls(slug, uploadId, partNumbers),
  resume: (slug, uploadId) => teacherApiService.resumeCourseVideoUpload(slug, uploadId),
  complete: (slug, uploadId, body) => teacherApiService.completeCourseVideoUpload(slug, uploadId, body),
  abortUpload: (slug, uploadId) => teacherApiService.abortCourseVideoUpload(slug, uploadId),
};

// Live notices for this teacher's courses (the backend only sends those), and
// a re-read whenever the socket reconnects.
const LIVE = {
  subscribe(onChange, onReconnect) {
    socketService.connect();
    let wasConnected = socketService.isConnected;
    const offChange = socketService.on('course_video.changed', onChange);
    const offStatus = socketService.on('connection:status', ({ isConnected } = {}) => {
      if (isConnected && !wasConnected) onReconnect?.();
      wasConnected = Boolean(isConnected);
    });
    return () => {
      offChange?.();
      offStatus?.();
    };
  },
};

export default function LessonVideosPage() {
  // An administrator assigning or removing a course reloads the course list
  // in place - never a remount, which would cancel an upload in progress.
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    socketService.connect();
    const bump = () => setRefreshKey((g) => g + 1);
    const offs = ['course.access_changed', 'course.assigned', 'course.unassigned'].map((e) => socketService.on(e, bump));
    return () => offs.forEach((off) => off?.());
  }, []);

  return (
    <LessonVideoManager
      portal="teacher"
      api={API}
      live={LIVE}
      refreshKey={refreshKey}
      heading="Module Videos"
      description="Upload a video file, or attach a YouTube or Google Drive link, for each module of your courses. Students see a video as soon as it is published - an uploaded file once it is verified."
      emptyMessage="No courses have been assigned to you yet. An administrator assigns courses from the Admin portal."
    />
  );
}
