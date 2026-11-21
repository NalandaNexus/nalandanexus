// The editor is deliberately shared with the Teacher Portal. Both portals
// call their own authenticated API adapters, while the UI and multipart retry
// semantics stay identical so a video behaves the same after an admin takeover.
export { default } from '../../../../../teacher/frontend/src/components/lessonVideos/LessonVideoEditor.jsx';
