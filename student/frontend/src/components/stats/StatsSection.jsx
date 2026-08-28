import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { playTone } from '../../utils/sound';
import { statsService } from '../../services/statsService';

const STAT_META = [
  { id: 'learners', key: 'activeLearners', label: 'Active Learners', iconSrc: '/icon/active learner.png', bgGlow: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
  { id: 'courses', key: 'totalCourses', label: 'Courses & Modules', iconSrc: '/icon/curriculum.png', bgGlow: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400', suffixKey: 'totalModules', suffixLabel: 'modules' },
  { id: 'mentors', key: 'expertMentors', label: 'Expert Mentors', iconSrc: '/icon/users.png', bgGlow: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' },
  { id: 'tasks', key: 'tasksCompleted', label: 'Tasks Completed', iconSrc: '/icon/trophy.png', bgGlow: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  { id: 'satisfaction', key: 'avgRatingPercent', label: 'Learner Satisfaction', iconSrc: '/icon/star.png', bgGlow: 'bg-orange-500/10 border-orange-500/30 text-orange-400', isPercent: true },
];

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k+`;
  return String(n);
}

export default function StatsSection() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    statsService.getPublicStats().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  // Learner Satisfaction is withheld until enough genuine reviews exist - the
  // API sends null rather than a number in that case, and the tile is dropped
  // entirely instead of rendering "0%" or a placeholder figure. The grid is
  // sized from what actually renders so the remaining tiles stay balanced.
  // 0 is treated as "nothing to report" alongside null/undefined: a satisfaction
  // score of 0% is never a real measurement, and an older backend that has not
  // yet been redeployed still sends 0 rather than null when no reviews exist.
  // Guarding on both keeps the tile from ever publishing a meaningless figure.
  const visibleStats = STAT_META.filter((meta) => !(meta.isPercent && !stats[meta.key]));

  return (
    <section className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-6 mb-12">
      {/* Glassmorphism Stat Strip matching template image */}
      <div className="rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-[#0D1424]/85 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 p-4 sm:p-6 shadow-xl shadow-slate-200/60 dark:shadow-2xl">
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${visibleStats.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-white/10`}>
          {visibleStats.map((meta, idx) => {
            const rawValue = stats[meta.key] ?? 0;
            const value = meta.isPercent ? `${rawValue}%` : formatCount(rawValue);
            const suffix = meta.suffixKey && stats[meta.suffixKey] ? ` · ${formatCount(stats[meta.suffixKey])} ${meta.suffixLabel}` : '';
            return (
              <motion.div
                key={meta.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                onMouseEnter={() => playTone(440 + idx * 40, 'sine', 0.04, 0.02)}
                className={`flex items-center gap-3.5 px-2 sm:px-4 ${idx !== 0 ? 'pt-3 sm:pt-0' : ''} group cursor-default`}
              >
                {/* Custom Uploaded Icon Box */}
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 border ${meta.bgGlow} group-hover:scale-110 transition-transform p-2`}
                >
                  <img src={meta.iconSrc} alt={meta.label} className="w-full h-full object-contain filter drop-shadow" />
                </div>
                <div>
                  <div className="font-heading font-extrabold text-lg sm:text-xl md:text-2xl text-slate-900 dark:text-white tracking-tight leading-none group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                    {value}
                    {suffix && <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">{suffix}</span>}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium mt-1 leading-tight">
                    {meta.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
