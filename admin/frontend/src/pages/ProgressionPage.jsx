import React, { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal, Save, RefreshCw, Info, AlertTriangle } from 'lucide-react';
import { adminApi } from '../services/adminApi';

/**
 * The Nalanda Nexus progression control centre.
 *
 * Every number the engine consults is edited here: XP per activity, the level
 * curve, rank thresholds, the weights behind each skill and overall power, and
 * what each stage requires before a student may buy the next one.
 *
 * Saving a rule does NOT restate existing students. That is deliberate and the
 * page says so - a weight change can move thousands of scores, and an
 * administrator should choose when that happens rather than discover it as a
 * side effect of a form submission. Recalculation is its own button, and it
 * reports how many students remain so a large cohort can be swept in passes.
 */

const TABS = ['XP', 'Levels & Ranks', 'Weights', 'Stages', 'Achievements'];

function NumberField({ label, value, onChange, min = 0, max, suffix, hint }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? 0}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums"
        />
        {suffix && <span className="text-xs text-slate-400 shrink-0">{suffix}</span>}
      </div>
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export default function ProgressionPage() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState(TABS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await adminApi.getProgressionRules();
      setData(res);
      setDraft(JSON.parse(JSON.stringify(res?.rules || {})));
    } catch (err) {
      setError(err.message || 'Could not load progression rules.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveRules = async () => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await adminApi.updateProgressionRules({
        xpRules: draft.xpRules,
        levels: draft.levels,
        ranks: draft.ranks,
        skillWeights: draft.skillWeights,
        knowledgeWeights: draft.knowledgeWeights,
        consistency: draft.consistency,
        overallPower: draft.overallPower,
        attendance: draft.attendance,
      });
      setNotice('Rules saved. Existing students keep their current scores until you recalculate.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setIsSaving(false);
    }
  };

  const recalculate = async () => {
    setIsRecalculating(true);
    setError('');
    setNotice('');
    try {
      const result = await adminApi.recalculateProgression({ limit: 200 });
      setNotice(
        result.remaining > 0
          ? `${result.recalculated} student(s) recalculated. ${result.remaining} still to go — run it again to continue.`
          : `${result.recalculated} student(s) recalculated. Everyone is up to date.`
      );
    } catch (err) {
      setError(err.message || 'Could not recalculate.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const saveStage = async (code, requirements) => {
    setIsSaving(true);
    try {
      await adminApi.updateProgressionStage(code, { requirements });
      setNotice(`${code} requirements saved.`);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the stage.');
    } finally {
      setIsSaving(false);
    }
  };

  const setDraftPath = (path, value) =>
    setDraft((d) => {
      const next = JSON.parse(JSON.stringify(d));
      let node = next;
      for (let i = 0; i < path.length - 1; i += 1) node = node[path[i]];
      node[path[path.length - 1]] = value;
      return next;
    });

  if (isLoading) return <div className="p-8 text-center text-sm text-slate-400">Loading…</div>;

  if (!data || !draft) {
    return (
      <div className="p-8 rounded-xl bg-white border border-slate-200 text-center">
        <AlertTriangle className="w-5 h-5 mx-auto text-amber-500" />
        <p className="text-sm text-slate-600 mt-2">{error || 'Progression rules are unavailable right now.'}</p>
        <button type="button" onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const subjects = data.subjects || [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#22355E] flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6" /> Progression Control Centre
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every number the progression engine uses. Students see the results, never these.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={recalculate}
            disabled={isRecalculating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Recalculating…' : 'Recalculate students'}
          </button>
          <button
            type="button"
            onClick={saveRules}
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#22355E] hover:bg-[#16233F] text-white font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Saving…' : 'Save rules'}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {notice && <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{notice}</div>}

      {/* The single most surprising thing about this page, said up front. */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-px text-slate-400" />
        <span>
          Saving changes how <strong>future</strong> activity is scored. Students keep their current figures until you
          recalculate, so a weight change never silently restates a cohort mid-term.
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              tab === t ? 'bg-[#22355E] text-white border-[#22355E]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'XP' && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="text-left font-semibold px-4 py-2.5">Activity</th>
                  <th className="text-right font-semibold px-4 py-2.5">Base XP</th>
                  <th className="text-right font-semibold px-4 py-2.5">Bonus</th>
                  <th className="text-right font-semibold px-4 py-2.5">Bonus at</th>
                  <th className="text-left font-semibold px-4 py-2.5">Award policy</th>
                  <th className="text-right font-semibold px-4 py-2.5">Daily cap</th>
                  <th className="text-center font-semibold px-4 py-2.5">On</th>
                </tr>
              </thead>
              <tbody>
                {(draft.xpRules || []).map((rule, i) => (
                  <tr key={rule.activityType} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{rule.activityType}</td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" value={rule.baseXP ?? 0}
                        onChange={(e) => setDraftPath(['xpRules', i, 'baseXP'], Number(e.target.value))}
                        className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right tabular-nums" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" value={rule.bonusXP ?? 0}
                        onChange={(e) => setDraftPath(['xpRules', i, 'bonusXP'], Number(e.target.value))}
                        className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right tabular-nums" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" max="100" value={rule.highScoreThreshold ?? 90}
                        onChange={(e) => setDraftPath(['xpRules', i, 'highScoreThreshold'], Number(e.target.value))}
                        className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right tabular-nums" />
                    </td>
                    <td className="px-2 py-2">
                      <select value={rule.awardPolicy}
                        onChange={(e) => setDraftPath(['xpRules', i, 'awardPolicy'], e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                        title="What counts as the same event: FIRST_ONLY means a retake pays nothing.">
                        {['FIRST_ONLY', 'PASSED_ONLY', 'BEST_IMPROVEMENT', 'EVERY_TIME'].map((p) => (
                          <option key={p} value={p}>{p.replace(/_/g, ' ').toLowerCase()}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" value={rule.maxDailyXP ?? 0}
                        onChange={(e) => setDraftPath(['xpRules', i, 'maxDailyXP'], Number(e.target.value))}
                        title="0 means uncapped"
                        className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right tabular-nums" />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input type="checkbox" checked={rule.enabled !== false}
                        onChange={(e) => setDraftPath(['xpRules', i, 'enabled'], e.target.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-200">
            A disabled rule stops paying but the activity is still recorded and still counts toward skills.
          </p>
        </div>
      )}

      {tab === 'Levels & Ranks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-[#22355E]">Level curve</h2>
            <NumberField label="XP per level" value={draft.levels?.xpPerLevel} min={1}
              onChange={(v) => setDraftPath(['levels', 'xpPerLevel'], v)}
              hint="Linear: level = floor(total XP / this) + 1" />
            <NumberField label="Maximum level" value={draft.levels?.maxLevel} min={1}
              onChange={(v) => setDraftPath(['levels', 'maxLevel'], v)} />
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <h2 className="text-sm font-bold text-[#22355E] mb-3">Ranks</h2>
            <p className="text-[11px] text-slate-400 mb-3">
              A rank needs both a level and an overall power, so it cannot be reached by grinding XP alone.
            </p>
            <div className="space-y-2">
              {(draft.ranks || []).map((rank, i) => (
                <div key={rank.code} className="flex items-center gap-2">
                  <span className="w-8 font-bold text-[#22355E] text-sm">{rank.code}</span>
                  <span className="flex-1 text-xs text-slate-500 truncate">{rank.name}</span>
                  <input type="number" min="1" value={rank.minLevel} title="Minimum level"
                    onChange={(e) => setDraftPath(['ranks', i, 'minLevel'], Number(e.target.value))}
                    className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right text-xs tabular-nums" />
                  <input type="number" min="0" max="100" value={rank.minOverallPower} title="Minimum overall power"
                    onChange={(e) => setDraftPath(['ranks', i, 'minOverallPower'], Number(e.target.value))}
                    className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right text-xs tabular-nums" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Weights' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-[#22355E]">Skill score</h2>
            <p className="text-[11px] text-slate-400">
              Relative, not percentages. Only components a student has data for are counted, so an early score is not
              dragged down by a quiz that does not exist yet.
            </p>
            {['lessons', 'quizzes', 'tasks', 'assessments'].map((k) => (
              <NumberField key={k} label={k[0].toUpperCase() + k.slice(1)} value={draft.skillWeights?.[k]}
                onChange={(v) => setDraftPath(['skillWeights', k], v)} />
            ))}
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-[#22355E]">Overall power</h2>
            {(draft.overallPower?.subjects || []).map((s, i) => (
              <NumberField key={s.subjectCode}
                label={subjects.find((x) => x.code === s.subjectCode)?.name || s.subjectCode}
                value={s.weight}
                onChange={(v) => setDraftPath(['overallPower', 'subjects', i, 'weight'], v)} />
            ))}
            {['attendance', 'knowledge', 'consistency'].map((k) => (
              <NumberField key={k} label={k[0].toUpperCase() + k.slice(1)} value={draft.overallPower?.[k]}
                onChange={(v) => setDraftPath(['overallPower', k], v)} />
            ))}
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-[#22355E]">Knowledge score</h2>
            {['quizzes', 'tasks', 'assessments'].map((k) => (
              <NumberField key={k} label={k[0].toUpperCase() + k.slice(1)} value={draft.knowledgeWeights?.[k]}
                onChange={(v) => setDraftPath(['knowledgeWeights', k], v)} />
            ))}
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-[#22355E]">Consistency & attendance</h2>
            <NumberField label="Target streak" value={draft.consistency?.targetStreakDays} min={1} suffix="days"
              onChange={(v) => setDraftPath(['consistency', 'targetStreakDays'], v)} />
            <NumberField label="Active-days window" value={draft.consistency?.windowDays} min={1} suffix="days"
              onChange={(v) => setDraftPath(['consistency', 'windowDays'], v)} />
            <NumberField label="Credit for a late mark" value={draft.attendance?.lateCreditPercent} min={0} max={100} suffix="%"
              onChange={(v) => setDraftPath(['attendance', 'lateCreditPercent'], v)} />
          </div>
        </div>
      )}

      {tab === 'Stages' && (
        <div className="space-y-4">
          {(data.stages || []).map((stage) => (
            <StageCard key={stage.code} stage={stage} subjects={subjects} onSave={saveStage} disabled={isSaving} />
          ))}
        </div>
      )}

      {tab === 'Achievements' && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {(data.achievements || []).map((a) => (
              <li key={a.code} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{a.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-600">
                    {a.criteriaType.replace(/_/g, ' ').toLowerCase()} ≥ {a.criteriaValue}
                    {a.subjectCode ? ` · ${a.subjectCode}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">{a.xpReward} XP · {a.enabled ? 'enabled' : 'disabled'}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * One stage's completion requirements.
 *
 * Saved on its own rather than with the global rules: these decide who may buy
 * the next course, and mixing that into a bulk save makes it too easy to change
 * by accident.
 */
function StageCard({ stage, subjects, onSave, disabled }) {
  const [req, setReq] = useState(() => JSON.parse(JSON.stringify(stage.requirements || {})));

  const setField = (key, value) => setReq((r) => ({ ...r, [key]: value }));
  const setSubject = (code, minScore) =>
    setReq((r) => {
      const existing = (r.subjects || []).filter((s) => s.subjectCode !== code);
      return { ...r, subjects: [...existing, { subjectCode: code, minScore, required: true }] };
    });

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#22355E]">{stage.name} — {stage.tagline}</h2>
          <p className="text-[11px] text-slate-400">
            {stage.courseSlug ? `Course: ${stage.courseSlug}` : 'No course linked yet'}
            {stage.nextStageCode ? ` · unlocks ${stage.nextStageCode}` : ' · final stage'}
          </p>
        </div>
        <button type="button" onClick={() => onSave(stage.code, req)} disabled={disabled}
          className="px-3 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-xs font-semibold disabled:opacity-50 shrink-0">
          Save
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <NumberField label="Min stage progress" value={req.minStageProgress} max={100} suffix="%"
          onChange={(v) => setField('minStageProgress', v)} />
        <NumberField label="Min XP" value={req.minXP} onChange={(v) => setField('minXP', v)} />
        <NumberField label="Min attendance" value={req.minAttendance} max={100} suffix="%"
          onChange={(v) => setField('minAttendance', v)} />
        <NumberField label="Min knowledge" value={req.minKnowledge} max={100}
          onChange={(v) => setField('minKnowledge', v)} />
        <NumberField label="Min consistency" value={req.minConsistency} max={100}
          onChange={(v) => setField('minConsistency', v)} />
        <NumberField label="Min overall power" value={req.minOverallPower} max={100}
          onChange={(v) => setField('minOverallPower', v)} />
      </div>

      <div className="px-4 pb-4">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">Minimum subject scores</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {subjects.map((s) => (
            <NumberField key={s.code} label={s.name} max={100}
              value={(req.subjects || []).find((x) => x.subjectCode === s.code)?.minScore ?? 0}
              onChange={(v) => setSubject(s.code, v)} />
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          A stage with every requirement at zero is reported as <strong>not</strong> eligible — clearing the form does
          not hand out the next stage.
        </p>
      </div>
    </div>
  );
}
