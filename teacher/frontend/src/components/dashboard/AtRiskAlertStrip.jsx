import React, { useState } from 'react';
import { AlertTriangle, Eye, ShieldAlert, ArrowRight } from 'lucide-react';
import RiskStudentRow from './RiskStudentRow';

export default function AtRiskAlertStrip({ atRiskData, onSelectStudent }) {
  const [activeTab, setActiveTab] = useState('all');

  if (!atRiskData) return null;

  const actNowList = atRiskData.actNow || [];
  const watchList = atRiskData.watch || [];
  const totalCount = atRiskData.totalAtRisk || actNowList.length + watchList.length;

  const displayedList =
    activeTab === 'actNow'
      ? actNowList
      : activeTab === 'watch'
      ? watchList
      : atRiskData.students || [...actNowList, ...watchList];

  return (
    <section
      aria-labelledby="at-risk-heading"
      className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4"
    >
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 flex items-center justify-center text-[#C1352B]">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="at-risk-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
                Immediate Attention: At-Risk Cohort
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C1352B] text-white">
                {totalCount} Identified
              </span>
            </div>
            <p className="text-xs text-[#6E6A64] mt-0.5">
              Students falling below academic thresholds or missing consecutive assessments.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center bg-[#F7F5EE] p-1 rounded-xl border border-[#DFDACB] text-xs self-start sm:self-center">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-[#22355E] text-white shadow-xs'
                : 'text-[#6E6A64] hover:text-[#2B2B28]'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab('actNow')}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'actNow'
                ? 'bg-[#C1352B] text-white shadow-xs'
                : 'text-[#C1352B] hover:text-[#99241B]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C1352B]" />
            Act Now ({actNowList.length})
          </button>
          <button
            onClick={() => setActiveTab('watch')}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'watch'
                ? 'bg-[#C99A2E] text-white shadow-xs'
                : 'text-[#8F6A15] hover:text-[#2B2B28]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C99A2E]" />
            Watch ({watchList.length})
          </button>
        </div>
      </div>

      {/* List of at-risk students */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayedList.slice(0, 6).map((student) => (
          <RiskStudentRow
            key={student.id}
            student={student}
            category={student.riskLevel}
            onSelect={onSelectStudent}
          />
        ))}
      </div>
    </section>
  );
}
