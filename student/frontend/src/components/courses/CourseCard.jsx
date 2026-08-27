import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ArrowRight, Bell, Sparkles } from 'lucide-react';
import { playTone } from '../../utils/sound';

export default function CourseCard({ course, index = 0 }) {
  const courseImages = {
    'prarambh': '/prarambh_course_banner.jpg',
    'python-for-beginners': '/05_python_learning.png',
    'web-development-full-stack': '/06_web_development.png',
    'data-science-with-python': '/07_data_science.png',
    'ui-ux-design-fundamentals': '/08_uiux_design.png',
    'ai-machine-learning-a-z': '/09_ai_machine_learning.png',
  };

  const thumbnailSrc = courseImages[course.slug] || course.image || '/05_python_learning.png';

  const handleMouseEnter = () => {
    playTone(500 + index * 40, 'sine', 0.04, 0.02);
  };

  const isPrarambh = course.slug === 'prarambh';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      whileHover={{ y: -6 }}
      onMouseEnter={handleMouseEnter}
      className={`group relative rounded-2xl backdrop-blur-xl p-3.5 sm:p-4 transition-all duration-300 flex flex-col justify-between ${
        isPrarambh
          ? 'bg-gradient-to-b from-amber-500/10 via-white to-purple-500/10 dark:from-amber-950/30 dark:via-[#0D1424] dark:to-purple-950/30 border-2 border-amber-400/80 dark:border-amber-400/60 shadow-xl shadow-amber-500/15'
          : 'bg-white dark:bg-[#0D1424]/85 border border-slate-200/90 dark:border-white/15 hover:border-cyan-500/60 shadow-md hover:shadow-xl shadow-slate-200/60 dark:shadow-cyan-950/30'
      }`}
    >
      <div>
        {/* Top Thumbnail Image Area with Status Badge */}
        <div className="relative w-full h-36 sm:h-40 rounded-xl bg-slate-100 dark:bg-[#080E1C] border border-slate-200 dark:border-white/10 overflow-hidden flex items-center justify-center mb-3.5 group-hover:border-cyan-500/40 transition-colors">
          <img
            src={thumbnailSrc}
            alt={course.title}
            className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
          />

          {/* Status Overlay Badge */}
          {isPrarambh ? (
            <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-lg">
              <Sparkles className="w-3 h-3 fill-slate-950" />
              <span>NOW ENROLLING</span>
            </div>
          ) : (
            <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow">
              <span>🚀 UPCOMING</span>
            </div>
          )}
        </div>

        {/* Course Title & Description */}
        <h3 className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
          {course.title}
        </h3>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed font-medium">
          {course.tagline || course.description}
        </p>

        {/* Rating & Review Count */}
        <div className="flex items-center gap-1.5 mt-2.5 text-xs">
          <div className="flex items-center gap-1 text-amber-500 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{course.rating}</span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">({course.reviewsCount})</span>
        </div>
      </div>

      {/* Footer: Difficulty, Price & Link */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {course.duration}
        </span>

        {isPrarambh ? (
          <Link
            to={`/courses/${course.slug}`}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 hover:scale-105 transition-all"
          >
            <span>{course.price}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          // This course isn't purchasable yet and there's no real waitlist
          // to join - an honest disabled state instead of a fake signup
          // that silently disappears on refresh (no fake success).
          <span
            title="This course isn't open for enrollment yet"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500 text-[11px] font-semibold cursor-not-allowed"
          >
            <Bell className="w-3 h-3" />
            <span>Coming Soon</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}
