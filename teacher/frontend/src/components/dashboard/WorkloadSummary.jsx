import React from 'react';
import { Clock } from 'lucide-react';

export default function WorkloadSummary({ workload, classCount = 0 }) {
  if (!workload) return null;

  return (
    <section aria-labelledby="workload-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 id="workload-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
            Today&apos;s Workload Overview
          </h3>
          <p className="text-xs text-[#6E6A64] mt-0.5">
            Aggregated pending tasks across all {classCount} class{classCount === 1 ? '' : 'es'}.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center gap-1.5 shadow-2xs">
          <Clock className="w-4 h-4 text-[#AB5236]" />
          <span className="text-xs font-bold text-[#22355E] font-mono">
            Est. {workload.totalEstimatedTime}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
          <span className="text-[11px] font-semibold text-[#6E6A64]">Submissions to Grade</span>
          <div className="text-xl font-extrabold text-[#22355E] font-mono tabular-nums mt-1">
            {workload.submissionsToGrade}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
          <span className="text-[11px] font-semibold text-[#6E6A64]">Quizzes to Review</span>
          <div className="text-xl font-extrabold text-[#22355E] font-mono tabular-nums mt-1">
            {workload.quizzesToReview}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
          <span className="text-[11px] font-semibold text-[#6E6A64]">Attendance Pending</span>
          <div className="text-xl font-extrabold text-[#22355E] font-mono tabular-nums mt-1">
            {workload.attendancePending}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
          <span className="text-[11px] font-semibold text-[#6E6A64]">Upcoming Lectures</span>
          <div className="text-xl font-extrabold text-[#22355E] font-mono tabular-nums mt-1">
            {workload.classesScheduled}
          </div>
        </div>
      </div>
    </section>
  );
}
