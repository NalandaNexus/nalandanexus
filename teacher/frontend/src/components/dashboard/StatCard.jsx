import React from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';

export default function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  isInteractive = false,
  onClick,
}) {
  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      className={`p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] transition-all flex flex-col justify-between group ${
        isInteractive
          ? 'cursor-pointer hover:border-[#22355E] hover:bg-[#F7F5EE]'
          : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#6E6A64] tracking-tight">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-center text-[#22355E] group-hover:scale-105 transition-transform">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-extrabold text-[#22355E] font-mono tabular-nums tracking-tight">
          {value}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-[#6E6A64] font-medium">{subtext}</span>
          {isInteractive && (
            <span className="text-[11px] font-bold text-[#AB5236] group-hover:underline flex items-center gap-0.5">
              Deep-dive <ArrowUpRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
