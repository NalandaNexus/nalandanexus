import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function EmptyState({
  icon: Icon = AlertCircle,
  title = 'No items found',
  description = 'There are no active records in this view right now.',
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <div
      className={`rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] text-center flex flex-col items-center justify-center ${
        compact ? 'p-6' : 'p-10'
      }`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-center text-[#22355E] mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-[#22355E] font-display">{title}</h3>
      <p className="text-xs text-[#6E6A64] max-w-sm mt-1 mb-4">{description}</p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold transition-all shadow-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
