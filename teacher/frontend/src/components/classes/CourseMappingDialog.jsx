import React, { useMemo, useState } from 'react';
import { X, Link2, AlertTriangle } from 'lucide-react';

/**
 * Deliberate course-mapping step for a batch.
 *
 * The first cut of this repair was a bare <select> on the card whose onChange
 * wrote immediately — one stray click or keyboard scroll silently attached a
 * real batch, and therefore its whole roster, to the wrong course. A mapping
 * decides which purchases count as enrollment in this batch, so it gets an
 * explicit pick-then-confirm: choosing a course only stages it, and the button
 * names the exact course being applied.
 *
 * Reassignment carries an extra warning because it is not a neutral edit: the
 * next sync reconciles against the NEW course, so students verified under the
 * old one stop matching and lose their verified status (their grades and
 * attendance are kept — see syncEnrollmentForClass).
 */
export default function CourseMappingDialog({ batch, courses, catalogAvailable, isSaving, error, onCancel, onConfirm }) {
  const [slug, setSlug] = useState(batch.studentCourseSlug || '');
  const isReassign = Boolean(batch.studentCourseSlug);

  const selected = useMemo(() => courses.find((c) => c.slug === slug) || null, [courses, slug]);
  const isUnchanged = isReassign && slug === batch.studentCourseSlug;

  return (
    <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0] disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-[#22355E] mb-1">
          {isReassign ? 'Change course mapping' : 'Link this batch to a course'}
        </h3>
        <p className="text-[11px] text-[#9B9690] mb-4">
          <span className="font-semibold text-[#2B2B28]">{batch.name}</span>
          {' — '}
          the course you pick decides whose purchase counts as enrollment in this batch.
        </p>

        {error && (
          <div className="p-2.5 mb-3 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>
        )}

        {!catalogAvailable ? (
          <div className="p-3 rounded-xl bg-[#C99A2E]/10 border border-[#C99A2E]/30 text-[#8F6A15] text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              The course catalogue could not be reached, so no course can be verified right now. Nothing has been changed —
              close this and try again in a moment.
            </span>
          </div>
        ) : courses.length === 0 ? (
          <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] text-[#6E6A64] text-xs">
            There are no published courses to link to yet. A course has to be published in the catalogue before a batch can
            point at it.
          </div>
        ) : (
          <>
            <label htmlFor="course-mapping-select" className="block text-xs font-semibold text-[#2B2B28] mb-1">
              Course
            </label>
            <select
              id="course-mapping-select"
              value={slug}
              disabled={isSaving}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] disabled:opacity-50"
            >
              <option value="">— Select a course —</option>
              {courses.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                  {c.category ? ` · ${c.category}` : ''}
                  {c.isPurchasable ? '' : ' · closed to new purchases'}
                </option>
              ))}
            </select>

            {selected && (
              <dl className="mt-3 p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] text-[11px] space-y-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#6E6A64]">Slug</dt>
                  <dd className="font-mono text-[#22355E] truncate">{selected.slug}</dd>
                </div>
                {selected.instructor && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6E6A64]">Listed instructor</dt>
                    <dd className="text-[#2B2B28] truncate">{selected.instructor}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-[#6E6A64]">Open to new purchases</dt>
                  <dd className={selected.isPurchasable ? 'text-[#5C7A5E] font-semibold' : 'text-[#8F6A15] font-semibold'}>
                    {selected.isPurchasable ? 'Yes' : 'No'}
                  </dd>
                </div>
              </dl>
            )}

            {isReassign && slug && !isUnchanged && (
              <div className="mt-3 p-3 rounded-xl bg-[#C99A2E]/10 border border-[#C99A2E]/30 text-[#8F6A15] text-[11px] flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  This batch is currently linked to <span className="font-mono">{batch.studentCourseSlug}</span>. After
                  changing it, the next sync checks enrollment against the new course — students verified under the old one
                  lose their verified status. Their grades and attendance are kept.
                </span>
              </div>
            )}
          </>
        )}

        <div className="pt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(slug)}
            disabled={isSaving || !slug || isUnchanged || !catalogAvailable}
            className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" />
            {isSaving ? 'Saving…' : selected ? `Link to ${selected.title}` : 'Select a course'}
          </button>
        </div>
      </div>
    </div>
  );
}
