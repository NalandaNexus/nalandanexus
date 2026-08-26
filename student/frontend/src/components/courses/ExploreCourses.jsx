import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
} from 'lucide-react';
import { categories } from '../../data/courses';
import CourseCard from './CourseCard';
import { courseService } from '../../services/courseService';
import { playTone } from '../../utils/sound';

export default function ExploreCourses() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  // Real, admin-flagged Course.isPopular set - shown for the default "all"
  // view instead of an arbitrary .slice() of DB insertion order.
  const [popularCourses, setPopularCourses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([courseService.listPublicCourses(), courseService.listPopularCourses()])
      .then(([all, popular]) => {
        if (cancelled) return;
        setCourses(all);
        setPopularCourses(popular);
      })
      .catch(() => {
        // Landing-page section - fail quietly to an empty grid rather than
        // breaking the whole homepage.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilterClick = (catId) => {
    playTone(560, 'sine', 0.05, 0.03);
    setSelectedCategory(catId);
  };

  // The default "all" tab shows the admin-curated Course.isPopular set, but
  // falls back to the full published catalog when nothing is flagged popular.
  // Without this the homepage's primary course grid renders completely empty
  // whenever no course has isPopular set - which is exactly the state the
  // production database is in (confirmed live: /public/courses?popular=true
  // returns []), so every visitor saw an empty "Explore Learning" section.
  const filteredCourses =
    selectedCategory === 'all'
      ? (popularCourses.length > 0 ? popularCourses : courses)
      : courses.filter((c) => c.category === selectedCategory);

  return (
    <section className="relative py-12 sm:py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Heading */}
      <div className="text-left mb-6 sm:mb-8">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight"
        >
          Explore <span className="bg-gradient-to-r from-cyan-600 to-purple-600 dark:from-cyan-400 dark:to-purple-400 bg-clip-text text-transparent">Learning</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium"
        >
          Choose your path and start building your future
        </motion.p>
      </div>

      {/* Filter Navigation Bar (Left: Categories, Right: View All Courses + Arrows) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-white/10">
        
        {/* Category Filters Pills Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.slice(0, 6).map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleFilterClick(cat.id)}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-100 dark:bg-[#0D1424]/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            );
          })}

          {/* More dropdown pill */}
          <div className="relative">
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                selectedCategory === 'communication'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-[#0D1424]/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{selectedCategory === 'communication' ? 'Communication' : 'More'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isMoreOpen && (
              <div className="absolute left-0 mt-2 w-48 rounded-2xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-white/15 shadow-2xl p-1.5 z-30">
                <button
                  onClick={() => {
                    handleFilterClick('communication');
                    setIsMoreOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-between"
                >
                  <span>Communication</span>
                  {selectedCategory === 'communication' && <Sparkles className="w-3 h-3 text-cyan-500" />}
                </button>
                <button
                  onClick={() => {
                    handleFilterClick('business');
                    setIsMoreOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-between"
                >
                  <span>Business &amp; Ventures</span>
                  {selectedCategory === 'business' && <Sparkles className="w-3 h-3 text-cyan-500" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side: View All Courses + Carousel Navigation Buttons */}
        <div className="flex items-center gap-4 self-end md:self-auto">
          <Link
            to="/learn"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            <span>View All Courses</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => playTone(500, 'sine', 0.03, 0.02)}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors shadow-sm"
              aria-label="Previous courses"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => playTone(540, 'sine', 0.03, 0.02)}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors shadow-sm"
              aria-label="Next courses"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Subheading: Popular Courses */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-5">
        <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
        <span>Popular Courses</span>
      </div>

      {/* Courses Grid: 5 Column Layout matching template */}
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5"
      >
        <AnimatePresence>
          {filteredCourses.map((course, idx) => (
            <CourseCard key={course.id} course={course} index={idx} />
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
