import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Sparkles, BookOpen, Layers, ArrowRight } from 'lucide-react';
import { categories } from '../data/courses';
import { pillars } from '../data/pillars';
import CourseCard from '../components/courses/CourseCard';
import { courseService } from '../services/courseService';
import { playTone } from '../utils/sound';

export default function Learn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPillar = searchParams.get('pillar') || 'all';

  const [selectedPillar, setSelectedPillar] = useState(initialPillar);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    courseService
      .listPublicCourses()
      .then((data) => {
        if (!cancelled) setCourses(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load the course catalog.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync with URL query parameter changes
  useEffect(() => {
    const pillarParam = searchParams.get('pillar');
    if (pillarParam) {
      setSelectedPillar(pillarParam);
    }
  }, [searchParams]);

  const handlePillarChange = (pillarId) => {
    playTone(560, 'sine', 0.04, 0.03);
    setSelectedPillar(pillarId);
    if (pillarId === 'all') {
      searchParams.delete('pillar');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ pillar: pillarId });
    }
  };

  const handleCategoryChange = (catId) => {
    playTone(540, 'sine', 0.04, 0.03);
    setSelectedCategory(catId);
  };

  const filteredCourses = courses.filter((course) => {
    const matchesPillar =
      selectedPillar === 'all' || course.pillar === selectedPillar;
    const matchesCategory =
      selectedCategory === 'all' || course.category === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.skills?.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesPillar && matchesCategory && matchesQuery;
  });

  return (
    <div className="min-h-screen pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-300 text-xs font-semibold mb-4">
          <BookOpen className="w-3.5 h-3.5" />
          <span>NALANDA NEXUS CURRICULUM</span>
        </div>

        <h1 className="font-heading font-extrabold text-4xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
          Explore Learning Paths
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
          Master the three pillars of the digital age with hands-on labs, guided cohort mentorship, and capstone projects.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 rounded-3xl p-6 mb-12 shadow-xl shadow-slate-200/50 dark:shadow-2xl space-y-6">
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, skill, or keyword (e.g. Python, AI, React, Figma)..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        {/* Pillar Filter Tabs */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
            Filter by Digital Pillar
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePillarChange('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedPillar === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-900 dark:border-white shadow'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              All Pillars
            </button>
            {pillars.map((p) => {
              const isSelected = selectedPillar === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePillarChange(p.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? `${p.badgeBg} border-current shadow-lg scale-105`
                      : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="font-mono">{p.number}</span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Pills */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
            Filter by Category
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Course Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">Loading courses…</div>
      ) : error ? (
        <div className="py-20 text-center rounded-3xl bg-white dark:bg-[#0D1424]/60 border border-slate-200 dark:border-white/10 max-w-lg mx-auto shadow-sm">
          <p className="text-sm text-rose-500 font-medium">{error}</p>
        </div>
      ) : filteredCourses.length > 0 ? (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence>
            {filteredCourses.map((course, idx) => (
              <CourseCard key={course.id} course={course} index={idx} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* Empty State */
        <div className="py-20 text-center rounded-3xl bg-white dark:bg-[#0D1424]/60 border border-slate-200 dark:border-white/10 max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="font-heading font-bold text-xl text-slate-900 dark:text-white">
            No learning paths found
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">
            We couldn't find any courses matching your selected filters. Try clearing your search or picking another pillar.
          </p>
          <button
            onClick={() => {
              setSelectedPillar('all');
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="mt-6 px-6 py-2.5 rounded-full text-xs font-semibold text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}
