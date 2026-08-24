import React from 'react';
import { SearchX, Plus, RotateCcw } from 'lucide-react';

export default function EmptyState({
  title = 'No records found',
  description = 'Try adjusting your search criteria or clear active filters.',
  actionText = 'Clear Filters',
  onAction,
  icon: CustomIcon,
}) {
  const Icon = CustomIcon || SearchX;

  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center bg-[#F7F5EE]/60 rounded-2xl border border-dashed border-[#DFDACB]">
      <div className="w-12 h-12 rounded-2xl bg-white border border-[#DFDACB] flex items-center justify-center text-[#22355E] mb-3 shadow-sm">
        <Icon className="w-6 h-6 text-[#22355E]/80" />
      </div>
      <h3 className="text-sm font-bold text-[#22355E] mb-1">{title}</h3>
      <p className="text-xs text-[#9B9690] max-w-sm mb-4 leading-relaxed">{description}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] text-xs font-semibold text-[#22355E] transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
}
