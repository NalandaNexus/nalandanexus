import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Radio, Layers, Award, Users } from 'lucide-react';
import { playTone } from '../../utils/sound';

export default function FeatureStrip() {
  const features = [
    {
      id: 'smart-learning',
      title: 'Smart Learning',
      description: 'Personalized paths for every learner',
      icon: Bot,
      color: '#06B6D4',
      bgGlow: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
    },
    {
      id: 'live-classes',
      title: 'Live Classes',
      description: 'Interactive sessions with expert mentors',
      icon: Radio,
      color: '#8B5CF6',
      bgGlow: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'real-projects',
      title: 'Real Projects',
      description: 'Build real-world projects and skills',
      icon: Layers,
      color: '#06B6D4',
      bgGlow: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
    },
    {
      id: 'certificates',
      title: 'Certificates',
      description: 'Earn industry-recognized certificates',
      icon: Award,
      color: '#3B82F6',
      bgGlow: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'community',
      title: 'Community',
      description: 'Join a community of learners and creators',
      icon: Users,
      color: '#06B6D4',
      bgGlow: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
    },
  ];

  return (
    <section className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8 sm:my-12">
      <div className="rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-[#0D1424]/85 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 p-4 sm:p-5 shadow-xl shadow-slate-200/60 dark:shadow-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-white/10">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                onMouseEnter={() => playTone(540 + idx * 30, 'sine', 0.03, 0.02)}
                className={`flex items-center gap-3 px-2 sm:px-4 ${idx !== 0 ? 'pt-3 sm:pt-0' : ''} group cursor-default`}
              >
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${feat.bgGlow} group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                    {feat.title}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5 font-medium">
                    {feat.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
