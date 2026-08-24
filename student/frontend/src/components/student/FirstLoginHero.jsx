import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, BookOpen, Compass, CheckCircle2, ShieldCheck } from 'lucide-react';
import DiyaStreak from './DiyaStreak';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';

export default function FirstLoginHero({ onStartParambh }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { student, completeOnboarding } = useStudent();

  const studentName = student?.name || user?.name || 'Student';
  const firstName = studentName.split(' ')[0];

  const handleStart = () => {
    completeOnboarding();
    if (onStartParambh) {
      onStartParambh();
    } else {
      navigate('/student/parambh');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Onboarding Presentation Card in Manuscript Parchment */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="bg-[#FAF9F4] border-2 border-[#DFDACB] rounded-3xl p-6 sm:p-10 lg:p-12 shadow-lg relative overflow-hidden"
      >
        {/* Subtle Decorative Header Watermark */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#C99A2E]/8 pointer-events-none blur-xl" />

        {/* Brand & Seal Row */}
        <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-[#DFDACB]/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden shadow-md ring-2 ring-[#DFDACB] bg-white">
              <img
                src="/favicon.svg"
                alt="Nalanda Nexus Seal"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="font-heading font-extrabold text-sm sm:text-base text-[#22355E] tracking-tight block">
                Nalanda <span className="text-[#AB5236]">Nexus</span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-[#C99A2E] tracking-wider uppercase">
                Future-Ready Learning Ecosystem
              </span>
            </div>
          </div>

          <DiyaStreak streakDays={1} longest={1} />
        </div>

        {/* Main Emotional Greeting & Headline */}
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#22355E] tracking-tight leading-tight mb-4">
            Welcome to your future-ready journey, {firstName}.
          </h1>
          <p className="font-body text-base sm:text-lg text-[#2B2B28]/85 leading-relaxed mb-8">
            Start with the foundations that help you communicate, think, create and learn with confidence.
          </p>
        </div>

        {/* Course Feature Showcase Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-[#F2EFE6] border border-[#DFDACB] flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white border border-[#DFDACB] text-[#22355E]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-xs text-[#22355E]">Core Foundations</h3>
              <p className="text-[11px] text-[#2B2B28]/70 mt-0.5">
                Overcome self-doubt, develop growth mindset and vocal presence.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F2EFE6] border border-[#DFDACB] flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white border border-[#DFDACB] text-[#AB5236]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-xs text-[#22355E]">Interactive Lessons</h3>
              <p className="text-[11px] text-[#2B2B28]/70 mt-0.5">
                24+ live class recordings, reflection tasks, and quizzes.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F2EFE6] border border-[#DFDACB] flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white border border-[#DFDACB] text-[#5C7A5E]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-xs text-[#22355E]">Daily Diya Streak</h3>
              <p className="text-[11px] text-[#2B2B28]/70 mt-0.5">
                Maintain consistency, earn points, and climb the leaderboard.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Call to Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#DFDACB]/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5C7A5E]">
            <ShieldCheck className="w-4 h-4 text-[#5C7A5E]" />
            <span>Enrolled in Parambh: 3-Month Foundation</span>
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-sm rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group student-focus"
          >
            <span>Start Parambh</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
