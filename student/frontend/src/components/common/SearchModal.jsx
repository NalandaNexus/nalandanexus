import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { pillars } from '../../data/pillars';
import { courseService } from '../../services/courseService';

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [courses, setCourses] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
      // Fetch once per session the first time the modal opens, not on every open.
      if (courses.length === 0) {
        courseService.listPublicCourses().then(setCourses).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Combined search dataset
  const searchPool = [
    ...courses.map((c) => ({
      id: `course-${c.id}`,
      title: c.title,
      subtitle: c.tagline || c.description,
      category: c.isUpcoming ? 'Upcoming Course' : 'Active Course',
      type: 'course',
      path: `/courses/${c.slug}`,
      icon: BookOpen,
      badgeColor: c.isUpcoming
        ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30'
        : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
    })),
    ...pillars.map((p) => ({
      id: `pillar-${p.id}`,
      title: `Pillar: ${p.name}`,
      subtitle: p.tagline,
      category: 'Digital Pillar',
      type: 'pillar',
      path: p.link,
      icon: Sparkles,
      badgeColor: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30',
    })),
  ];

  const filteredResults = query.trim()
    ? searchPool.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : searchPool.slice(0, 5);

  const handleSelect = (item) => {
    onClose();
    navigate(item.path);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
    } else if (e.key === 'Enter' && filteredResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:px-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-white z-10"
        >
          {/* Input Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-white/10 gap-3">
            <Search className="w-5 h-5 text-amber-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search PRARAMBH, digital pillars, or upcoming tracks..."
              className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm sm:text-base outline-none focus:ring-0"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-white/5">
            {filteredResults.length > 0 ? (
              filteredResults.map((item, idx) => {
                const ItemIcon = item.icon;
                const isSelected = idx === selectedIndex;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-white/10 text-slate-950 dark:text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                        <ItemIcon className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {item.title}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${item.badgeColor}`}
                          >
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                <p className="text-sm font-medium">No learning paths found for "{query}"</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Try searching for 'PRARAMBH', 'Foundation', 'Communicate', or 'Compute'
                </p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span>Navigate <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded">↑</kbd> <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded">↓</kbd></span>
              <span>Select <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded">↵</kbd></span>
            </div>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">Nalanda Nexus Ecosystem</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
