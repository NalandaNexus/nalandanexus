import React, { useCallback, useEffect, useState } from 'react';
import { Tags, Save, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { adminApi } from '../services/adminApi';

/**
 * Classifying what each part of a course teaches.
 *
 * The subject on a lesson decides which of a student's three skill scores its
 * completion feeds, so this page is progression configuration rather than
 * content metadata - which is why it distinguishes "inherited" from "chosen"
 * everywhere. A lesson showing ENGLISH because nobody has classified it is a
 * different fact from one an administrator deliberately set to ENGLISH, and
 * collapsing the two would hide exactly the work this page exists to do.
 *
 * Changes are staged locally and saved together: re-tagging a module usually
 * means several related decisions, and saving each keystroke would make a
 * half-applied reclassification the normal case.
 */

const INHERIT = '__inherit__';
const UNTAGGED = '__untagged__';

function SubjectSelect({ value, subjects, onChange, inherited, resolved, disabled }) {
  return (
    <select
      value={value ?? INHERIT}
      onChange={(e) => onChange(e.target.value === INHERIT ? null : e.target.value)}
      disabled={disabled}
      className={`text-xs rounded-lg border px-2 py-1.5 min-w-[11rem] ${
        inherited ? 'bg-slate-50 border-slate-200 text-slate-500 italic' : 'bg-white border-slate-300 text-slate-800'
      } disabled:opacity-50`}
      aria-label="Subject"
    >
      <option value={INHERIT}>
        {inherited && resolved ? `Inherited — ${resolved}` : 'Inherit from module / pillar'}
      </option>
      {subjects.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Which module a quiz or assignment counts toward for the mandatory-
 * progression gate (see courseGating.service.js, student backend) - a
 * wholly separate decision from the subject it teaches, so this is its own
 * control next to SubjectSelect rather than folded into it. Untagged is a
 * real, valid choice: an untagged quiz/task is simply never checked by the
 * gate, not an error.
 */
function ModuleSelect({ value, modules, onChange, disabled }) {
  return (
    <select
      value={value || UNTAGGED}
      onChange={(e) => onChange(e.target.value === UNTAGGED ? null : e.target.value)}
      disabled={disabled}
      className={`text-xs rounded-lg border px-2 py-1.5 min-w-[11rem] ${
        value ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-500 italic'
      } disabled:opacity-50`}
      aria-label="Module (progression gate)"
    >
      <option value={UNTAGGED}>Not required for progression</option>
      {modules.map((m) => (
        <option key={m.moduleId} value={m.moduleId}>
          Required for: {m.title}
        </option>
      ))}
    </select>
  );
}

/** Merges two per-id pending maps (subject, moduleId) into one payload array, each field sent only when actually staged. */
function mergeModuleTagging(subjectMap, moduleMap, idKey) {
  const ids = new Set([...Object.keys(subjectMap), ...Object.keys(moduleMap)]);
  return [...ids].map((id) => ({
    [idKey]: id,
    ...(id in subjectMap ? { subject: subjectMap[id] } : {}),
    ...(id in moduleMap ? { moduleId: moduleMap[id] } : {}),
  }));
}

export default function CourseSubjectsPage() {
  const [courses, setCourses] = useState([]);
  const [slug, setSlug] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [content, setContent] = useState(null);
  const [pending, setPending] = useState({ modules: {}, lessons: {}, quizzes: {}, tasks: {}, quizModules: {}, taskModules: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([adminApi.getCourses({ limit: 100 }), adminApi.getCourseSubjects()])
      .then(([courseList, subjectList]) => {
        const withContent = (courseList.items || courseList || []).filter((c) => c.slug);
        setCourses(withContent);
        setSubjects(subjectList);
        if (withContent.length && !slug) setSlug(withContent[0].slug);
      })
      .catch((err) => setError(err.message || 'Could not load courses.'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContent = useCallback(async (courseSlug) => {
    if (!courseSlug) return;
    setIsLoading(true);
    setError('');
    setPending({ modules: {}, lessons: {}, quizzes: {}, tasks: {}, quizModules: {}, taskModules: {} });
    try {
      setContent(await adminApi.getCourseContent(courseSlug));
    } catch (err) {
      setError(err.message || 'Could not load this course.');
      setContent(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent(slug);
  }, [slug, loadContent]);

  const stage = (kind, id, subject) =>
    setPending((p) => ({ ...p, [kind]: { ...p[kind], [id]: subject } }));

  const pendingCount = Object.values(pending).reduce((n, group) => n + Object.keys(group).length, 0);

  const save = async () => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        modules: Object.entries(pending.modules).map(([moduleId, subject]) => ({ moduleId, subject })),
        lessons: Object.entries(pending.lessons).map(([lessonId, subject]) => ({ lessonId, subject })),
        quizzes: mergeModuleTagging(pending.quizzes, pending.quizModules, 'quizId'),
        tasks: mergeModuleTagging(pending.tasks, pending.taskModules, 'taskId'),
      };
      const result = await adminApi.setCourseSubjects(slug, payload);
      setNotice(`${result?.changed ?? pendingCount} item(s) updated. Future activity will be credited accordingly.`);
      await loadContent(slug);
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setIsSaving(false);
    }
  };

  const valueFor = (kind, id, stored) => (id in pending[kind] ? pending[kind][id] : stored);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#22355E] flex items-center gap-2">
            <Tags className="w-6 h-6" /> Course Subjects
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            What each part of a course teaches. This decides which skill score a student&apos;s work feeds.
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPending({ modules: {}, lessons: {}, quizzes: {}, tasks: {}, quizModules: {}, taskModules: {} })}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Discard
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="flex items-center gap-2 bg-[#22355E] hover:bg-[#16233F] text-white font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Saving…' : `Save ${pendingCount} change${pendingCount === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      {/* Re-tagging is forward-looking, and saying so here prevents the natural
          assumption that fixing a label also fixes past scores. */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-px text-slate-400" />
        <span>
          Changing a subject affects how <strong>future</strong> activity is credited. Work a student has already
          completed keeps the subject it was recorded under, so past scores and reports stay explainable.
        </span>
      </div>

      <div className="p-4 rounded-xl bg-white border border-slate-200">
        <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full sm:w-96 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          {courses.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
        {content && (
          <p className="text-[11px] text-slate-400 mt-2">
            Course pillar: <strong className="text-slate-600">{content.pillar || 'none'}</strong> — used as the default
            when neither a lesson nor its module names a subject.
          </p>
        )}
      </div>

      {isLoading && <div className="p-8 text-center text-sm text-slate-400">Loading…</div>}

      {!isLoading && content && content.modules.length === 0 && (
        <div className="p-8 rounded-xl bg-white border border-slate-200 text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-amber-500" />
          <p className="text-sm text-slate-600 mt-2">This course has no modules or lessons yet.</p>
        </div>
      )}

      {!isLoading &&
        content?.modules.map((mod) => (
          <div key={mod.moduleId} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#22355E] truncate">{mod.title}</h2>
                <p className="text-[11px] text-slate-400">
                  {mod.lessons.length} lesson{mod.lessons.length === 1 ? '' : 's'} · module default
                </p>
              </div>
              <SubjectSelect
                value={valueFor('modules', mod.moduleId, mod.subject)}
                subjects={subjects}
                inherited={!valueFor('modules', mod.moduleId, mod.subject)}
                resolved={null}
                onChange={(v) => stage('modules', mod.moduleId, v)}
                disabled={isSaving}
              />
            </div>

            <ul className="divide-y divide-slate-100">
              {mod.lessons.map((lesson) => {
                const staged = valueFor('lessons', lesson.lessonId, lesson.subject);
                return (
                  <li key={lesson.lessonId} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 truncate">{lesson.title}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{lesson.lessonId}</p>
                    </div>
                    <SubjectSelect
                      value={staged}
                      subjects={subjects}
                      inherited={!staged}
                      resolved={lesson.resolvedSubject}
                      onChange={(v) => stage('lessons', lesson.lessonId, v)}
                      disabled={isSaving}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

      {!isLoading && content?.quizzes?.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-bold text-[#22355E]">Quizzes</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Subject feeds a skill score. "Required for" feeds the mandatory-progression gate instead - a student
              must pass a quiz tagged to a module before the next module unlocks.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {content.quizzes.map((q) => (
              <li key={q.quizId} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-sm text-slate-800 truncate min-w-0">{q.title}</p>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <SubjectSelect
                    value={valueFor('quizzes', q.quizId, q.subject)}
                    subjects={subjects}
                    inherited={!valueFor('quizzes', q.quizId, q.subject)}
                    resolved={null}
                    onChange={(v) => stage('quizzes', q.quizId, v)}
                    disabled={isSaving}
                  />
                  <ModuleSelect
                    value={valueFor('quizModules', q.quizId, q.moduleId)}
                    modules={content.modules}
                    onChange={(v) => stage('quizModules', q.quizId, v)}
                    disabled={isSaving}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && content?.tasks?.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-bold text-[#22355E]">Assignments</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Subject feeds a skill score. "Required for" feeds the mandatory-progression gate instead - a student
              must complete an assignment tagged to a module before the next module unlocks.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {content.tasks.map((t) => (
              <li key={t.taskId} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-sm text-slate-800 truncate min-w-0">{t.title}</p>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <SubjectSelect
                    value={valueFor('tasks', t.taskId, t.subject)}
                    subjects={subjects}
                    inherited={!valueFor('tasks', t.taskId, t.subject)}
                    resolved={null}
                    onChange={(v) => stage('tasks', t.taskId, v)}
                    disabled={isSaving}
                  />
                  <ModuleSelect
                    value={valueFor('taskModules', t.taskId, t.moduleId)}
                    modules={content.modules}
                    onChange={(v) => stage('taskModules', t.taskId, v)}
                    disabled={isSaving}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
