import React from 'react';

export default function RiskPulseIndicator({ level = 'act_now', size = 'md', className = '' }) {
  const isActNow = level === 'act_now' || level === 'critical';
  const isWatch = level === 'watch' || level === 'medium';

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };

  if (!isActNow && !isWatch) return null;

  return (
    <span
      className="relative inline-flex items-center justify-center flex-shrink-0"
      title={isActNow ? 'Urgent Intervention Required' : 'Watch Status'}
    >
      {/* Outer pulsing ping */}
      <span
        className={`absolute rounded-full opacity-75 ${
          isActNow
            ? 'bg-[#C1352B] risk-pulse-act-now'
            : 'bg-[#C99A2E] risk-pulse-watch'
        } ${sizeClasses[size]}`}
      />
      {/* Inner solid core dot */}
      <span
        className={`relative rounded-full ${
          isActNow ? 'bg-[#C1352B]' : 'bg-[#C99A2E]'
        } ${sizeClasses[size]} ${className}`}
      />
    </span>
  );
}
