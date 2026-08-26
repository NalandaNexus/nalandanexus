import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Star, Quote } from 'lucide-react';
import { playTone } from '../../utils/sound';
import PrarambhModal from '../hero/PrarambhModal';
import { statsService } from '../../services/statsService';
import { resolveAssetUrl } from '../../services/apiClient';

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k+`;
  return String(n);
}

export default function CommunityImpactSection() {
  const [isPrarambhOpen, setIsPrarambhOpen] = useState(false);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [stats, setStats] = useState(null);
  const [stories, setStories] = useState([]);

  useEffect(() => {
    statsService.getPublicStats().then(setStats).catch(() => setStats(null));
    statsService.getPublicHighlights(5).then(setStories).catch(() => setStories([]));
  }, []);

  return (
    <section className="relative py-12 sm:py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">

        {/* LEFT COLUMN: From Our Community (real, aggregated stats) */}
        <div className="lg:col-span-4 rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 p-6 sm:p-7 flex flex-col justify-between shadow-xl shadow-slate-200/50 dark:shadow-2xl">
          <div>
            <h3 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
              From Our <span className="text-purple-600 dark:text-purple-400">Community</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6 font-medium">
              Learners. Mentors. Creators.
            </p>
          </div>

          {/* 2 Real Metric counters */}
          <div className="pt-5 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                {stats ? formatCount(stats.activeLearners) : '—'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Active Learners
              </div>
            </div>

            <div>
              <div className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                {stats ? formatCount(stats.communityPosts) : '—'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Community Posts
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Video / Story Card with 10_community_learning.png */}
        <div
          onClick={() => {
            playTone(580, 'triangle', 0.1, 0.05);
            setIsPrarambhOpen(true);
          }}
          className="lg:col-span-4 group relative rounded-3xl bg-[#080E1C] border border-slate-300 dark:border-white/15 overflow-hidden shadow-xl dark:shadow-2xl cursor-pointer min-h-[280px] flex flex-col justify-end p-6 hover:border-cyan-500/80 transition-all duration-300"
        >
          {/* Rendered Story Image */}
          <img
            src="/10_community_learning.png"
            alt="Together we Learn, Build and Grow"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-slate-950/40 to-transparent z-10" />

          {/* Central Circular Glowing Play Button */}
          <div className="relative z-20 mx-auto my-auto w-14 h-14 rounded-full bg-cyan-500/40 border-2 border-cyan-300 flex items-center justify-center text-white shadow-[0_0_30px_rgba(6,182,212,0.7)] group-hover:scale-110 group-hover:bg-cyan-400 group-hover:text-slate-950 transition-all duration-300">
            <Play className="w-6 h-6 fill-current ml-1" />
          </div>

          {/* Bottom Title Overlay */}
          <div className="relative z-20 text-center">
            <h4 className="font-heading font-extrabold text-sm sm:text-base text-white tracking-wide drop-shadow-md">
              Together we Learn, Build and Grow
            </h4>
          </div>
        </div>

        {/* RIGHT COLUMN: Real Impact - genuine community posts, never fabricated testimonials */}
        <div className="lg:col-span-4 rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 p-6 sm:p-7 flex flex-col justify-between shadow-xl shadow-slate-200/50 dark:shadow-2xl">
          <div>
            <h3 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
              Real Impact
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5 font-medium">
              Real posts from the Nalanda Nexus community
            </p>

            {/* Testimonial Box */}
            <div className="relative p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 min-h-[140px] flex flex-col justify-between shadow-sm">
              {stories.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 m-auto text-center">
                  Community stories will appear here as learners share their progress.
                </p>
              ) : (
                <>
                  <Quote className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2 opacity-80" />
                  <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium line-clamp-4">
                    "{stories[activeStoryIdx].quote}"
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-3">
                    {stories[activeStoryIdx].avatar ? (
                      <img
                        src={resolveAssetUrl(stories[activeStoryIdx].avatar)}
                        alt={stories[activeStoryIdx].author}
                        className="w-8 h-8 rounded-full object-cover border border-purple-400/50"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-400/50 flex items-center justify-center text-[10px] font-bold text-purple-600 dark:text-purple-300">
                        {stories[activeStoryIdx].author[0]}
                      </div>
                    )}
                    <div>
                      <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                        {stories[activeStoryIdx].author}
                      </h5>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5 font-medium">
                        Nalanda Nexus Learner
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Carousel Pagination Dots */}
          {stories.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {stories.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    playTone(520 + idx * 40, 'sine', 0.03, 0.02);
                    setActiveStoryIdx(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === activeStoryIdx
                      ? 'w-6 bg-cyan-600 dark:bg-cyan-400 shadow-sm shadow-cyan-500/50'
                      : 'bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/40'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Story Video Modal */}
      <PrarambhModal
        isOpen={isPrarambhOpen}
        onClose={() => setIsPrarambhOpen(false)}
      />
    </section>
  );
}
