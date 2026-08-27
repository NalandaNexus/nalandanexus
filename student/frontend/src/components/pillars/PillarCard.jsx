import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { playTone } from '../../utils/sound';

export default function PillarCard({ pillar, index = 0 }) {
  const isPurple = pillar.color === 'purple';
  const isCyan = pillar.color === 'cyan';
  const isOrange = pillar.color === 'orange';

  const pillarImages = {
    communicate: '/02_communicate_collaboration.png',
    compute: '/03_compute_coding.png',
    create: '/04_create_vr_design.png',
  };

  const handleMouseEnter = () => {
    playTone(isPurple ? 520 : isCyan ? 620 : 720, 'sine', 0.05, 0.03);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.15 }}
      whileHover={{ y: -6 }}
      onMouseEnter={handleMouseEnter}
      className={`group relative rounded-3xl p-5 sm:p-6 backdrop-blur-xl border transition-all duration-500 overflow-hidden shadow-xl min-h-[260px] flex flex-col justify-between ${
        isPurple
          ? 'bg-purple-50/70 dark:bg-[#0D0B1C]/90 border-purple-300/60 dark:border-purple-500/40 hover:border-purple-500 shadow-purple-900/10 dark:shadow-[0_15px_35px_rgba(139,92,246,0.18)]'
          : isCyan
          ? 'bg-cyan-50/70 dark:bg-[#061220]/90 border-cyan-300/60 dark:border-cyan-500/40 hover:border-cyan-500 shadow-cyan-900/10 dark:shadow-[0_15px_35px_rgba(6,182,212,0.18)]'
          : 'bg-orange-50/70 dark:bg-[#160B06]/90 border-orange-300/60 dark:border-orange-500/40 hover:border-orange-500 shadow-orange-900/10 dark:shadow-[0_15px_35px_rgba(249,115,22,0.18)]'
      }`}
    >
      {/* Corner Ambient Glow */}
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none"
        style={{ backgroundColor: pillar.accentColor }}
      />

      <div className="grid grid-cols-12 gap-4 h-full items-stretch relative z-10">
        {/* Left Side: Number, Title, Tagline, Explore CTA */}
        <div className="col-span-6 flex flex-col justify-between h-full pr-1">
          <div>
            <span
              className="font-heading font-bold text-xl sm:text-2xl tracking-tight block"
              style={{ color: pillar.accentColor }}
            >
              {pillar.number}
            </span>

            <h3 className="font-heading font-extrabold text-base sm:text-lg lg:text-xl text-slate-900 dark:text-white tracking-wide uppercase mt-1 mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
              {pillar.name}
            </h3>

            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {pillar.tagline}
            </p>
          </div>

          <div className="mt-4 pt-2">
            <Link
              to={pillar.link}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] rounded-full bg-slate-900 text-white dark:bg-white/10 dark:text-white hover:bg-slate-800 dark:hover:bg-white/20 border border-slate-700 dark:border-white/15 text-xs font-semibold tracking-wide transition-all shadow-sm group-hover:scale-105"
            >
              <span>Explore</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Right Side: Artwork Image */}
        <div className="col-span-6 h-full min-h-[170px] sm:min-h-[190px] rounded-2xl bg-black/10 dark:bg-black/40 border border-slate-200/80 dark:border-white/10 overflow-hidden flex items-center justify-center relative">
          <img
            src={pillarImages[pillar.id]}
            alt={`${pillar.name} Visual`}
            className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      </div>
    </motion.div>
  );
}
