import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import RiskPulseIndicator from '../common/RiskPulseIndicator';

export default function RiskStudentRow({
  student,
  category = 'act_now',
  onSelect,
}) {
  const isActNow = category === 'act_now' || student.riskLevel === 'act_now';

  return (
    <div
      onClick={() => onSelect(student)}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
        isActNow
          ? 'bg-[#FFFFFF] border-[#C1352B]/40 hover:border-[#C1352B] shadow-danger'
          : 'bg-[#FFFFFF] border-[#C99A2E]/40 hover:border-[#C99A2E] shadow-attention'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          <img
            src={student.avatar}
            alt=""
            className="w-10 h-10 rounded-xl object-cover border border-[#DFDACB] bg-[#F7F5EE]"
          />
          <div className="absolute -top-1 -right-1">
            <RiskPulseIndicator level={isActNow ? 'act_now' : 'watch'} size="sm" />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs sm:text-sm font-bold text-[#22355E] group-hover:text-[#AB5236] transition-colors truncate">
              {student.name}
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F7F5EE] text-[#22355E] border border-[#DFDACB]">
              {student.className}
            </span>
          </div>
          <p className="text-[11px] text-[#6E6A64] mt-0.5 truncate">
            {student.atRiskReason || (isActNow ? 'No submissions in 5+ days' : 'Score dropped 15%')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DFDACB]/60">
        <div className="text-right">
          <span className="text-[10px] text-[#6E6A64] font-medium block">Current Score</span>
          <span
            className={`text-sm font-bold font-mono tabular-nums ${
              isActNow ? 'text-[#C1352B]' : 'text-[#C99A2E]'
            }`}
          >
            {student.score}%
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(student);
          }}
          className="px-3 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1"
        >
          Intervene <ArrowUpRight className="w-3 h-3 text-[#C99A2E]" />
        </button>
      </div>
    </div>
  );
}
