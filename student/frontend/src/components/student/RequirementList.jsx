import React from 'react';
import { CheckCircle2, CircleDashed, HelpCircle } from 'lucide-react';

/**
 * One stage's entry criteria, rendered exactly as the backend decided them.
 *
 * Nothing here re-checks anything. `passed` is the server's verdict and this
 * component only chooses an icon for it - a second opinion computed in the
 * browser could disagree with the gate that actually admits the student, and
 * the disagreement would surface as a student being told they qualify and then
 * refused at enrolment.
 *
 * Three states, not two. DATA_REQUIRED means the platform has no authoritative
 * figure yet - no classes recorded, no quizzes set - and it is shown as an open
 * question rather than a failure, because the student did not fail it.
 */

/** Null means "no figure exists", which is never the same as zero. */
function formatValue(value, unit) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${Math.round(n * 10) / 10}${unit || ''}`;
}

export function RequirementLine({ requirement }) {
  const { name, operator, required, actual, unit, passed, status } = requirement;
  const pending = status === 'DATA_REQUIRED';

  return (
    <li className="flex items-center gap-2 text-xs">
      {passed ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-[#5C7A5E] shrink-0" />
      ) : pending ? (
        <HelpCircle className="w-3.5 h-3.5 text-[#B8860B] shrink-0" />
      ) : (
        <CircleDashed className="w-3.5 h-3.5 text-[#2B2B28]/25 shrink-0" />
      )}

      <span className={`min-w-0 truncate ${passed ? 'text-[#2B2B28]/60' : 'text-[#2B2B28]'}`}>{name}</span>

      <span className="ml-auto font-data tabular-nums text-[11px] shrink-0 text-[#2B2B28]/60">
        {pending ? (
          <span className="text-[#B8860B]">Not recorded yet</span>
        ) : (
          <>
            {formatValue(actual, unit)}
            <span className="text-[#2B2B28]/35"> / {operator} {formatValue(required, unit)}</span>
          </>
        )}
      </span>
    </li>
  );
}

/**
 * `status` is carried separately from the list because an empty list is
 * ambiguous on its own: it could mean nobody has published criteria yet, which
 * is emphatically not the same as having no criteria left to meet.
 */
export default function RequirementList({ requirements = [], status, emptyHint }) {
  if (status === 'NOT_CONFIGURED') {
    return (
      <p className="text-xs text-[#2B2B28]/50">
        Entry criteria for this stage have not been published yet. Nobody can be admitted until they are.
      </p>
    );
  }

  if (!requirements.length) {
    return <p className="text-xs text-[#2B2B28]/50">{emptyHint || 'No criteria to show.'}</p>;
  }

  return <ul className="space-y-1.5">{requirements.map((r) => <RequirementLine key={r.key} requirement={r} />)}</ul>;
}
