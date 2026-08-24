import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Code2, Palette, Sparkles } from 'lucide-react';
import { playTone } from '../../utils/sound';

export default function FloatingPillarCard({
  type = 'communicate',
  className = '',
  style = {},
}) {
  const configs = {
    communicate: {
      title: 'COMMUNICATE',
      subtitle: 'Share ideas, collaborate and connect globally.',
      icon: MessageSquare,
      accent: '#A855F7',
      glow: 'rgba(168, 85, 247, 0.3)',
      badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
      borderHover: 'hover:border-purple-400',
      link: '/learn?pillar=communicate',
      initialY: 0,
      floatDuration: 5.2,
    },
    compute: {
      title: 'COMPUTE',
      subtitle: 'Code, analyze and solve real-world problems.',
      icon: Code2,
      accent: '#06B6D4',
      glow: 'rgba(6, 182, 212, 0.3)',
      badgeClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
      borderHover: 'hover:border-cyan-400',
      link: '/learn?pillar=compute',
      initialY: 4,
      floatDuration: 5.8,
    },
    create: {
      title: 'CREATE',
      subtitle: 'Design, innovate and build solutions that matter.',
      icon: Palette,
      accent: '#F97316',
      glow: 'rgba(249, 115, 22, 0.3)',
      badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30',
      borderHover: 'hover:border-orange-400',
      link: '/learn?pillar=create',
      initialY: -2,
      floatDuration: 6.2,
    },
  };

  const config = configs[type] || configs.communicate;
  const Icon = config.icon;

  const handleMouseEnter = () => {
    playTone(type === 'communicate' ? 520 : type === 'compute' ? 620 : 720, 'sine', 0.04, 0.02);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 15 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [config.initialY, config.initialY - 6, config.initialY],
      }}
      transition={{
        opacity: { duration: 0.6 },
        scale: { duration: 0.6 },
        y: {
          duration: config.floatDuration,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
      whileHover={{ scale: 1.05, y: config.initialY - 10 }}
      onMouseEnter={handleMouseEnter}
      className={`group z-30 cursor-pointer ${className}`}
      style={style}
    >
      <Link
        to={config.link}
        className={`block p-2.5 sm:p-3 rounded-2xl bg-white/95 dark:bg-[#0D1424]/90 backdrop-blur-xl border border-slate-200 dark:border-white/20 ${config.borderHover} shadow-xl transition-all duration-300 max-w-[200px] sm:max-w-[220px]`}
        style={{
          boxShadow: `0 10px 25px -4px ${config.glow}`,
        }}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border ${config.badgeClass} group-hover:scale-110 transition-transform`}
          >
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h4 className="text-[11px] sm:text-xs font-heading font-extrabold text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-1">
              {config.title}
              <Sparkles className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
            </h4>
            <p className="text-[9.5px] sm:text-[10.5px] text-slate-600 dark:text-slate-300 leading-tight mt-0.5 line-clamp-2">
              {config.subtitle}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
