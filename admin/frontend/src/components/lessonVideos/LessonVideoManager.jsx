import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, RefreshCw, Lock, EyeOff, Film, ChevronDown, ChevronRight, HardDrive, Radio, Plus, Trash2 } from 'lucide-react';
import LessonVideoEditor from './LessonVideoEditor';
import YouTubeThumbnail from './YouTubeThumbnail';
import VideoActivityPanel from './VideoActivityPanel';
import { VIDEO_SOURCES, formatBytes, formatDuration, formatWhen, byline } from './videoFormat';

/**
 * Course → module → its one primary video, every module's state at a glance,
 * and the editor opened inline under whatever is being worked on. Lessons may
 * carry a video of their own as well; those are listed under each module.
 *
 * `api` is { listCourses(), getCourse(slug), inspect(url, opts),
 * save/update/remove(slug, target, payload), startUpload(slug, target, payload),
 * partUrls(slug, uploadId, numbers), resume(slug, uploadId),
 * complete(slug, uploadId, body), abortUpload(slug, uploadId),
 * listActivity?(slug), addModule?(slug, { title }), removeModule?(slug, moduleId) },
 * where target is { moduleId } or { lessonId }. Adding and deleting modules
 * goes through the course-structure API (the same one Course Content uses);
 * the controls appear only when the portal passes those two functions. Which
 * courses appear, and whether a change is allowed, is decided by the backend
 * behind it - the Admin portal sees every course, a teacher only their
 * assigned ones - never by this component.
 *
 * `live.subscribe(onChange, onReconnect)` delivers 'course_video.changed'
 * notices from the portal's socket. A notice only says what changed; the
 * course is then re-read through `api`, so the database stays the one source
 * of truth and a notice can never put something on screen by itself. A
 * reconnect (or the tab regaining focus) re-reads too, catching anything
 * missed while offline.
 *
 * Shared verbatim by the Admin and Teacher portals.
 */

const keyOf = (target) => (target.moduleId ? `m:${target.moduleId}` : `l:${target.lessonId}`);

function statusOf(node) {
  const v = node.video;
  if (!v) return node.legacyVideoUrl ? { label: 'Hosted file', cls: 'bg-[#22355E]/10 text-[#22355E]' } : null;
  if (v.availability === 'unavailable') return { label: 'Unavailable', cls: 'bg-[#C1352B]/15 text-[#9A2820]' };
  if (!v.isPublished) return { label: 'Draft', cls: 'bg-[#C99A2E]/15 text-[#7A5B12]' };
  if (v.availability === 'restricted') {
    return { label: v.provider === 'google_drive' ? 'Published · not shared publicly' : 'Published · embed off', cls: 'bg-[#C99A2E]/15 text-[#7A5B12]' };
  }
  return { label: 'Published', cls: 'bg-[#5C7A5E]/15 text-[#3F5A41]' };
}

function uploadStatusOf(node) {
  const u = node.activeUpload;
  if (!u) return null;
  const who = u.actor?.name ? ` by ${u.actor.name}` : '';
  if (u.status === 'processing') return { label: `Processing upload${who}`, cls: 'bg-[#22355E]/10 text-[#22355E]' };
  if (u.status === 'verified') return { label: 'Verified upload waiting', cls: 'bg-[#C99A2E]/15 text-[#7A5B12]' };
  return { label: `Uploading${who}`, cls: 'bg-[#22355E]/10 text-[#22355E]' };
}

function Pill({ status, testId }) {
  if (!status) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${status.cls}`} data-testid={testId}>
      {status.label}
    </span>
  );
}

function Thumb({ video, size = 'w-24 sm:w-28' }) {
  let inner;
  if (video?.provider === 'youtube') inner = <YouTubeThumbnail videoId={video.videoId} alt="" className="w-full h-full" />;
  else if (video?.provider === 'google_drive') inner = <HardDrive className="w-5 h-5 text-[#22355E]" aria-hidden="true" />;
  else if (video?.provider === 'upload') {
    inner = (
      <span className="flex flex-col items-center text-[#22355E]">
        <Film className="w-5 h-5" aria-hidden="true" />
        {Number.isFinite(video.duration) && <span className="text-[10px] font-semibold">{formatDuration(video.duration)}</span>}
      </span>
    );
  } else inner = <Film className="w-5 h-5 text-[#9B9690]" aria-hidden="true" />;
  return <div className={`${size} aspect-video rounded-lg overflow-hidden shrink-0 bg-[#EDEAE0] flex items-center justify-center`}>{inner}</div>;
}

function videoMeta(video) {
  if (!video) return '';
  const parts = [VIDEO_SOURCES[video.provider]?.label];
  if (video.provider === 'upload') parts.push(formatBytes(video.fileSize));
  const when = formatWhen(video.provider === 'upload' ? video.uploadedAt || video.updatedAt : video.updatedAt);
  if (when) parts.push(`${video.provider === 'upload' ? 'uploaded' : 'updated'} ${when}${byline(video) ? ` by ${byline(video)}` : ''}`);
  return parts.filter(Boolean).join(' · ');
}

const ACTION_NOTICE = {
  published: 'published a new video',
  link_saved: 'saved a draft video',
  unpublished: 'unpublished the video',
  removed: 'removed the video',
  upload_started: 'started uploading a video',
  upload_completed: 'uploaded a new video',
  upload_failed: 'had an upload fail',
  upload_aborted: 'cancelled an upload',
  availability_changed: 'availability changed',
  module_added: 'added a module',
  module_removed: 'deleted a module',
};

export default function LessonVideoManager({ api, portal = 'staff', heading, description, emptyMessage, live, refreshKey }) {
  const [courses, setCourses] = useState([]);
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [activitySignal, setActivitySignal] = useState(0);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [moduleBusy, setModuleBusy] = useState(null); // 'add' | moduleId being deleted
  const [confirmDelete, setConfirmDelete] = useState(null);
  const slugRef = useRef('');
  slugRef.current = slug;

  const loadCourses = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoadingCourses(true);
      if (!quiet) setError('');
      try {
        const list = (await api.listCourses()) || [];
        setCourses(list);
        setSlug((current) => (current && list.some((c) => c.slug === current) ? current : list[0]?.slug || ''));
      } catch (err) {
        if (!quiet) setError(err?.message || 'Could not load courses.');
      } finally {
        if (!quiet) setLoadingCourses(false);
      }
    },
    [api]
  );

  const loadContent = useCallback(
    async (courseSlug, { quiet = false } = {}) => {
      if (!courseSlug) {
        setContent(null);
        return;
      }
      if (!quiet) {
        setLoadingContent(true);
        setError('');
      }
      try {
        const data = await api.getCourse(courseSlug);
        // A slow answer for a course the editor has since left is dropped.
        if (slugRef.current === courseSlug) setContent(data);
      } catch (err) {
        if (!quiet) {
          setContent(null);
          setError(err?.message || 'Could not load this course.');
        }
      } finally {
        if (!quiet) setLoadingContent(false);
      }
    },
    [api]
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // An administrator assigning or removing a course reloads the list in place,
  // without remounting (which would cancel an upload in progress).
  const firstRefresh = useRef(true);
  useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false;
      return;
    }
    loadCourses({ quiet: true });
  }, [refreshKey, loadCourses]);

  useEffect(() => {
    setOpenKey(null);
    setNotice('');
    loadContent(slug);
  }, [slug, loadContent]);

  // Live updates: re-read (quietly) whatever course a notice is about.
  const pending = useRef(null);
  useEffect(() => {
    if (!live?.subscribe) return undefined;
    const reload = () => {
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        loadContent(slugRef.current, { quiet: true });
        loadCourses({ quiet: true });
        setActivitySignal((n) => n + 1);
      }, 300);
    };
    const onChange = (event) => {
      if (!event?.slug || event.slug !== slugRef.current) {
        loadCourses({ quiet: true });
        return;
      }
      reload();
      if (event.action && ACTION_NOTICE[event.action] && event.actor?.name) {
        const where = event.action.startsWith('module_') ? '' : ` on ${event.moduleId && !event.lessonId ? 'a module' : 'a lesson'}`;
        setNotice(`Live update: ${event.actor.name} (${event.actor.portal}) ${ACTION_NOTICE[event.action]}${where}.`);
      }
    };
    const unsubscribe = live.subscribe(onChange, reload);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(pending.current);
      unsubscribe?.();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [live, loadContent, loadCourses]);

  // Replaces one video in place, so saving never reloads (and collapses) the
  // page an editor is working through.
  const patchVideo = (target, video) => {
    setContent(
      (c) =>
        c && {
          ...c,
          modules: c.modules.map((m) =>
            target.moduleId
              ? m.moduleId === target.moduleId
                ? { ...m, video, activeUpload: null }
                : m
              : {
                  ...m,
                  lessons: m.lessons.map((l) => (l.lessonId === target.lessonId ? { ...l, video, activeUpload: null, legacyVideoUrl: video ? l.legacyVideoUrl : '' } : l)),
                }
          ),
        }
    );
  };

  const totals = useMemo(() => {
    const modules = content?.modules || [];
    const lessons = modules.flatMap((m) => m.lessons);
    const withVideo = modules.filter((m) => m.video).length;
    return {
      modules: modules.length,
      withVideo,
      withoutVideo: modules.length - withVideo,
      published: modules.filter((m) => m.video?.isPublished).length,
      uploading: modules.filter((m) => m.activeUpload).length + lessons.filter((l) => l.activeUpload).length,
      lessonVideos: lessons.filter((l) => l.video).length,
    };
  }, [content]);

  const currentCourse = courses.find((c) => c.slug === slug);
  const labels = useMemo(() => {
    const map = new Map();
    for (const m of content?.modules || []) {
      map.set(`module:${m.moduleId}`, m.title);
      for (const l of m.lessons) map.set(`lesson:${l.lessonId}`, `${m.title} › ${l.title}`);
    }
    return map;
  }, [content]);

  const renderEditor = (node, target, label) => (
    <div className="mt-3">
      <LessonVideoEditor
        key={keyOf(target)}
        lesson={node}
        uploadScope={`${portal}:${slug}:${keyOf(target)}`}
        uploadsEnabled={content?.uploadsEnabled !== false}
        maxUploadBytes={content?.maxUploadBytes}
        onBusyChange={setUploadBusy}
        api={{
          inspect: (url, opts) => api.inspect(url, opts),
          save: (payload) => api.save(slug, target, payload),
          update: (payload) => api.update(slug, target, payload),
          remove: (payload) => api.remove(slug, target, payload),
          startUpload: (payload) => api.startUpload(slug, target, payload),
          partUrls: (uploadId, partNumbers) => api.partUrls(slug, uploadId, partNumbers),
          resume: (uploadId) => api.resume(slug, uploadId),
          complete: (uploadId, body) => api.complete(slug, uploadId, body),
          abortUpload: (uploadId) => api.abortUpload(slug, uploadId),
        }}
        onSaved={(video, mode) => {
          patchVideo(target, video);
          setOpenKey(null);
          setUploadBusy(false);
          setActivitySignal((n) => n + 1);
          setNotice(
            mode === 'publish'
              ? `“${label}”: video published. Enrolled students see it now.`
              : mode === 'unpublish'
              ? `“${label}”: video unpublished. Students no longer see it.`
              : mode === 'details'
              ? `“${label}”: details saved.`
              : `“${label}”: saved as a draft. Students will not see it until it is published.`
          );
          loadCourses({ quiet: true });
        }}
        onRemoved={() => {
          patchVideo(target, null);
          setOpenKey(null);
          setActivitySignal((n) => n + 1);
          setNotice(`“${label}”: video removed. Students no longer see it.`);
          loadCourses({ quiet: true });
        }}
        onConflict={() => {
          // Show what is there now; the editor reopens on that version.
          setOpenKey(null);
          setUploadBusy(false);
          loadContent(slug, { quiet: true });
          setNotice(`“${label}” was changed by someone else. The list now shows the current version.`);
        }}
        onClose={() => {
          setOpenKey(null);
          setUploadBusy(false);
        }}
      />
    </div>
  );

  // Modules themselves: add one at the end, or delete one. The student
  // service refuses to delete a module with student history, quizzes or
  // assignments, and says why; that reason is shown as it comes.
  const addModule = async (e) => {
    e.preventDefault();
    const title = newModuleTitle.trim();
    if (!title || !api.addModule) return;
    setModuleBusy('add');
    setError('');
    setNotice('');
    try {
      await api.addModule(slug, { title });
      setNewModuleTitle('');
      await loadContent(slug, { quiet: true });
      loadCourses({ quiet: true });
      setNotice(`Module “${title}” added. Add its video below.`);
    } catch (err) {
      setError(err?.message || 'Could not add the module.');
    } finally {
      setModuleBusy(null);
    }
  };

  const removeModule = async (mod) => {
    if (!api.removeModule) return;
    setModuleBusy(mod.moduleId);
    setError('');
    setNotice('');
    try {
      await api.removeModule(slug, mod.moduleId);
      setConfirmDelete(null);
      if (openKey === keyOf({ moduleId: mod.moduleId }) || mod.lessons.some((l) => openKey === keyOf({ lessonId: l.lessonId }))) setOpenKey(null);
      await loadContent(slug, { quiet: true });
      loadCourses({ quiet: true });
      setNotice(`Module “${mod.title}” deleted.`);
    } catch (err) {
      setConfirmDelete(null);
      setError(err?.message || 'Could not delete the module.');
    } finally {
      setModuleBusy(null);
    }
  };

  const toggleButton = (key, hasVideo, label) => {
    const isOpen = openKey === key;
    return (
      <button
        type="button"
        onClick={() => {
          setNotice('');
          setOpenKey(isOpen ? null : key);
        }}
        disabled={uploadBusy && !isOpen}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Close editor for ${label}` : `${hasVideo ? 'Manage video' : 'Add video'}: ${label}`}
        className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
          isOpen ? 'bg-[#22355E] text-white' : hasVideo ? 'bg-[#EDEAE0] text-[#22355E] hover:bg-[#DFDACB]' : 'bg-[#AB5236] text-white hover:bg-[#94452C]'
        }`}
      >
        {isOpen ? 'Close' : hasVideo ? 'Manage video' : 'Add video'}
      </button>
    );
  };

  const modules = (content?.modules || []).filter((m) => !onlyMissing || !m.video);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] flex items-center gap-2">
            <Clapperboard className="w-6 h-6 text-[#AB5236]" /> {heading}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A64] mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {live?.subscribe && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3F5A41]" title="Changes from other editors appear here automatically">
              <Radio className="w-3.5 h-3.5" aria-hidden="true" /> Live
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              loadCourses();
              loadContent(slug);
            }}
            disabled={loadingCourses || loadingContent || uploadBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D8D3C5] text-xs font-semibold text-[#22355E] hover:bg-[#EDEAE0] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCourses || loadingContent ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="p-3.5 rounded-xl bg-[#5C7A5E]/10 border border-[#5C7A5E]/30 text-[#3F5A41] text-sm">
          {notice}
        </div>
      )}

      {loadingCourses ? (
        <div className="p-4 rounded-xl bg-white border border-[#D8D3C5] space-y-2" aria-busy="true">
          <div className="h-3 w-24 bg-[#EDEAE0] rounded animate-pulse" />
          <div className="h-9 w-full sm:w-96 bg-[#EDEAE0] rounded-lg animate-pulse" />
        </div>
      ) : courses.length === 0 ? (
        <div className="p-8 rounded-xl bg-white border border-[#D8D3C5] text-center text-sm text-[#6E6A64]">{emptyMessage}</div>
      ) : (
        <div className="p-4 rounded-xl bg-white border border-[#D8D3C5] space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-end gap-3 xl:gap-6">
            <div className="min-w-0 xl:flex-1">
              <label htmlFor="lesson-video-course" className="block text-xs font-semibold text-[#6E6A64] mb-1">
                Course
              </label>
              <select
                id="lesson-video-course"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={uploadBusy}
                className="w-full max-w-md bg-[#FAF9F4] border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] disabled:opacity-60"
              >
                {courses.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title}
                    {c.isPublished === false ? ' (unpublished)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {content && (
              <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs" data-testid="video-totals">
                <div>
                  <dt className="text-[#9B9690]">Modules</dt>
                  <dd className="font-bold text-[#22355E] text-base">{totals.modules}</dd>
                </div>
                <div>
                  <dt className="text-[#9B9690]">With video</dt>
                  <dd className="font-bold text-[#5C7A5E] text-base">{totals.withVideo}</dd>
                </div>
                <div>
                  <dt className="text-[#9B9690]">Without video</dt>
                  <dd className={`font-bold text-base ${totals.withoutVideo ? 'text-[#AB5236]' : 'text-[#22355E]'}`}>{totals.withoutVideo}</dd>
                </div>
                <div>
                  <dt className="text-[#9B9690]">Uploads in progress</dt>
                  <dd className="font-bold text-[#22355E] text-base">{totals.uploading}</dd>
                </div>
                <div>
                  <dt className="text-[#9B9690]">Lesson videos</dt>
                  <dd className="font-bold text-[#22355E] text-base">{totals.lessonVideos}</dd>
                </div>
              </dl>
            )}
          </div>
          {content && (
            <label className="inline-flex items-center gap-2 text-xs text-[#22355E]">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="accent-[#AB5236]" />
              Show only modules without a video
            </label>
          )}
          {content?.uploadsEnabled === false && (
            <p className="text-[11px] text-[#7A5B12] bg-[#C99A2E]/10 border border-[#C99A2E]/40 rounded-lg px-3 py-2">
              File uploads are switched off until the server's private video storage is configured. YouTube and Google Drive links work.
            </p>
          )}
        </div>
      )}

      {loadingContent && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-white border border-[#D8D3C5] p-4 space-y-3">
              <div className="h-4 w-48 bg-[#EDEAE0] rounded animate-pulse" />
              <div className="h-10 w-full bg-[#F5F3EC] rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!loadingContent && content && content.modules.length === 0 && (
        <div className="p-8 rounded-xl bg-white border border-[#D8D3C5] text-center text-sm text-[#6E6A64]">{currentCourse?.title || 'This course'} has no modules yet.</div>
      )}
      {!loadingContent && content && content.modules.length > 0 && modules.length === 0 && (
        <div className="p-6 rounded-xl bg-white border border-[#D8D3C5] text-center text-sm text-[#3F5A41]">Every module in this course has a video.</div>
      )}

      {!loadingContent &&
        modules.map((mod) => {
          const moduleTarget = { moduleId: mod.moduleId };
          const moduleKey = keyOf(moduleTarget);
          const moduleNode = {
            kind: 'module',
            lessonId: mod.moduleId,
            title: mod.title,
            video: mod.video || null,
            activeUpload: mod.activeUpload || null,
            legacyVideoUrl: '',
          };
          const lessonsOpen = expanded[mod.moduleId];
          const lessonVideos = mod.lessons.filter((l) => l.video).length;
          return (
            <section key={mod.moduleId} className="rounded-xl bg-white border border-[#D8D3C5] overflow-hidden" data-testid={`module-${mod.moduleId}`}>
              <div className="px-3 sm:px-4 py-3" data-testid={`module-video-${mod.moduleId}`}>
                <div className="flex items-center gap-3">
                  <Thumb video={mod.video} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#22355E] truncate">{mod.title}</p>
                    <p className="text-[11px] text-[#2B2B28] truncate">{mod.video ? mod.video.title || 'Untitled video' : 'No video yet'}</p>
                    <p className="text-[11px] text-[#9B9690] truncate">{videoMeta(mod.video)}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {mod.video ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#22355E]/10 text-[#22355E]" data-testid={`source-module-${mod.moduleId}`}>
                          {VIDEO_SOURCES[mod.video.provider]?.label}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#AB5236]/15 text-[#94452C]" data-testid={`source-module-${mod.moduleId}`}>
                          No video
                        </span>
                      )}
                      <Pill status={statusOf(moduleNode)} testId={`status-module-${mod.moduleId}`} />
                      <Pill status={uploadStatusOf(moduleNode)} testId={`upload-module-${mod.moduleId}`} />
                    </div>
                  </div>
                  {toggleButton(moduleKey, Boolean(mod.video), mod.title)}
                  {api.removeModule && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(confirmDelete === mod.moduleId ? null : mod.moduleId)}
                      disabled={uploadBusy || Boolean(moduleBusy)}
                      aria-label={`Delete module: ${mod.title}`}
                      title="Delete module"
                      className="shrink-0 p-2 rounded-lg text-[#C1352B] hover:bg-[#C1352B]/10 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {confirmDelete === mod.moduleId && (
                  <div
                    role="alert"
                    className="mt-3 p-3 rounded-lg bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    data-testid={`confirm-delete-${mod.moduleId}`}
                  >
                    <span>
                      Delete “{mod.title}”{mod.lessons.length ? ` and its ${mod.lessons.length} lesson${mod.lessons.length === 1 ? '' : 's'}` : ''}? Students stop seeing it at
                      once, and this cannot be undone. A module that students have started, or that has quizzes or assignments, cannot be deleted.
                    </span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => removeModule(mod)}
                        disabled={Boolean(moduleBusy)}
                        className="px-3 py-1.5 rounded-lg bg-[#C1352B] hover:bg-[#A42C23] text-white font-semibold disabled:opacity-60"
                      >
                        {moduleBusy === mod.moduleId ? 'Deleting…' : 'Yes, delete module'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        disabled={Boolean(moduleBusy)}
                        className="px-3 py-1.5 rounded-lg bg-[#EDEAE0] hover:bg-[#DFDACB] text-[#22355E] font-semibold"
                      >
                        Keep
                      </button>
                    </span>
                  </div>
                )}
                {openKey === moduleKey && renderEditor(moduleNode, moduleTarget, mod.title)}
              </div>

              {mod.lessons.length > 0 && (
                <div className="border-t border-[#EDEAE0] bg-[#FAF9F4]">
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [mod.moduleId]: !e[mod.moduleId] }))}
                    aria-expanded={Boolean(lessonsOpen)}
                    className="w-full px-4 py-2 flex items-center justify-between gap-2 text-left text-[11px] font-semibold text-[#6E6A64] hover:text-[#22355E]"
                  >
                    <span className="flex items-center gap-1.5">
                      {lessonsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Lesson videos (optional)
                    </span>
                    <span>
                      {lessonVideos}/{mod.lessons.length} lessons have their own video
                    </span>
                  </button>
                  {lessonsOpen && (
                    <ul className="divide-y divide-[#EDEAE0]">
                      {mod.lessons.map((lesson) => {
                        const target = { lessonId: lesson.lessonId };
                        const key = keyOf(target);
                        return (
                          <li key={lesson.lessonId} className="px-3 sm:px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Thumb video={lesson.video} size="w-20 sm:w-24" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#2B2B28] truncate">{lesson.title}</p>
                                <p className="text-[11px] text-[#9B9690] truncate">
                                  {lesson.video ? videoMeta(lesson.video) : lesson.duration ? lesson.duration : <span className="font-mono">{lesson.lessonId}</span>}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <Pill status={statusOf(lesson)} testId={`status-${lesson.lessonId}`} />
                                  <Pill status={uploadStatusOf(lesson)} testId={`upload-${lesson.lessonId}`} />
                                  {!lesson.isPublished && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#9B9690]/15 text-[#6E6A64] inline-flex items-center gap-1">
                                      <EyeOff className="w-2.5 h-2.5" /> Lesson hidden
                                    </span>
                                  )}
                                  {lesson.isLocked && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#9B9690]/15 text-[#6E6A64] inline-flex items-center gap-1">
                                      <Lock className="w-2.5 h-2.5" /> Locked
                                    </span>
                                  )}
                                </div>
                              </div>
                              {toggleButton(key, Boolean(lesson.video), lesson.title)}
                            </div>
                            {openKey === key && renderEditor({ ...lesson, kind: 'lesson' }, target, lesson.title)}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}

      {!loadingContent && content && api.addModule && (
        <form
          onSubmit={addModule}
          className="p-4 rounded-xl bg-white border border-dashed border-[#D8D3C5] flex flex-col sm:flex-row sm:items-end gap-3"
          data-testid="add-module"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="new-module-title" className="block text-xs font-semibold text-[#22355E] mb-1">
              Add a module to {currentCourse?.title || 'this course'}
            </label>
            <input
              id="new-module-title"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              maxLength={200}
              placeholder={`Module ${content.modules.length + 1}: …`}
              disabled={uploadBusy || Boolean(moduleBusy)}
              className="w-full bg-[#FAF9F4] border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!newModuleTitle.trim() || uploadBusy || Boolean(moduleBusy)}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#22355E] hover:bg-[#16233F] text-white disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> {moduleBusy === 'add' ? 'Adding…' : 'Add module'}
          </button>
        </form>
      )}

      {content && api.listActivity && (
        <VideoActivityPanel
          key={slug}
          title={`Recent video activity · ${currentCourse?.title || slug}`}
          load={() => api.listActivity(slug)}
          labelFor={(e) => labels.get(`${e.targetType}:${e.targetId}`) || e.targetId}
          refreshSignal={activitySignal}
          emptyText="No video changes in this course yet."
        />
      )}
    </div>
  );
}
