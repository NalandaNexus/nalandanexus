import React from 'react';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PendingTasks({ tasks }) {
  const navigate = useNavigate();
  if (!tasks || tasks.length === 0) return null;

  return (
    <section aria-labelledby="pending-tasks-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 id="pending-tasks-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
            Priority Action Queue
          </h3>
          <p className="text-xs text-[#6E6A64] mt-0.5">
            Aggregated pending tasks sorted by upcoming deadlines.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {tasks.map((task) => {
          const isCritical = task.urgency === 'critical';

          return (
            <div
              key={task.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isCritical
                  ? 'bg-[#FFFFFF] border-[#C1352B]/40 shadow-danger'
                  : 'bg-[#F7F5EE] border-[#DFDACB]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-[#22355E] truncate">
                    {task.title}
                  </h4>
                  {isCritical && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#C1352B]/15 text-[#C1352B] border border-[#C1352B]/30">
                      URGENT
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6E6A64] mt-0.5">{task.reason}</p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DFDACB]/60">
                <span className="text-xs text-[#6E6A64] font-mono font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#22355E]" /> {task.estimatedTime}
                </span>

                {/* Action Trigger Button in Terracotta (#AB5236) */}
                <button
                  type="button"
                  onClick={() => navigate(task.actionRoute || '/grading')}
                  className="px-3 py-1.5 rounded-lg bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                >
                  <span>{task.actionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
