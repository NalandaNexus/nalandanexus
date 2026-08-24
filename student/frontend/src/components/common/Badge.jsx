import React from 'react';
import { cn } from '../../utils/cn';

export default function Badge({
  children,
  className,
  variant = 'default',
  icon: Icon,
  ...props
}) {
  const variantClasses = {
    default: 'bg-white/10 text-white/90 border-white/15',
    pill: 'bg-gradient-to-r from-purple-500/15 via-cyan-500/15 to-orange-500/15 text-slate-100 border-white/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    gold: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md transition-all',
        variantClasses[variant] || variantClasses.default,
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}
