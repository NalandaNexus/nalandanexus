import React from 'react';
import { Sparkles } from 'lucide-react';

export default function ProBadge({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5 gap-1',
    md: 'text-[11px] px-2.5 py-0.5 gap-1.5',
    lg: 'text-xs px-3 py-1 gap-2',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <span
      className={`inline-flex items-center font-extrabold uppercase tracking-wider rounded-md bg-[#C99A2E]/15 text-[#8F6A15] border border-[#C99A2E]/30 font-display ${sizeClasses[size]} ${className}`}
      title="Nalanda Nexus Pro Tier Feature"
    >
      <Sparkles className={`${iconSizes[size]} text-[#C99A2E] flex-shrink-0`} />
      <span>PRO</span>
    </span>
  );
}
