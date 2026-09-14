import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../../services/teacherApiService';

/**
 * Assignments that are part of the course content, rather than authored here.
 *
 * These are submitted in the student portal, so they never appeared on this
 * page: only assignments a teacher created here were pushed across and came
 * back to be graded. A student could complete the GARUD and YODDHA coursework
 * and no teacher had any route to see it.
 *
 * Grading goes through the same mechanism that grades any other submission -
 * the score reaches the student's real task average and they are notified. The
 * roster check happens on the server; nothing here is a security boundary.
 */

const SUBJECT_TONE = {
  ENGLISH: 'bg-sky-50 text-sky-700 border-sky-200',
  COMPUTER: 'bg-violet-50 text-violet-700 border-violet-200',
  CYBERSECURITY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function CourseAssignments() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ available: true, students: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [ungradedOnly, setUngradedOnly] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await teacherApiService.listCourseAssignments({ ungradedOnly });
      setItems(res.data || []);
      setMeta(res.meta || { available: true, students: 0 });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load course assignments.');
    } finally {
      setIsLoading(false);
    }
  }, [ungradedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const draftFor = (row) =>
    drafts[row.submissionId] || {
      score: row.teacherScore ?? '',
      maxScore: row.teacherMaxScore ?? 100,
      feedback: row.teacherFeedback ?? '',
    };

  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...draftFor({ submissionId: id }), ...d[id], ...patch } }));

  const submitGrade = async (row) => {
    const draft = draftFor(row);
    setSavingId(row.submissionId);
    setError('');
    setNotice('');
    try {
      await teacherApiService.gradeCourseAssignment(row.submissionId, {
        score: Number(draft.score),
        maxScore: Number(draft.maxScore) || 100,
        feedback: draft.feedback || '',
      });
      setNotice(`Graded ${row.studentName || 'student'} — ${draft.score}/${draft.maxScore || 100}. They have been notified.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not record that grade.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Course assignments
          </h2>
          <p className="text-sm text-slate-500">
            Coursework from PRARAMBH, GARUD and YODDHA, submitted by your students in the student portal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={ungradedOnly} onChange={(e) => setUngradedOnly(e.target.checked)} />
            Needs grading only
          </label>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-3">{error}</div>}
      {notice && <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm mb-3">{notice}</div>}

      {!meta.available && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          The student service is unreachable, so coursework cannot be listed right now. This is not the same as having nothing to grade.
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && meta.available && items.length === 0 && (
        <p className="text-sm text-slate-400">
          {ungradedOnly ? 'Nothing is waiting to be graded.' : 'No coursework has been submitted by your students yet.'}
        </p>
      )}

      <div className="space-y-3">
        {!isLoading &&
          items.map((row) => {
            const draft = draftFor(row);
            return (
              <div key={row.submissionId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{row.taskTitle || 'Assignment'}</p>
                    <p className="text-xs text-slate-500">
                      {row.studentName || 'Unknown student'}
                      {row.courseTitle ? ` · ${row.courseTitle}` : ''}
                      {row.moduleTitle ? ` · ${row.moduleTitle}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.subject && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${SUBJECT_TONE[row.subject] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {row.subject}
                      </span>
                    )}
                    {row.graded ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {row.teacherScore}/{row.teacherMaxScore}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700">Needs grading</span>
                    )}
                  </div>
                </div>

                {row.submissionText && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 max-h-48 overflow-y-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-line">{row.submissionText}</p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-slate-500">
                    Score
                    <input
                      type="number"
                      min="0"
                      value={draft.score}
                      onChange={(e) => setDraft(row.submissionId, { score: e.target.value })}
                      className="block w-20 mt-0.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm tabular-nums"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Out of
                    <input
                      type="number"
                      min="1"
                      value={draft.maxScore}
                      onChange={(e) => setDraft(row.submissionId, { maxScore: e.target.value })}
                      className="block w-20 mt-0.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm tabular-nums"
                    />
                  </label>
                  <label className="text-xs text-slate-500 flex-1 min-w-[14rem]">
                    Feedback
                    <input
                      value={draft.feedback}
                      onChange={(e) => setDraft(row.submissionId, { feedback: e.target.value })}
                      placeholder="What was strong, and what to do differently"
                      className="block w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => submitGrade(row)}
                    disabled={savingId === row.submissionId || draft.score === ''}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {savingId === row.submissionId ? 'Saving…' : row.graded ? 'Update grade' : 'Record grade'}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
