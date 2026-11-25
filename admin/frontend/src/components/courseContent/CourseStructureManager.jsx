import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Pencil,
  EyeOff,
  Lock,
  Film,
  FolderTree,
  ShieldCheck,
  ShieldOff,
  Eye,
} from 'lucide-react';
import ModuleEditor from './ModuleEditor';
import LessonEditor from './LessonEditor';

/**
 * Course → module → lesson: rename, reorder, add, edit or remove, on top of
 * whatever courses the backend behind `api` allows - every course for Admin,
 * only assigned ones for a Teacher. Shared verbatim by both portals, the same
 * way LessonVideoManager is.
 *
 * `api` is { listCourses(), getStructure(slug), addModule(slug, payload),
 * updateModule(slug, moduleId, payload), reorderModules(slug,
 * orderedModuleIds), addLesson(slug, moduleId, payload), updateLesson(slug,
 * moduleId, lessonId, payload), reorderLessons(slug, moduleId,
 * orderedLessonIds), removeLesson(slug, moduleId, lessonId, payload),
 * updateCourseSettings?(slug, payload), previewGatingImpact?(slug) }. The
 * last two are optional - they only matter when `canManageGating` is true.
 *
 * Every write except removeLesson answers with the course's full, fresh
 * structure, so a successful save simply replaces local state outright - no
 * hand-patching needed. A version conflict (409) is the one case that
 * instead patches just the one module or lesson the server says is now
 * current, so the rest of an in-progress edit elsewhere on the page is not
 * discarded along with it. Reordering has no "no more, no fewer" surprise to
 * show here: a stale click is refused server-side and this just reloads to
 * show what is actually there now.
 *
 * `canManageGating` turns on the mandatory-progression gate's course-level
 * on/off switch and its "preview impact" dry-run button - deliberately not
 * available to a Teacher even though the rest of this component is: turning
 * the gate on affects every student in the course at once, which is a bigger
 * decision than editing one module's own content. See courseGating.service.js
 * (student backend) for what the switch actually controls.
 */

function totalsOf(content) {
  const lessons = content?.modules.flatMap((m) => m.lessons) || [];
  return { modules: content?.modules.length || 0, lessons: lessons.length, published: lessons.filter((l) => l.isPublished).length };
}

export default function CourseStructureManager({ api, heading, description, emptyMessage, canManageGating = false }) {
  const [courses, setCourses] = useState([]);
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [reordering, setReordering] = useState(false);
  // { kind: 'module', moduleId } | { kind: 'new-module' } | { kind: 'lesson', moduleId, lessonId } | { kind: 'new-lesson', moduleId } | null
  const [editing, setEditing] = useState(null);

  // Mandatory-progression gate (admin only - see canManageGating above).
  const [gatingBusy, setGatingBusy] = useState(false);
  const [gatingError, setGatingError] = useState('');
  // 'on' | 'off' | null - set while confirming the ON direction specifically;
  // turning OFF only ever restores access, so it applies immediately with no
  // extra step.
  const [pendingToggle, setPendingToggle] = useState(null);
  const [dryRun, setDryRun] = useState({ busy: false, error: '', report: null });

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setError('');
    try {
      const list = await api.listCourses();
      setCourses(list || []);
      setSlug((current) => (current && list.some((c) => c.slug === current) ? current : list[0]?.slug || ''));
    } catch (err) {
      setError(err?.message || 'Could not load courses.');
    } finally {
      setLoadingCourses(false);
    }
  }, [api]);

  const loadContent = useCallback(
    async (courseSlug) => {
      if (!courseSlug) {
        setContent(null);
        return;
      }
      setLoadingContent(true);
      setError('');
      try {
        setContent(await api.getStructure(courseSlug));
      } catch (err) {
        setContent(null);
        setError(err?.message || 'Could not load this course.');
      } finally {
        setLoadingContent(false);
      }
    },
    [api]
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    setEditing(null);
    setNotice('');
    setGatingError('');
    setPendingToggle(null);
    setDryRun({ busy: false, error: '', report: null });
    loadContent(slug);
  }, [slug, loadContent]);

  const totals = useMemo(() => totalsOf(content), [content]);
  const currentCourse = courses.find((c) => c.slug === slug);

  // Used only for the "load the current version" step of a version conflict -
  // every ordinary successful save replaces `content` outright instead.
  const patchModule = (moduleId, patch) =>
    setContent((c) => c && { ...c, modules: c.modules.map((m) => (m.moduleId === moduleId ? { ...m, ...patch } : m)) });
  const patchLesson = (moduleId, lessonId, patch) =>
    setContent(
      (c) =>
        c && {
          ...c,
          modules: c.modules.map((m) =>
            m.moduleId !== moduleId ? m : { ...m, lessons: m.lessons.map((l) => (l.lessonId === lessonId ? { ...l, ...patch } : l)) }
          ),
        }
    );
  const removeLessonLocally = (moduleId, lessonId) =>
    setContent(
      (c) =>
        c && {
          ...c,
          modules: c.modules.map((m) => (m.moduleId !== moduleId ? m : { ...m, lessons: m.lessons.filter((l) => l.lessonId !== lessonId) })),
        }
    );

  const moveModule = async (moduleId, direction) => {
    if (!content || reordering) return;
    const ids = content.modules.map((m) => m.moduleId);
    const i = ids.indexOf(moduleId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setReordering(true);
    setError('');
    try {
      setContent(await api.reorderModules(slug, ids));
    } catch (err) {
      setError(err?.message || 'Could not reorder modules.');
      loadContent(slug);
    } finally {
      setReordering(false);
    }
  };

  const moveLesson = async (moduleId, lessonId, direction) => {
    if (!content || reordering) return;
    const mod = content.modules.find((m) => m.moduleId === moduleId);
    if (!mod) return;
    const ids = mod.lessons.map((l) => l.lessonId);
    const i = ids.indexOf(lessonId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setReordering(true);
    setError('');
    try {
      setContent(await api.reorderLessons(slug, moduleId, ids));
    } catch (err) {
      setError(err?.message || 'Could not reorder lessons.');
      loadContent(slug);
    } finally {
      setReordering(false);
    }
  };

  const runDryRun = async () => {
    if (!slug || !api.previewGatingImpact) return;
    setDryRun({ busy: true, error: '', report: null });
    try {
      const report = await api.previewGatingImpact(slug);
      setDryRun({ busy: false, error: '', report });
    } catch (err) {
      setDryRun({ busy: false, error: err?.message || 'Could not preview impact.', report: null });
    }
  };

  const applyGatingToggle = async (next) => {
    if (!content || gatingBusy) return;
    setGatingBusy(true);
    setGatingError('');
    try {
      const result = await api.updateCourseSettings(slug, {
        progressionGatingEnabled: next,
        expectedUpdatedAt: content.updatedAt,
      });
      setContent(result);
      setPendingToggle(null);
      setNotice(`Mandatory progression is now ${next ? 'ON' : 'OFF'} for "${result.title}".`);
    } catch (err) {
      if (err?.status === 409 || err?.code === 'COURSE_CHANGED') {
        setGatingError("This course's settings were changed by someone else. Reloading the current version.");
        loadContent(slug);
      } else {
        setGatingError(err?.message || 'Could not change the progression gate.');
      }
    } finally {
      setGatingBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-[#AB5236]" /> {heading}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A64] mt-1">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadCourses();
            loadContent(slug);
          }}
          disabled={loadingCourses || loadingContent}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D8D3C5] text-xs font-semibold text-[#22355E] hover:bg-[#EDEAE0] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingCourses || loadingContent ? 'animate-spin' : ''}`} /> Refresh
        </button>
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
        <div className="p-4 rounded-xl bg-white border border-[#D8D3C5] flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
          <div className="min-w-0 flex-1">
            <label htmlFor="course-structure-course" className="block text-xs font-semibold text-[#6E6A64] mb-1">
              Course
            </label>
            <select
              id="course-structure-course"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full sm:w-96 bg-[#FAF9F4] border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28]"
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
            <dl className="flex flex-wrap gap-5 text-xs shrink-0">
              <div>
                <dt className="text-[#9B9690]">Modules</dt>
                <dd className="font-bold text-[#22355E] text-base">{totals.modules}</dd>
              </div>
              <div>
                <dt className="text-[#9B9690]">Lessons</dt>
                <dd className="font-bold text-[#22355E] text-base">{totals.lessons}</dd>
              </div>
              <div>
                <dt className="text-[#9B9690]">Published</dt>
                <dd className="font-bold text-[#5C7A5E] text-base">{totals.published}</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {canManageGating && content && (
        <div className="rounded-xl bg-white border border-[#D8D3C5] p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {content.progressionGatingEnabled ? (
                <ShieldCheck className="w-5 h-5 text-[#5C7A5E] shrink-0" />
              ) : (
                <ShieldOff className="w-5 h-5 text-[#9B9690] shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#22355E]">
                  Mandatory progression is {content.progressionGatingEnabled ? 'ON' : 'OFF'} for this course
                </p>
                <p className="text-[11px] text-[#6E6A64]">
                  {content.progressionGatingEnabled
                    ? "A student must finish a module's assignment and pass its quiz before the next module unlocks, and finish each lesson before the next one does, unless a module opts out below."
                    : 'Every module and lesson is open to any enrolled student regardless of what they have completed, except for lessons locked by hand below.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={runDryRun}
                disabled={dryRun.busy || !api.previewGatingImpact}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#22355E] bg-[#EDEAE0] hover:bg-[#DFDACB] disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5" /> {dryRun.busy ? 'Checking…' : 'Preview impact'}
              </button>
              {content.progressionGatingEnabled ? (
                <button
                  type="button"
                  onClick={() => applyGatingToggle(false)}
                  disabled={gatingBusy}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-[#9A2820] bg-[#C1352B]/10 hover:bg-[#C1352B]/20 disabled:opacity-50"
                >
                  {gatingBusy ? 'Saving…' : 'Turn off'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingToggle(true)}
                  disabled={gatingBusy}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-[#5C7A5E] hover:bg-[#4A6350] disabled:opacity-50"
                >
                  Turn on
                </button>
              )}
            </div>
          </div>

          {gatingError && (
            <div role="alert" className="p-3 rounded-lg bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-xs">
              {gatingError}
            </div>
          )}

          {pendingToggle && (
            <div role="alert" className="p-3.5 rounded-lg bg-[#C99A2E]/10 border border-[#C99A2E]/40 text-[#7A5B12] text-xs space-y-2">
              <p>
                This applies immediately to every student already enrolled - some may lose access to a module or
                lesson they can open today. Preview the impact above before confirming, if you have not already.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyGatingToggle(true)}
                  disabled={gatingBusy}
                  className="px-3 py-1.5 rounded-lg bg-[#5C7A5E] hover:bg-[#4A6350] text-white font-semibold disabled:opacity-50"
                >
                  {gatingBusy ? 'Turning on…' : 'Yes, turn it on'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingToggle(null)}
                  disabled={gatingBusy}
                  className="px-3 py-1.5 rounded-lg text-[#6E6A64] hover:bg-[#EDEAE0] font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {dryRun.error && (
            <div role="alert" className="p-3 rounded-lg bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-xs">
              {dryRun.error}
            </div>
          )}

          {dryRun.report && (
            <div role="status" className="p-3.5 rounded-lg bg-[#F5F3EC] border border-[#EDEAE0] text-xs text-[#2B2B28] space-y-2">
              <p>
                <strong>{dryRun.report.totalActiveEnrollments}</strong> actively enrolled student
                {dryRun.report.totalActiveEnrollments === 1 ? '' : 's'}.{' '}
                {dryRun.report.studentsNewlyLocked > 0 ? (
                  <strong className="text-[#9A2820]">
                    {dryRun.report.studentsNewlyLocked} would newly lose access to something if the gate were on.
                  </strong>
                ) : (
                  <strong className="text-[#3F5A41]">None would newly lose access if the gate were on.</strong>
                )}
              </p>
              {dryRun.report.impacted?.length > 0 && (
                <ul className="divide-y divide-[#EDEAE0] max-h-64 overflow-y-auto">
                  {dryRun.report.impacted.slice(0, 50).map((row) => (
                    <li key={row.userId} className="py-1.5">
                      <p className="font-semibold text-[#22355E]">{row.name || row.email || row.userId}</p>
                      {row.newlyLockedModules.map((m) => (
                        <p key={`m-${m.moduleId}`} className="text-[#6E6A64] pl-2">
                          · module {m.moduleId}: {m.reason}
                        </p>
                      ))}
                      {row.newlyLockedLessons.map((l) => (
                        <p key={`l-${l.lessonId}`} className="text-[#6E6A64] pl-2">
                          · lesson {l.lessonId}: {l.reason}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
              {dryRun.report.impacted?.length > 50 && (
                <p className="text-[#9B9690]">…and {dryRun.report.impacted.length - 50} more.</p>
              )}
            </div>
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
        <div className="p-8 rounded-xl bg-white border border-[#D8D3C5] text-center text-sm text-[#6E6A64]">
          {currentCourse?.title || 'This course'} has no modules yet.
        </div>
      )}

      {!loadingContent &&
        content?.modules.map((mod, idx) => {
          const isCollapsed = collapsed[mod.moduleId];
          return (
            <section key={mod.moduleId} className="rounded-xl bg-white border border-[#D8D3C5] overflow-hidden">
              <div className="px-4 py-3 bg-[#F5F3EC] border-b border-[#D8D3C5] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [mod.moduleId]: !c[mod.moduleId] }))}
                  className="min-w-0 flex items-center gap-2 text-left flex-1"
                  aria-expanded={!isCollapsed}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-[#6E6A64] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6E6A64] shrink-0" />
                  )}
                  <span className="text-sm font-bold text-[#22355E] truncate">{mod.title}</span>
                  <span className="text-[11px] text-[#9B9690] shrink-0">
                    {mod.lessons.length} lesson{mod.lessons.length === 1 ? '' : 's'}
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveModule(mod.moduleId, -1)}
                    disabled={idx === 0 || reordering}
                    aria-label={`Move ${mod.title} up`}
                    className="p-1.5 rounded-lg text-[#6E6A64] hover:bg-[#DFDACB] hover:text-[#22355E] disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveModule(mod.moduleId, 1)}
                    disabled={idx === content.modules.length - 1 || reordering}
                    aria-label={`Move ${mod.title} down`}
                    className="p-1.5 rounded-lg text-[#6E6A64] hover:bg-[#DFDACB] hover:text-[#22355E] disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'module', moduleId: mod.moduleId })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#22355E] bg-[#EDEAE0] hover:bg-[#DFDACB]"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                </div>
              </div>

              {editing?.kind === 'module' && editing.moduleId === mod.moduleId && (
                <div className="p-4">
                  <ModuleEditor
                    key={`${mod.moduleId}:${mod.updatedAt || 'new'}`}
                    module={mod}
                    canManageGating={canManageGating}
                    api={{ save: (payload) => api.updateModule(slug, mod.moduleId, payload) }}
                    onSaved={(result) => {
                      setContent(result);
                      setEditing(null);
                      setNotice(`"${mod.title}" saved.`);
                    }}
                    onConflict={(current) => {
                      if (current) patchModule(mod.moduleId, current);
                      setNotice(`"${mod.title}" was changed by someone else. The editor now shows the current version.`);
                    }}
                    onClose={() => setEditing(null)}
                  />
                </div>
              )}

              {!isCollapsed && (
                <>
                  <ul className="divide-y divide-[#EDEAE0]">
                    {mod.lessons.map((lesson, lidx) => (
                      <li key={lesson.lessonId} className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#2B2B28] truncate">{lesson.title}</p>
                            <p className="text-[11px] text-[#9B9690] truncate">
                              <span className="font-mono">{lesson.lessonId}</span>
                              {lesson.duration ? ` · ${lesson.duration}` : ''}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {!lesson.isPublished && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#9B9690]/15 text-[#6E6A64] inline-flex items-center gap-1">
                                  <EyeOff className="w-2.5 h-2.5" /> Hidden
                                </span>
                              )}
                              {lesson.isLocked && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#9B9690]/15 text-[#6E6A64] inline-flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Locked
                                </span>
                              )}
                              {lesson.hasVideo && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#22355E]/10 text-[#22355E] inline-flex items-center gap-1">
                                  <Film className="w-2.5 h-2.5" /> Video
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveLesson(mod.moduleId, lesson.lessonId, -1)}
                              disabled={lidx === 0 || reordering}
                              aria-label={`Move ${lesson.title} up`}
                              className="p-1.5 rounded-lg text-[#6E6A64] hover:bg-[#EDEAE0] hover:text-[#22355E] disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLesson(mod.moduleId, lesson.lessonId, 1)}
                              disabled={lidx === mod.lessons.length - 1 || reordering}
                              aria-label={`Move ${lesson.title} down`}
                              className="p-1.5 rounded-lg text-[#6E6A64] hover:bg-[#EDEAE0] hover:text-[#22355E] disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing({ kind: 'lesson', moduleId: mod.moduleId, lessonId: lesson.lessonId })}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EDEAE0] hover:bg-[#DFDACB] text-[#22355E]"
                            >
                              Edit
                            </button>
                          </div>
                        </div>

                        {editing?.kind === 'lesson' && editing.moduleId === mod.moduleId && editing.lessonId === lesson.lessonId && (
                          <div className="mt-3">
                            <LessonEditor
                              key={`${lesson.lessonId}:${lesson.updatedAt || 'new'}`}
                              lesson={lesson}
                              api={{
                                save: (payload) => api.updateLesson(slug, mod.moduleId, lesson.lessonId, payload),
                                remove: (payload) => api.removeLesson(slug, mod.moduleId, lesson.lessonId, payload),
                              }}
                              onSaved={(result) => {
                                setContent(result);
                                setEditing(null);
                                setNotice(`"${lesson.title}" saved.`);
                              }}
                              onRemoved={() => {
                                removeLessonLocally(mod.moduleId, lesson.lessonId);
                                setEditing(null);
                                setNotice(`"${lesson.title}" removed.`);
                              }}
                              onConflict={(current) => {
                                if (current) patchLesson(mod.moduleId, lesson.lessonId, current);
                                setNotice(`"${lesson.title}" was changed by someone else. The editor now shows the current version.`);
                              }}
                              onClose={() => setEditing(null)}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="p-3 sm:p-4 bg-[#FAF9F4] border-t border-[#EDEAE0]">
                    {editing?.kind === 'new-lesson' && editing.moduleId === mod.moduleId ? (
                      <LessonEditor
                        lesson={null}
                        api={{ save: (payload) => api.addLesson(slug, mod.moduleId, payload) }}
                        onSaved={(result) => {
                          setContent(result);
                          setEditing(null);
                          setNotice('Lesson added.');
                        }}
                        onClose={() => setEditing(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditing({ kind: 'new-lesson', moduleId: mod.moduleId })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#22355E] hover:bg-[#EDEAE0]"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add a lesson to "{mod.title}"
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          );
        })}

      {!loadingContent && content && (
        <div>
          {editing?.kind === 'new-module' ? (
            <ModuleEditor
              module={null}
              canManageGating={canManageGating}
              api={{ save: (payload) => api.addModule(slug, payload) }}
              onSaved={(result) => {
                setContent(result);
                setEditing(null);
                setNotice('Module added.');
              }}
              onClose={() => setEditing(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing({ kind: 'new-module' })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border-2 border-dashed border-[#D8D3C5] text-[#22355E] hover:border-[#AB5236] hover:text-[#AB5236] w-full justify-center"
            >
              <Plus className="w-4 h-4" /> Add a module
            </button>
          )}
        </div>
      )}
    </div>
  );
}
