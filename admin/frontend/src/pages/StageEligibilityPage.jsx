import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, Plus, Trash2, Save, CheckCircle2, XCircle, AlertTriangle,
  Eye, Ban, ChevronLeft, Info,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';

/**
 * Configuring who may move from one stage to the next.
 *
 * The screen is built around a single distinction: a draft decides nothing, and
 * publishing is the moment it starts deciding who may progress. Everything
 * destructive is therefore two steps, and the difference between the live rule
 * and the one being edited is always on screen.
 *
 * No threshold is evaluated here. The builder posts a rule and the backend
 * answers with a verdict - including in the preview, which runs a real student
 * against the real engine rather than re-implementing it in JavaScript.
 */

const STATUS_TONE = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  NOT_CONFIGURED: 'bg-slate-100 text-slate-500 border-slate-200',
  STARTING_STAGE: 'bg-[#22355E]/8 text-[#22355E] border-[#22355E]/20',
  DISABLED: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABEL = {
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  NOT_CONFIGURED: 'Not configured',
  STARTING_STAGE: 'Starting stage',
  DISABLED: 'Disabled',
};

const newKey = () => `r-${Math.random().toString(36).slice(2, 9)}`;

/**
 * The fields a metric needs, defaulted from its own definition.
 *
 * A hardcoded `operator: 'GTE'` was fine only because the first metric in the
 * list happens to be numeric. Reorder the list on the server - or add a metric
 * that takes IS / IS_NOT - and a new row would carry an operator its metric
 * rejects, showing one thing in the dropdown and saving another.
 */
function defaultsForMetric(definition, subjects, achievements) {
  return {
    metric: definition?.metric || 'XP',
    operator: definition?.operators?.[0]?.code || 'GTE',
    subjectCode: definition?.needs === 'subjectCode' ? subjects[0]?.code || null : null,
    achievementCode: definition?.needs === 'achievementCode' ? achievements[0]?.code || null : null,
  };
}

/**
 * A select that never lies about what is selected.
 *
 * When a rule references a subject or achievement that has since been disabled
 * or deleted, the stored code has no matching option. Left alone the browser
 * displays the first option instead, so an administrator opening an old rule
 * would see "English" where the rule actually says something else - and saving
 * would quietly keep the wrong one. The missing code is added as an explicit,
 * marked option so the discrepancy is visible and correctable.
 */
function CodeSelect({ value, options, onChange, disabled, label }) {
  const known = options.some((o) => o.code === value);
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`bg-slate-50 border rounded-lg px-2.5 py-1.5 text-sm ${known ? 'border-slate-200' : 'border-red-300 text-red-700'}`}
      aria-label={label}
    >
      {!value && <option value="">Choose…</option>}
      {!known && value && <option value={value}>{value} (no longer available)</option>}
      {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
    </select>
  );
}

function StatusChip({ status }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_TONE[status] || STATUS_TONE.NOT_CONFIGURED}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

/** One row of the builder. The metric decides which inputs are even shown. */
function RequirementRow({ requirement, metrics, subjects, achievements, onChange, onRemove, disabled }) {
  const definition = metrics.find((m) => m.metric === requirement.metric);
  const needsSubject = definition?.needs === 'subjectCode';
  const needsAchievement = definition?.needs === 'achievementCode';

  const set = (patch) => onChange({ ...requirement, ...patch });

  return (
    <div className={`p-3 rounded-xl border ${requirement.enabled === false ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={requirement.metric}
          onChange={(e) => {
            const next = metrics.find((m) => m.metric === e.target.value);
            // Switching metric can invalidate the operator and the code it
            // needs, so both are reset to something the new metric accepts
            // rather than left dangling.
            set(defaultsForMetric({ ...next, metric: e.target.value }, subjects, achievements));
          }}
          disabled={disabled}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm min-w-[12rem]"
          aria-label="Requirement"
        >
          {metrics.map((m) => (
            <option key={m.metric} value={m.metric}>{m.label}</option>
          ))}
        </select>

        {needsSubject && (
          <CodeSelect
            value={requirement.subjectCode}
            options={subjects}
            onChange={(v) => set({ subjectCode: v })}
            disabled={disabled}
            label="Subject"
          />
        )}

        {needsAchievement && (
          <CodeSelect
            value={requirement.achievementCode}
            options={achievements}
            onChange={(v) => set({ achievementCode: v })}
            disabled={disabled}
            label="Achievement"
          />
        )}

        <select
          value={requirement.operator}
          onChange={(e) => set({ operator: e.target.value })}
          disabled={disabled}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono"
          aria-label="Operator"
        >
          {(definition?.operators || []).map((op) => (
            <option key={op.code} value={op.code}>{op.symbol}</option>
          ))}
        </select>

        {!needsAchievement && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max={definition?.max ?? undefined}
              value={requirement.value ?? 0}
              onChange={(e) => set({ value: e.target.value === '' ? 0 : Number(e.target.value) })}
              disabled={disabled}
              className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm tabular-nums"
              aria-label="Value"
            />
            {definition?.unit && <span className="text-xs text-slate-400">{definition.unit}</span>}
          </div>
        )}

        <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
          <input
            type="checkbox"
            checked={requirement.enabled !== false}
            onChange={(e) => set({ enabled: e.target.checked })}
            disabled={disabled}
          />
          Enabled
        </label>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
          aria-label="Remove requirement"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function GroupEditor({ group, index, metrics, subjects, achievements, onChange, onRemove, disabled }) {
  const setRequirement = (i, requirement) => {
    const next = [...group.requirements];
    next[i] = requirement;
    onChange({ ...group, requirements: next });
  };

  const addRequirement = () =>
    onChange({
      ...group,
      requirements: [
        ...group.requirements,
        { key: newKey(), ...defaultsForMetric(metrics[0], subjects, achievements), value: 0, enabled: true },
      ],
    });

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={group.logic}
          onChange={(e) => onChange({ ...group, logic: e.target.value })}
          disabled={disabled}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          aria-label="Group logic"
        >
          <option value="ALL">ALL of these</option>
          <option value="ANY">ANY of these</option>
        </select>
        {index > 0 && (
          <input
            value={group.label || ''}
            onChange={(e) => onChange({ ...group, label: e.target.value })}
            placeholder="Group name (optional)"
            disabled={disabled}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs flex-1 min-w-0"
          />
        )}
        {index > 0 && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
            aria-label="Remove group"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {group.requirements.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          An empty group cannot be published — add a requirement or remove the group.
        </p>
      )}

      <div className="space-y-2">
        {group.requirements.map((r, i) => (
          <RequirementRow
            key={r.key}
            requirement={r}
            metrics={metrics}
            subjects={subjects}
            achievements={achievements}
            disabled={disabled}
            onChange={(next) => setRequirement(i, next)}
            onRemove={() => onChange({ ...group, requirements: group.requirements.filter((_, j) => j !== i) })}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addRequirement}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:underline disabled:opacity-50"
      >
        <Plus className="w-3.5 h-3.5" /> Add requirement
      </button>
    </div>
  );
}

export default function StageEligibilityPage() {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [rootGroup, setRootGroup] = useState({ logic: 'ALL', requirements: [] });
  const [groups, setGroups] = useState([]);
  const [validation, setValidation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setList(await adminApi.listStageEligibility());
    } catch (err) {
      setError(err.message || 'Could not load stage eligibility.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openStage = async (stageCode, { keepMessages = false } = {}) => {
    setIsBusy(true);
    setError('');
    // Reloading after a publish must not erase what the publish just said -
    // especially the warnings, which are the whole point of surfacing them.
    if (!keepMessages) {
      setNotice('');
      setValidation(null);
    }
    try {
      const d = await adminApi.getStageEligibility(stageCode);
      setDetail(d);
      setSelected(stageCode);
      // Edit the draft if there is one, otherwise start from the live rule so
      // a change is a revision rather than a blank page.
      const source = d.draft || d.published;
      setRootGroup(source?.rootGroup ? JSON.parse(JSON.stringify(source.rootGroup)) : { logic: 'ALL', requirements: [] });
      setGroups(source?.groups ? JSON.parse(JSON.stringify(source.groups)) : []);
    } catch (err) {
      setError(err.message || 'Could not open this stage.');
    } finally {
      setIsBusy(false);
    }
  };

  const payload = () => ({ rootGroup, groups });

  const saveDraft = async () => {
    setIsBusy(true); setError(''); setNotice('');
    try {
      await adminApi.saveStageEligibilityDraft(selected, payload());
      await Promise.all([loadList(), openStage(selected, { keepMessages: true })]);
      setNotice('Draft saved. It affects nobody until you publish it.');
    } catch (err) { setError(err.message || 'Could not save the draft.'); }
    finally { setIsBusy(false); }
  };

  const validate = async () => {
    setIsBusy(true); setError('');
    try {
      setValidation(await adminApi.validateStageEligibility(selected, payload()));
    } catch (err) { setError(err.message || 'Could not validate.'); }
    finally { setIsBusy(false); }
  };

  const publish = async () => {
    setIsBusy(true); setError(''); setNotice('');
    try {
      await adminApi.saveStageEligibilityDraft(selected, payload());
      const result = await adminApi.publishStageEligibility(selected);
      await Promise.all([loadList(), openStage(selected, { keepMessages: true })]);
      setNotice(
        `Version ${result?.rule?.version} is live.` +
          (result?.warnings?.length ? ` ${result.warnings.length} warning(s) were recorded.` : '')
      );
      setValidation(result?.warnings?.length ? { valid: true, errors: [], warnings: result.warnings } : null);
    } catch (err) { setError(err.message || 'Could not publish.'); }
    finally { setIsBusy(false); }
  };

  const disable = async () => {
    setIsBusy(true); setError(''); setNotice('');
    try {
      await adminApi.disableStageEligibility(selected);
      await Promise.all([loadList(), openStage(selected, { keepMessages: true })]);
      setNotice('Rule disabled. This stage now has no published criteria, so nobody can progress into it.');
    } catch (err) { setError(err.message || 'Could not disable.'); }
    finally { setIsBusy(false); }
  };

  if (isLoading) return <div className="p-8 text-center text-sm text-slate-400">Loading…</div>;

  // --- list view -------------------------------------------------------------
  if (!selected) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-2xl font-bold text-[#22355E] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Stage Eligibility
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            What a student must achieve before they can move to the next stage.
          </p>
        </div>

        {error && <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <div className="space-y-3">
          {list.map((row) => (
            <div key={row.stageCode} className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-[#22355E]">{row.stageName}</h2>
                  <StatusChip status={row.status} />
                  {row.publishedVersion && <span className="text-[11px] text-slate-400">v{row.publishedVersion}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {row.isStartingStage
                    ? 'Starting stage — no prerequisite'
                    : `${row.previousStageName} → ${row.stageName}`}
                </p>
                {row.status === 'PUBLISHED' && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {row.publishedRequirements} requirement{row.publishedRequirements === 1 ? '' : 's'}
                    {row.publishedAt ? ` · published ${new Date(row.publishedAt).toLocaleDateString('en-IN')}` : ''}
                    {row.publishedBy ? ` by ${row.publishedBy}` : ''}
                  </p>
                )}
                {row.status === 'NOT_CONFIGURED' && !row.isStartingStage && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Students cannot progress to {row.stageName} until criteria are published.
                  </p>
                )}
                {row.draftVersion && row.status !== 'DRAFT' && (
                  <p className="text-[11px] text-amber-700 mt-0.5">Draft v{row.draftVersion} in progress</p>
                )}
              </div>

              {!row.isStartingStage && (
                <button
                  type="button"
                  onClick={() => openStage(row.stageCode)}
                  className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#16233F] text-white text-sm font-semibold shrink-0"
                >
                  Configure eligibility
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- builder ---------------------------------------------------------------
  const metrics = detail?.metrics || [];

  return (
    <div className="space-y-5 pb-12">
      <button
        type="button"
        onClick={() => { setSelected(null); setDetail(null); setValidation(null); }}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#22355E]"
      >
        <ChevronLeft className="w-4 h-4" /> All stages
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#22355E]">{detail?.stage?.name} eligibility</h1>
          <p className="text-sm text-slate-500 mt-1">
            {detail?.previousStage?.name} → {detail?.stage?.name}
            {detail?.published ? ` · live version ${detail.published.version}` : ' · nothing published yet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={validate} disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold disabled:opacity-50">
            <Eye className="w-3.5 h-3.5" /> Validate
          </button>
          <button type="button" onClick={saveDraft} disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> Save draft
          </button>
          <button type="button" onClick={publish} disabled={isBusy}
            className="flex items-center gap-2 bg-[#22355E] hover:bg-[#16233F] text-white font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-60">
            <CheckCircle2 className="w-4 h-4" /> Publish
          </button>
          {detail?.published && (
            <button type="button" onClick={disable} disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold disabled:opacity-50">
              <Ban className="w-3.5 h-3.5" /> Disable
            </button>
          )}
        </div>
      </div>

      {error && <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {notice && <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{notice}</div>}

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-px text-slate-400" />
        <span>
          A draft changes nothing for students. Only the published version decides who may progress, and it applies
          from the moment a student is next evaluated — enrolling, completing an activity, or an explicit recalculation.
          Stored verdicts on the Student Eligibility page keep showing the previous rule until then; run a recalculation
          from Progression if you need the whole roster re-checked now. Publishing never alters XP, scores or achievements.
        </span>
      </div>

      {validation && (
        <div className="space-y-2">
          {validation.errors?.map((e, i) => (
            <div key={`e-${i}`} className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-px" /> {e}
            </div>
          ))}
          {validation.warnings?.map((w, i) => (
            <div key={`w-${i}`} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> {w}
            </div>
          ))}
          {validation.valid && !validation.warnings?.length && !validation.errors?.length && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" /> This rule is valid and can be published.
            </div>
          )}
        </div>
      )}

      <GroupEditor
        group={rootGroup}
        index={0}
        metrics={metrics}
        subjects={detail?.subjects || []}
        achievements={detail?.achievements || []}
        disabled={isBusy}
        onChange={setRootGroup}
      />

      {groups.map((g, i) => (
        <GroupEditor
          key={`g-${i}`}
          group={g}
          index={i + 1}
          metrics={metrics}
          subjects={detail?.subjects || []}
          achievements={detail?.achievements || []}
          disabled={isBusy}
          onChange={(next) => setGroups(groups.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setGroups(groups.filter((_, j) => j !== i))}
        />
      ))}

      <button
        type="button"
        onClick={() => setGroups([...groups, { logic: 'ANY', label: '', requirements: [] }])}
        disabled={isBusy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-sm font-semibold disabled:opacity-50"
      >
        <Plus className="w-4 h-4" /> Add a group
      </button>
    </div>
  );
}
