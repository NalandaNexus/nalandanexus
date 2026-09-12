import React, { useCallback, useEffect, useState } from 'react';
import { ListChecks, Search, Eye, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';
import { adminApi } from '../services/adminApi';

/**
 * Where every student stands against every transition.
 *
 * Reads the verdicts the engine already stored rather than re-evaluating per
 * row - a page of students must not become a page of full recalculations - and
 * filters and pages in the database rather than in the browser.
 *
 * The preview is the exception: it evaluates one student on demand, because
 * that is the question an administrator asks when a student disputes a result.
 * It is read-only, so opening it never alters the student being examined.
 */

/** Null means the platform holds no figure, which is never the same as zero. */
function value(n, unit) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Math.round(Number(n) * 10) / 10}${unit || ''}`;
}

function Verdict({ stage }) {
  if (!stage) return <span className="text-slate-300">—</span>;
  if (stage.status === 'NOT_CONFIGURED') {
    return <span className="text-[11px] text-slate-400" title="No criteria published for this stage">Not configured</span>;
  }
  return stage.eligible ? (
    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
      <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
    </span>
  ) : (
    <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
      <XCircle className="w-3.5 h-3.5" /> Locked
    </span>
  );
}

function PreviewDrawer({ userId, stages, onClose }) {
  const [stageCode, setStageCode] = useState(stages[0] || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const evaluate = useCallback(async (useDraft) => {
    if (!stageCode) return;
    setIsBusy(true);
    setError('');
    try {
      setResult(await adminApi.previewStageEligibility({ userId, stageCode, useDraft }));
    } catch (err) {
      setError(err.message || 'Could not evaluate.');
    } finally {
      setIsBusy(false);
    }
  }, [userId, stageCode]);

  useEffect(() => { evaluate(false); }, [evaluate]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 truncate">{result?.student?.name || 'Eligibility preview'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={stageCode}
              onChange={(e) => setStageCode(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm flex-1"
              aria-label="Target stage"
            >
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" onClick={() => evaluate(true)} disabled={isBusy}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold disabled:opacity-50">
              Try draft
            </button>
          </div>

          {!stages.length && (
            <p className="text-sm text-slate-500">
              There are no configured transitions to evaluate this student against yet.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {isBusy && <p className="text-sm text-slate-400">Evaluating…</p>}

          {result && !isBusy && (
            <>
              {result.usingDraft && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Evaluated against the unpublished draft. This is not what the student currently sees.
                </p>
              )}

              <div className={`p-3 rounded-xl border text-sm font-semibold ${
                result.status === 'NOT_CONFIGURED' ? 'bg-slate-50 border-slate-200 text-slate-600'
                  : result.eligible ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'}`}>
                {result.status === 'NOT_CONFIGURED'
                  ? 'No criteria published for this stage yet.'
                  : result.eligible ? 'Eligible — all requirements satisfied.' : 'Not eligible.'}
              </div>

              {result.requirements?.length > 0 && (
                <ul className="space-y-2">
                  {result.requirements.map((r) => (
                    <li key={r.key} className="flex items-start gap-2 text-sm">
                      {r.status === 'DATA_REQUIRED' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      ) : r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-800 truncate">{r.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {r.status === 'DATA_REQUIRED'
                            ? `required ${r.operator} ${value(r.required, r.unit)} · no data yet`
                            : `${value(r.actual, r.unit)} ${r.operator} ${value(r.required, r.unit)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {result.missingRequirements?.length > 0 && (
                <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                  {result.missingRequirements.length} requirement{result.missingRequirements.length === 1 ? '' : 's'} remaining.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentEligibilityPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, stages: [], targets: [] });
  const [filters, setFilters] = useState({ stageCode: '', targetStage: '', eligibility: '' });
  // Kept apart from the committed filters so typing does not fire a request per
  // keystroke against a collection-wide query.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const query = Object.fromEntries(
        Object.entries({ ...filters, search: debouncedSearch, page, limit: 25 }).filter(([, v]) => v !== '')
      );
      const res = await adminApi.getStudentEligibility(query);
      setRows(res.rows);
      setMeta(res.meta);
    } catch (err) {
      setError(err.message || 'Could not load student eligibility.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  /**
   * The stages are configuration, so the table asks the server what they are.
   *
   * These were hardcoded as PRARAMBH / GARUD / YODDHA in the filters and as two
   * fixed columns in the table, which meant a fourth stage - the entire point of
   * a configurable progression - would have been invisible here.
   *
   * `meta` arrives with the first response, so the columns settle on the first
   * load rather than flickering per page.
   */
  const allStages = meta.stages || [];
  const targetStages = meta.targets || [];
  // Student, current stage, one per target, outstanding, evaluated, actions.
  const colCount = 5 + targetStages.length;

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-[#22355E] flex items-center gap-2">
          <ListChecks className="w-6 h-6" /> Student Eligibility
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Where each student stands against the published criteria, and what is outstanding.
        </p>
      </div>

      {error && <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-white border border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filters.stageCode}
          onChange={(e) => { setFilters((f) => ({ ...f, stageCode: e.target.value })); setPage(1); }}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          aria-label="Current stage"
        >
          <option value="">Any current stage</option>
          {allStages.map((st) => <option key={st.code} value={st.code}>{st.name || st.code}</option>)}
        </select>
        <select
          value={filters.targetStage}
          onChange={(e) => {
            // The verdict filter is only meaningful about a specific stage, and
            // the server ignores it without one. Clearing the stage clears it
            // too, so the disabled dropdown cannot keep showing "Eligible"
            // while the results plainly are not filtered by it.
            const targetStage = e.target.value;
            setFilters((f) => ({ ...f, targetStage, eligibility: targetStage ? f.eligibility : '' }));
            setPage(1);
          }}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          aria-label="Target stage"
        >
          <option value="">Any target stage</option>
          {targetStages.map((code) => {
            const st = allStages.find((x) => x.code === code);
            return <option key={code} value={code}>{st?.name || code}</option>;
          })}
        </select>
        <select
          value={filters.eligibility}
          onChange={(e) => { setFilters((f) => ({ ...f, eligibility: e.target.value })); setPage(1); }}
          disabled={!filters.targetStage}
          title={filters.targetStage ? '' : 'Choose a target stage first'}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          aria-label="Eligibility"
        >
          <option value="">Eligible or not</option>
          <option value="ELIGIBLE">Eligible</option>
          <option value="NOT_ELIGIBLE">Not eligible</option>
        </select>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="text-left font-semibold px-4 py-2.5">Student</th>
                <th className="text-left font-semibold px-4 py-2.5">Current stage</th>
                {targetStages.map((code) => (
                  <th key={code} className="text-left font-semibold px-4 py-2.5">{code}</th>
                ))}
                <th className="text-left font-semibold px-4 py-2.5">Outstanding</th>
                <th className="text-left font-semibold px-4 py-2.5">Evaluated</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">No students match this view.</td></tr>
              )}

              {!isLoading && rows.map((r) => {
                const byStage = new Map((r.stages || []).map((st) => [st.stageCode, st]));
                const missing = [...new Set(targetStages.flatMap((code) => byStage.get(code)?.missing || []))];

                return (
                  <tr key={r.userId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.name || '—'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.currentStage || '—'}
                      {r.currentStage && <span className="text-[11px] text-slate-400"> · {Math.round(r.stageProgress)}%</span>}
                    </td>
                    {targetStages.map((code) => (
                      <td key={code} className="px-4 py-3"><Verdict stage={byStage.get(code)} /></td>
                    ))}
                    <td className="px-4 py-3 min-w-0">
                      {missing.length ? (
                        <span className="text-[11px] text-slate-600">{missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` +${missing.length - 3}` : ''}</span>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {r.lastEvaluated ? new Date(r.lastEvaluated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPreview({ userId: r.userId, stages: r.stages.map((s) => s.stageCode) })}
                        className="text-slate-400 hover:text-[#22355E]"
                        aria-label={`Evaluate ${r.name}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Page {meta.page} of {meta.totalPages} · {meta.total} student{meta.total === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-semibold">Previous</button>
              <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-semibold">Next</button>
            </div>
          </div>
        )}
      </div>

      {preview && (
        <PreviewDrawer
          userId={preview.userId}
          stages={preview.stages.length ? preview.stages : targetStages}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
