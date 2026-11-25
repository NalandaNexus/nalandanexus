import React, { useState } from 'react';
import { Save, X, AlertTriangle } from 'lucide-react';

/**
 * Adding or renaming one module - title, description, and (when
 * `canManageGating` is true) this module's own override of the mandatory-
 * progression gate. Reordering lives in the manager's up/down controls.
 * Whole-module deletion is out of scope - a module with lessons, tasks,
 * quizzes and student progress against it is a bigger blast radius than
 * this screen is for.
 *
 * `module` is null when adding a new one. `api` is { save(payload) }, bound
 * by the caller to either add or update - this editor does not decide which.
 * Every save on an existing module names the version it loaded
 * (expectedUpdatedAt); if someone else changed it first the server refuses
 * (409 MODULE_CHANGED) and this offers the current version instead of
 * silently overwriting it.
 *
 * `canManageGating` mirrors the same prop on CourseStructureManager - a
 * Teacher gets this editor without the gating control, an Admin gets both.
 * See courseGating.service.js (student backend) for what the override does:
 * null inherits the course-level setting, true/false always requires/exempts
 * this specific module regardless of it.
 */
export default function ModuleEditor({ module, api, onSaved, onConflict, onClose, canManageGating = false }) {
  const isNew = !module;
  const [title, setTitle] = useState(module?.title || '');
  const [description, setDescription] = useState(module?.description || '');
  const initialGating = module?.gatingEnabled ?? null;
  const [gatingEnabled, setGatingEnabled] = useState(initialGating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);

  const dirty =
    isNew ||
    title.trim() !== (module.title || '') ||
    description.trim() !== (module.description || '') ||
    (canManageGating && gatingEnabled !== initialGating);
  const valid = title.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setError('');
    setConflict(null);
    setBusy(true);
    try {
      const result = await api.save({
        title: title.trim(),
        description: description.trim(),
        ...(canManageGating ? { gatingEnabled } : {}),
        ...(isNew ? {} : { expectedUpdatedAt: module.updatedAt }),
      });
      onSaved?.(result);
    } catch (err) {
      if (err?.status === 409 || err?.code === 'MODULE_CHANGED') {
        const current = err?.errors?.current ?? err?.details?.current ?? null;
        setConflict({ message: err.message || 'This module was changed by someone else since you opened it.', current });
      } else {
        setError(err?.message || 'Could not save this module.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-[#D8D3C5] bg-[#FAF9F4] p-4 space-y-3" data-testid="module-editor">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#AB5236]">{isNew ? 'New module' : 'Edit module'}</h4>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[#6E6A64] hover:bg-[#EDEAE0] hover:text-[#22355E]"
          aria-label="Close module editor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label htmlFor="module-title" className="block text-xs font-semibold text-[#22355E] mb-1">
          Title
        </label>
        <input
          id="module-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus
          required
          className="w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E]"
        />
      </div>

      <div>
        <label htmlFor="module-description" className="block text-xs font-semibold text-[#22355E] mb-1">
          Description <span className="font-normal text-[#9B9690]">(optional)</span>
        </label>
        <textarea
          id="module-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={2}
          className="w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E] resize-y"
        />
      </div>

      {canManageGating && (
        <div>
          <label htmlFor="module-gating" className="block text-xs font-semibold text-[#22355E] mb-1">
            Mandatory progression for this module
          </label>
          <select
            id="module-gating"
            value={gatingEnabled === null ? 'inherit' : gatingEnabled ? 'on' : 'off'}
            onChange={(e) => setGatingEnabled(e.target.value === 'inherit' ? null : e.target.value === 'on')}
            className="w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E]"
          >
            <option value="inherit">Inherit the course setting</option>
            <option value="on">Always require (even if the course gate is off)</option>
            <option value="off">Always exempt (even if the course gate is on)</option>
          </select>
          <p className="text-[11px] text-[#9B9690] mt-1">
            Only decides whether THIS module waits on the one before it - a student still can't skip a lesson
            within the module unless this is set to exempt.
          </p>
        </div>
      )}

      {conflict && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-[#C99A2E]/10 border border-[#C99A2E]/40 text-[#7A5B12] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <span>{conflict.message} Nothing you typed has been saved.</span>
          <button
            type="button"
            onClick={() => onConflict?.(conflict.current)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white font-semibold"
          >
            Load the current version
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-xs flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-[#6E6A64] hover:bg-[#EDEAE0] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !valid || !dirty}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#AB5236] hover:bg-[#94452C] text-white shadow-sm disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> {busy ? 'Saving…' : isNew ? 'Add module' : 'Save'}
        </button>
      </div>
    </form>
  );
}
