import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp, Clock, CheckCircle2, ChevronRight, X, Lock, HelpCircle, CircleDashed } from 'lucide-react';
import { teacherApiService } from '../services/teacherApiService';

/**
 * How a teacher's students are progressing.
 *
 * Every figure is read from the student service, which computes it from
 * recorded activity. This page has no way to change any of them - a teacher
 * influences progression by marking attendance and grading work, which the
 * engine then turns into scores, and that separation is deliberate rather than
 * an omission.
 *
 * The filters exist because a roster of forty is not something anyone reads top
 * to bottom. They answer the questions a teacher actually arrives with: who has
 * stopped, who is struggling, who is nearly through.
 */

const FILTERS = [
  { key: null, label: 'All' },
  { key: 'inactive', label: 'Inactive', icon: Clock },
  { key: 'at-risk', label: 'At risk', icon: AlertTriangle },
  { key: 'high-performers', label: 'High performers', icon: TrendingUp },
  { key: 'near-completion', label: 'Near completion', icon: Activity },
  { key: 'eligible', label: 'Eligible for next stage', icon: CheckCircle2 },
];

const pct = (n) => `${Math.round(Number(n) || 0)}%`;

function ScoreCell({ value, muted }) {
  if (muted) return <span className="text-slate-300">—</span>;
  return <span className="tabular-nums">{Math.round(Number(value) || 0)}</span>;
}

function FlagChips({ flags }) {
  if (flags?.unlinked) {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
        title="This student has no student-portal account yet, so there is no activity to report."
      >
        Not linked
      </span>
    );
  }
  const chips = [];
  if (flags.eligibleForNextStage) chips.push(['Eligible', 'bg-emerald-50 text-emerald-700']);
  if (flags.nearCompletion) chips.push(['Near done', 'bg-blue-50 text-blue-700']);
  if (flags.highPerformer) chips.push(['Strong', 'bg-indigo-50 text-indigo-700']);
  if (flags.lowAttendance) chips.push(['Low attendance', 'bg-amber-50 text-amber-700']);
  if (flags.lowPerformance) chips.push(['Struggling', 'bg-red-50 text-red-700']);
  if (flags.inactive) {
    chips.push([
      flags.daysSinceActivity === null ? 'No activity' : `${flags.daysSinceActivity}d idle`,
      'bg-slate-100 text-slate-600',
    ]);
  }
  if (!chips.length) return <span className="text-[10px] text-slate-400">On track</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(([label, cls]) => (
        <span key={label} className={`text-[10px] px-1.5 py-0.5 rounded ${cls}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

/** Null means the platform holds no figure, which is never the same as zero. */
function reqValue(value, unit) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value) * 10) / 10}${unit || ''}`;
}

/**
 * What a stage is still waiting on, exactly as the engine decided it.
 *
 * Read-only in the strongest sense: nothing here recomputes a verdict, and
 * there is no route on this portal that writes one. A teacher who could see a
 * different answer from the student would be worse than a teacher who sees
 * nothing, because both would act on it.
 */
function EligibilityPanel({ eligibility }) {
  if (!eligibility) return null;
  const { earnedNextStage, blocked = [] } = eligibility;
  if (!earnedNextStage && !blocked.length) return null;

  return (
    <div>
      <h3 className="text-xs font-bold text-slate-600 mb-2">Stage eligibility</h3>

      {earnedNextStage && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Has met every requirement for {earnedNextStage.stageCode}.
        </p>
      )}

      {blocked.map((stage) => (
        <div key={stage.stageCode} className="mb-3 last:mb-0">
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
            <Lock className="w-3 h-3" /> {stage.stageCode}
          </p>

          {stage.status === 'NOT_CONFIGURED' ? (
            // Nothing the student can work towards, and nothing the teacher can
            // coach them on - an administrator has simply not published the
            // criteria yet, and saying so is more use than an empty list.
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
              No entry criteria published for this stage yet.
            </p>
          ) : stage.outstanding.length ? (
            <ul className="space-y-1">
              {stage.outstanding.map((r) => (
                <li key={r.key} className="flex items-center gap-2 text-xs">
                  {r.status === 'DATA_REQUIRED' ? (
                    <HelpCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  ) : (
                    <CircleDashed className="w-3 h-3 text-slate-300 shrink-0" />
                  )}
                  <span className="text-slate-700 min-w-0 truncate">{r.name}</span>
                  <span className="ml-auto tabular-nums text-slate-500 shrink-0">
                    {r.status === 'DATA_REQUIRED' ? (
                      <span className="text-amber-700">Not recorded yet</span>
                    ) : (
                      <>
                        {reqValue(r.actual, r.unit)}
                        <span className="text-slate-300"> / {r.operator} {reqValue(r.required, r.unit)}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">Nothing outstanding.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function DetailDrawer({ studentId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    teacherApiService
      .getStudentProgressDetail(studentId)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err.message || 'Could not load this student.'));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 truncate">{detail?.student?.name || 'Student'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="p-5 text-sm text-red-600">{error}</p>}
        {!detail && !error && <p className="p-5 text-sm text-slate-400">Loading…</p>}

        {detail?.student?.linked === false && (
          <p className="p-5 text-sm text-slate-500">
            This student has no student-portal account yet, so there is no recorded activity to show.
          </p>
        )}

        {detail?.progress && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Level', detail.progress.level],
                ['Rank', detail.progress.rankCode || '—'],
                ['XP', (detail.progress.xp || 0).toLocaleString('en-IN')],
                ['Overall power', Math.round(detail.progress.overallPower)],
                ['Knowledge', Math.round(detail.progress.knowledgeScore)],
                ['Consistency', Math.round(detail.progress.consistencyScore)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="font-bold text-slate-800 tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-600 mb-2">Skills</h3>
              <div className="space-y-2">
                {(detail.progress.skills || []).map((s) => (
                  <div key={s.subjectCode}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600">{s.subjectCode}</span>
                      <span className="tabular-nums text-slate-800">{Math.round(s.score)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#22355E] rounded-full" style={{ width: pct(s.score) }} />
                    </div>
                    {s.activityCount === 0 && <p className="text-[10px] text-slate-400 mt-0.5">No activity yet</p>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-600 mb-2">Attendance</h3>
              <p className="text-sm text-slate-700">
                {detail.progress.classesConducted > 0
                  ? `${detail.progress.classesAttended} of ${detail.progress.classesConducted} classes (${pct(detail.progress.attendanceScore)})`
                  : 'No classes recorded yet'}
              </p>
            </div>

            <EligibilityPanel eligibility={detail.eligibility} />

            <div>
              <h3 className="text-xs font-bold text-slate-600 mb-2">Recent activity</h3>
              {detail.activity?.length ? (
                <ul className="space-y-2">
                  {detail.activity.map((e, i) => (
                    <li key={`${e.refId}-${i}`} className="text-xs flex items-start gap-2">
                      <span className="text-slate-400 shrink-0 w-24">
                        {new Date(e.occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-slate-700 min-w-0">
                        {e.activityType.replace(/_/g, ' ').toLowerCase()}
                        {e.subjectCode ? ` · ${e.subjectCode}` : ''}
                        {typeof e.score === 'number' ? ` · ${e.score}%` : ''}
                      </span>
                      {e.xpAwarded > 0 && <span className="ml-auto text-emerald-600 shrink-0">+{e.xpAwarded}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Nothing recorded yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentProgressPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, progressionAvailable: true });
  const [filter, setFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openStudent, setOpenStudent] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await teacherApiService.getStudentProgress({ page, limit: 25, ...(filter ? { filter } : {}) });
      setRows(res.data || []);
      setMeta(res.meta || {});
    } catch (err) {
      setError(err.message || 'Could not load your students.');
    } finally {
      setIsLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-6 h-6" /> My Students
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Progress calculated from recorded activity. You can see these figures; only the engine sets them.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* An unreachable student service must not look like a class of zeroes. */}
      {meta.progressionAvailable === false && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Progress figures could not be loaded just now. Your roster is shown without them.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filter === f.key ? 'bg-[#22355E] text-white border-[#22355E]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="text-left font-semibold px-4 py-2.5">Student</th>
                <th className="text-left font-semibold px-4 py-2.5">Stage</th>
                <th className="text-right font-semibold px-4 py-2.5">Level</th>
                <th className="text-right font-semibold px-4 py-2.5">Rank</th>
                <th className="text-right font-semibold px-4 py-2.5">XP</th>
                <th className="text-right font-semibold px-4 py-2.5">Attend.</th>
                <th className="text-right font-semibold px-4 py-2.5">Power</th>
                <th className="text-left font-semibold px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No students match this view.
                  </td>
                </tr>
              )}

              {!isLoading &&
                rows.map((r) => (
                  <tr key={r.studentId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{r.className || r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.progress?.stageCode || '—'}</td>
                    <td className="px-4 py-3 text-right"><ScoreCell value={r.progress?.level} muted={!r.progress} /></td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.progress?.rankCode || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {r.progress ? (r.progress.xp || 0).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.progress?.classesConducted > 0 ? pct(r.progress.attendanceScore) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right"><ScoreCell value={r.progress?.overallPower} muted={!r.progress} /></td>
                    <td className="px-4 py-3"><FlagChips flags={r.flags} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenStudent(r.studentId)}
                        className="text-slate-400 hover:text-[#22355E]"
                        aria-label={`Open ${r.name}`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {meta.page} of {meta.totalPages} · {meta.total} student{meta.total === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-semibold"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {openStudent && <DetailDrawer studentId={openStudent} onClose={() => setOpenStudent(null)} />}
    </div>
  );
}
