import React from 'react';
import { Layers, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ClassHealthTable({ classHealth, onSelectClass }) {
  const navigate = useNavigate();
  if (!classHealth || classHealth.length === 0) return null;

  return (
    <section aria-labelledby="class-health-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#22355E]" />
            <h3 id="class-health-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
              Class Diagnostic Health Matrix
            </h3>
          </div>
          <p className="text-xs text-[#6E6A64] mt-0.5">
            Holistic snapshot across all cohorts: mean score, attendance index, engagement, and risk categorization.
          </p>
        </div>

        <button
          onClick={() => navigate('/classes')}
          className="text-xs font-bold text-[#AB5236] hover:underline hidden sm:flex items-center gap-1"
        >
          View All Classes <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#DFDACB]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F5EE] text-[#22355E] border-b border-[#DFDACB]">
            <tr>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Class</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Score</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Attendance</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Engagement</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">At-Risk Count</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Status</th>
              <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFDACB] bg-[#FFFFFF] text-[#2B2B28]">
            {classHealth.map((cls) => (
              <tr
                key={cls.id}
                onClick={() => onSelectClass && onSelectClass(cls.id)}
                className="hover:bg-[#F7F5EE] cursor-pointer transition-colors"
              >
                <td className="py-3 px-4 font-bold text-[#22355E]">{cls.className}</td>
                <td className="py-3 px-4 font-mono font-bold tabular-nums text-[#22355E]">
                  {cls.score}%
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-[#2B2B28]">
                  {cls.attendance}%
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-[#2B2B28]">
                  {cls.engagement}%
                </td>
                <td className="py-3 px-4 font-mono tabular-nums">
                  <span
                    className={
                      cls.atRiskCount > 0 ? 'text-[#C1352B] font-bold' : 'text-[#5C7A5E]'
                    }
                  >
                    {cls.atRiskCount}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      cls.status === 'Good'
                        ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/30'
                        : cls.status === 'Watch'
                        ? 'bg-[#C99A2E]/15 text-[#8F6A15] border border-[#C99A2E]/30'
                        : 'bg-[#C1352B]/15 text-[#C1352B] border border-[#C1352B]/30'
                    }`}
                  >
                    {cls.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/classes');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-xs"
                  >
                    Inspect <ArrowUpRight className="w-3 h-3 text-[#C99A2E]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
