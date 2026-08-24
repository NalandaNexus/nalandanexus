import React from 'react';
import { Sparkles, ArrowRight, BookOpen, User, Calendar } from 'lucide-react';

export default function RecommendedActions({
  actions,
  onOpenStudent,
  onOpenClass,
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <section aria-labelledby="recommended-actions-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#C99A2E]" />
          <h3 id="recommended-actions-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
            Evidence-Based Diagnostic Next Steps
          </h3>
        </div>
        <span className="text-xs text-[#6E6A64] font-medium hidden sm:inline">
          Ranked by highest student learning impact
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((act) => {
          const isCritical = act.urgency === 'critical';

          return (
            <div
              key={act.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                isCritical
                  ? 'bg-[#FFFFFF] border-[#C1352B]/40 shadow-danger'
                  : 'bg-[#F7F5EE] border-[#DFDACB]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EDEAE0] text-[#22355E] border border-[#DFDACB]">
                    {act.cohort}
                  </span>
                  <span className="text-[10px] text-[#6E6A64] font-mono">
                    {act.timeEstimate}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-[#22355E] mt-2.5">
                  {act.title}
                </h4>
                <p className="text-xs text-[#6E6A64] mt-1 line-clamp-2">
                  {act.reason}
                </p>
              </div>

              {/* Primary CTA Button (Brick Terracotta: #AB5236) */}
              <div className="pt-2 border-t border-[#DFDACB]/60">
                <button
                  type="button"
                  onClick={() => {
                    if (act.targetStudentId) onOpenStudent(act.targetStudentId);
                    else if (act.targetClassId) onOpenClass(act.targetClassId);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>{act.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
