import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  BrainCircuit,
  Target,
  Compass,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

export default function DueTasks() {
  const { tasks, pendingTasks } = useStudent();

  // Show up to 4 pending tasks
  const displayTasks = pendingTasks.slice(0, 4);

  const getTaskIcon = (iconName) => {
    switch (iconName) {
      case 'BrainCircuit':
        return <BrainCircuit className="w-4 h-4 text-[#22355E]" />;
      case 'Target':
        return <Target className="w-4 h-4 text-[#AB5236]" />;
      case 'Compass':
        return <Compass className="w-4 h-4 text-[#C99A2E]" />;
      case 'FileText':
      default:
        return <FileText className="w-4 h-4 text-[#22355E]" />;
    }
  };

  const getUrgencyBadge = (urgency, dueDateLabel) => {
    if (urgency === 'high' || dueDateLabel.includes('today')) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold font-data rounded-md bg-[#AB5236]/15 text-[#AB5236] border border-[#AB5236]/30">
          Due today
        </span>
      );
    }
    if (dueDateLabel.includes('Tomorrow')) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold font-data rounded-md bg-[#C99A2E]/20 text-[#8B6514] border border-[#C99A2E]/40">
          Tomorrow
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold font-data rounded-md bg-[#DFDACB]/60 text-[#2B2B28]/70">
        {dueDateLabel}
      </span>
    );
  };

  return (
    <section aria-labelledby="due-tasks-heading">
      <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-5 sm:p-6 shadow-xs">
        {/* Section Title */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#AB5236]" />
            <h2
              id="due-tasks-heading"
              className="font-display font-bold text-sm sm:text-base text-[#22355E] tracking-tight"
            >
              Due today / this week
            </h2>
          </div>
          {displayTasks.length > 0 && (
            <span className="text-xs font-data font-semibold text-[#2B2B28]/60">
              {displayTasks.length} pending
            </span>
          )}
        </div>

        {/* Task List or Empty State */}
        {displayTasks.length === 0 ? (
          /* ==================== EMPTY STATE ==================== */
          <div className="p-6 sm:p-8 rounded-xl bg-[#F2EFE6] border border-[#DFDACB] text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#5C7A5E]/15 text-[#5C7A5E] flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-base text-[#22355E] mb-1">
              You're all caught up.
            </h3>
            <p className="font-body text-xs sm:text-sm text-[#2B2B28]/75 max-w-sm mb-4">
              Nothing is due right now. Next up: Mindset — continue the next topic.
            </p>
            <Link
              to="/student/parambh"
              className="px-5 py-2.5 bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 student-focus min-h-[44px]"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          /* ==================== TASK ITEMS ==================== */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-[#DFDACB] hover:border-[#22355E]/40 transition-all shadow-2xs hover:shadow-xs group"
              >
                {/* Left Task Meta */}
                <div className="flex items-start gap-3 min-w-0 pr-2">
                  <div className="p-2 rounded-lg bg-[#FAF9F4] border border-[#DFDACB] shrink-0 mt-0.5 group-hover:bg-[#EDEAE0] transition-colors">
                    {getTaskIcon(task.iconName)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-heading font-bold text-[#22355E] truncate group-hover:text-[#AB5236] transition-colors">
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] font-body text-[#2B2B28]/70">
                        {task.type}
                      </span>
                      <span className="text-[#2B2B28]/30">·</span>
                      {getUrgencyBadge(task.urgency, task.dueDateLabel)}
                    </div>
                  </div>
                </div>

                {/* Right Action Button (min 44px touch area) */}
                <Link
                  to={task.targetUrl}
                  className="shrink-0 px-4 py-2 bg-[#FAF9F4] hover:bg-[#AB5236] text-[#22355E] hover:text-white border border-[#DFDACB] hover:border-[#AB5236] font-heading font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 student-focus min-h-[44px] min-w-[64px]"
                  aria-label={`Open task: ${task.title}`}
                >
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
