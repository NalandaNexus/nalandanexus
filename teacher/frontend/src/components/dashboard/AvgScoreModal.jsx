import React from 'react';
import { X, TrendingUp } from 'lucide-react';

export default function AvgScoreModal({
  isOpen,
  onClose,
  breakdownData,
  totalStudents = 0,
  totalClasses = 0,
}) {
  if (!isOpen) return null;

  const hasData = Boolean(breakdownData);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#22355E]/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#FFFFFF] border border-[#DFDACB] rounded-2xl shadow-dropdown p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-center text-[#22355E]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#22355E] font-display">
                Cohort Mean Score Analysis
              </h3>
              <p className="text-xs text-[#6E6A64]">
                Aggregated diagnostics across {totalClasses} class{totalClasses === 1 ? '' : 'es'} ({totalStudents} student{totalStudents === 1 ? '' : 's'}).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#6E6A64] hover:text-[#2B2B28] hover:bg-[#F7F5EE] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!hasData ? (
          <div className="p-6 text-center text-xs text-[#6E6A64]">Loading breakdown…</div>
        ) : (
          <>
            {/* Overall Benchmark */}
            <div className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
              <span className="text-xs text-[#6E6A64] font-medium">Cohort Mean</span>
              <div className="text-3xl font-extrabold text-[#22355E] font-mono tabular-nums mt-0.5">
                {breakdownData.classAverage}%
              </div>
            </div>

            {/* Quartile Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#22355E] uppercase tracking-wider">
                Quartile Distribution
              </h4>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between">
                  <span className="font-semibold text-[#2B2B28]">Top 10% (High Mastery)</span>
                  <span className="font-bold text-[#5C7A5E] font-mono tabular-nums">{breakdownData.top10Percent}%</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between">
                  <span className="font-semibold text-[#2B2B28]">Middle 60% (Expected Standard)</span>
                  <span className="font-bold text-[#22355E] font-mono tabular-nums">{breakdownData.middle60Percent}%</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between">
                  <span className="font-semibold text-[#2B2B28]">Bottom 30% (Intervention Zone)</span>
                  <span className="font-bold text-[#C1352B] font-mono tabular-nums">{breakdownData.bottom30Percent}%</span>
                </div>
              </div>
            </div>

            {/* Outliers */}
            <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between text-xs">
              <span className="text-[#6E6A64]">Students scoring &lt; 60%</span>
              <span className="font-bold text-[#C1352B] font-mono tabular-nums">{breakdownData.studentsBelow60} students</span>
            </div>

            {/* Interpretation */}
            {breakdownData.interpretation && (
              <p className="text-[11px] text-[#6E6A64] leading-relaxed border-t border-[#EDEAE0] pt-3">
                {breakdownData.interpretation}
              </p>
            )}
          </>
        )}

        {/* Close Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#22355E] hover:bg-[#16233F] text-white text-xs font-bold transition-all shadow-xs"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
