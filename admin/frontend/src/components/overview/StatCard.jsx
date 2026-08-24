import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

export default function StatCard({
  title,
  value,
  trend,
  isPositive = true,
  icon: Icon,
  // No fake default series — a real historical trend isn't tracked yet, so
  // the sparkline simply doesn't render rather than showing invented data
  // (see StatsGrid.jsx, which never passes one today).
  sparklineData = [],
}) {
  const trendColor = isPositive ? 'text-[#5C7A5E]' : 'text-[#C1352B]';
  const trendBg = isPositive ? 'bg-[#5C7A5E]/10 border-[#5C7A5E]/20' : 'bg-[#C1352B]/10 border-[#C1352B]/20';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card hover:shadow-hover transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-[#9B9690] uppercase tracking-wider">{title}</span>
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-[#EDEAE0] border border-[#DFDACB] flex items-center justify-center text-[#22355E] group-hover:bg-[#22355E] group-hover:text-white transition-colors">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Primary Metric Value */}
        <div className="text-3xl font-bold font-mono text-[#22355E] tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      </div>

      {/* Footer Trend & Mini Sparkline */}
      <div className="mt-4 pt-3 border-t border-[#EDEAE0] flex items-center justify-between gap-2">
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold ${trendColor} ${trendBg}`}
        >
          <TrendIcon className="w-3 h-3" />
          <span>{trend}</span>
        </div>

        {/* Small Sparkline Bars */}
        <div className="flex items-end gap-1 h-5">
          {sparklineData.map((val, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-t transition-all ${
                isPositive ? 'bg-[#5C7A5E]/60 hover:bg-[#5C7A5E]' : 'bg-[#C1352B]/60 hover:bg-[#C1352B]'
              }`}
              style={{ height: `${(val / 100) * 18 + 2}px` }}
              title={`Period ${i + 1}: ${val}%`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
