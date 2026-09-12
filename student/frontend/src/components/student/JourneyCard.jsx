import React from 'react';
import { Lock, CheckCircle2, PlayCircle, Sparkles } from 'lucide-react';
import { RequirementLine } from './RequirementList';

/**
 * The three-stage Nalanda Nexus journey.
 *
 * Every state here is decided by the backend - LOCKED, ELIGIBLE, ACTIVE and
 * COMPLETED come from an enrolment, a progress figure and an eligibility
 * verdict the engine produced. Rendering a stage as available would not make it
 * available: enrolment is gated server-side, so a student who reached this
 * screen with a tampered response still could not take up the course.
 *
 * A locked stage lists what is outstanding rather than just refusing. "You need
 * 5,000 XP and you have 340" is something a student can act on; a padlock is
 * not.
 */

const STATE_STYLE = {
  ACTIVE: { badge: 'bg-[#5C7A5E] text-white', label: 'Current course', Icon: PlayCircle },
  COMPLETED: { badge: 'bg-[#22355E] text-white', label: 'Completed', Icon: CheckCircle2 },
  ELIGIBLE: { badge: 'bg-[#C99A2E] text-[#2B2B28]', label: 'Unlocked', Icon: Sparkles },
  LOCKED: { badge: 'bg-[#2B2B28]/10 text-[#2B2B28]/60', label: 'Locked', Icon: Lock },
};

const STAGE_EMOJI = { PRARAMBH: '🌅', GARUD: '🦅', YODDHA: '⚔️' };

function durationLabel(duration) {
  if (!duration) return null;
  if (duration.value && duration.unit) {
    const unit = duration.unit.toLowerCase();
    return `${duration.value} ${duration.value === 1 ? unit.replace(/s$/, '') : unit}`;
  }
  return duration.label || null;
}

export default function JourneyCard({ journey = [], onContinue }) {
  if (!journey.length) return null;

  return (
    <section className="rounded-2xl bg-white border border-[#DFDACB] overflow-hidden">
      <header className="px-5 py-4 border-b border-[#DFDACB]">
        <h2 className="font-heading font-black text-sm text-[#22355E]">Your journey</h2>
        <p className="text-[11px] text-[#2B2B28]/55 mt-0.5">Three stages, each building on the one before.</p>
      </header>

      <ol className="divide-y divide-[#DFDACB]">
        {journey.map((stage) => {
          const style = STATE_STYLE[stage.state] || STATE_STYLE.LOCKED;
          const { Icon } = style;
          // Outstanding criteria only - a locked stage is asking what is left,
          // not reciting what is already done.
          const unmet = (stage.requirements || []).filter((c) => !c.passed);
          const duration = durationLabel(stage.duration);

          return (
            <li key={stage.code} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <span className="text-xl leading-none shrink-0" aria-hidden="true">
                    {STAGE_EMOJI[stage.code] || '•'}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-heading font-black text-sm text-[#22355E] truncate">
                      {stage.name}
                      {stage.tagline && <span className="font-normal text-[#2B2B28]/50"> — {stage.tagline}</span>}
                    </h3>
                    {duration && <p className="text-[11px] text-[#2B2B28]/45 uppercase tracking-wider mt-0.5">{duration}</p>}
                  </div>
                </div>

                <span className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded shrink-0 flex items-center gap-1 ${style.badge}`}>
                  <Icon className="w-3 h-3" /> {style.label}
                </span>
              </div>

              {(stage.state === 'ACTIVE' || stage.state === 'COMPLETED') && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[11px] text-[#2B2B28]/55 mb-1">
                    <span>Progress</span>
                    <span className="font-data tabular-nums">{Math.round(stage.progress)}%</span>
                  </div>
                  <div
                    className="h-2 rounded-full bg-[#2B2B28]/8 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(stage.progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${stage.name} progress`}
                  >
                    <div
                      className="h-full rounded-full bg-[#5C7A5E] transition-[width] duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, stage.progress))}%` }}
                    />
                  </div>
                  {stage.enrolment?.endsAt && (
                    <p className="text-[10px] text-[#2B2B28]/40 mt-1">
                      Runs until {new Date(stage.enrolment.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {stage.state === 'ACTIVE' && onContinue && (
                <button
                  type="button"
                  onClick={() => onContinue(stage)}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-xs transition-colors"
                >
                  Continue learning
                </button>
              )}

              {stage.state === 'LOCKED' && (
                <div className="mt-3">
                  {/* Two different reasons a stage is shut, and they call for
                      different things from the student. Unpublished criteria are
                      nothing they can work towards; unmet ones are. */}
                  {stage.eligibilityStatus === 'NOT_CONFIGURED' ? (
                    <p className="text-[11px] text-[#2B2B28]/55">
                      Entry criteria for {stage.name} have not been published yet. Nobody is admitted until they are.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-[#2B2B28]/55">
                        {stage.unlocksAfter
                          ? `Still to do before ${stage.name} opens for you:`
                          : 'Not yet available.'}
                      </p>
                      {unmet.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {unmet.map((c) => (
                            <RequirementLine key={c.key} requirement={c} />
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}

              {stage.state === 'ELIGIBLE' && (
                <p className="mt-3 text-[11px] text-[#2B2B28]/70">
                  You have earned your place here.
                  {/* Enrolment for later stages is not open yet, and saying so is
                      better than a button that fails when pressed. */}
                  {stage.course?.isPurchasable
                    ? ' Enrol to begin.'
                    : ' Enrolment opens soon — we will let you know.'}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
