import React from 'react';
import { motion } from 'framer-motion';
import { pillars } from '../../data/pillars';
import PillarCard from './PillarCard';

export default function PillarsSection() {
  return (
    <section className="relative py-10 sm:py-14 lg:py-18 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Ambient background flares */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Section Header matching template image */}
      <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="inline-block relative"
        >
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white tracking-tight">
            The <span className="bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">3 Pillars</span> of the Digital Age
          </h2>
          {/* Subtle cyan glowing indicator line under 3 Pillars */}
          <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full mx-auto mt-2 shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
        </motion.div>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
        {pillars.map((pillar, idx) => (
          <PillarCard key={pillar.id} pillar={pillar} index={idx} />
        ))}
      </div>
    </section>
  );
}
