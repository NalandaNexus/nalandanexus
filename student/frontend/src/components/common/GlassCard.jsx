import React from 'react';
import { cn } from '../../utils/cn';

export default function GlassCard({
  children,
  className,
  variant = 'default',
  hover = true,
  glowColor,
  ...props
}) {
  const variantStyles = {
    default: 'bg-[#0D1424]/75 dark:bg-[#0D1424]/80 border-white/10 dark:border-white/10 text-white',
    light: 'bg-white/90 dark:bg-[#0D1424]/85 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white',
    purple: 'bg-[#130E26]/75 border-purple-500/30 hover:border-purple-500/60 shadow-[0_10px_30px_rgba(139,92,246,0.15)] text-white',
    cyan: 'bg-[#0A1724]/75 border-cyan-500/30 hover:border-cyan-500/60 shadow-[0_10px_30px_rgba(6,182,212,0.15)] text-white',
    orange: 'bg-[#1C120A]/75 border-orange-500/30 hover:border-orange-500/60 shadow-[0_10px_30px_rgba(249,115,22,0.15)] text-white',
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl md:rounded-3xl backdrop-blur-xl border transition-all duration-300',
        variantStyles[variant] || variantStyles.default,
        hover && 'hover:-translate-y-1 hover:shadow-2xl',
        className
      )}
      style={
        glowColor
          ? {
              boxShadow: `0 15px 35px -5px ${glowColor}`,
            }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  );
}
