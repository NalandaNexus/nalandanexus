import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStudent } from '../../context/StudentContext';

// Components
import ReturningHeader from '../../components/student/ReturningHeader';
import FirstLoginHero from '../../components/student/FirstLoginHero';
import ContinueCard from '../../components/student/ContinueCard';
import DueTasks from '../../components/student/DueTasks';
import PerformanceChart from '../../components/student/PerformanceChart';
import LeaderboardSection from '../../components/student/LeaderboardSection';
import ParambhJourney from '../../components/student/ParambhJourney';
import MyEnrollmentCard from '../../components/student/MyEnrollmentCard';
import LearnerProfileCard from '../../components/student/LearnerProfileCard';
import JourneyCard from '../../components/student/JourneyCard';
import { useProgression } from '../../hooks/useProgression';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const { student, hasCompletedOnboarding, isLoadingDashboard, dashboardError, refreshData } = useStudent();
  // Refreshes itself when the server reports a progression change, so the card
  // reflects what the backend computed rather than a locally-guessed total.
  const { progression, isLoading: isLoadingProgression } = useProgression();

  if (isLoadingDashboard && !student) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#22355E]/20 border-t-[#22355E] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#22355E] tracking-wider uppercase">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (dashboardError && !student) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="font-heading font-bold text-[#22355E]">Unable to load your dashboard.</p>
          <p className="text-xs text-[#2B2B28]/70">{dashboardError}</p>
          <button
            type="button"
            onClick={refreshData}
            className="px-5 py-2.5 bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isFirstLogin = !hasCompletedOnboarding();

  // If first ever login for this specific student -> Show State A
  if (isFirstLogin) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4">
        <FirstLoginHero onStartParambh={() => navigate('/student/parambh')} />
      </div>
    );
  }

  // State B — Returning Student Dashboard (Default 95% of sessions)
  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] flex flex-col">
      {/* 1. Compact Status Header */}
      <ReturningHeader />

      {/* 2. Main Dashboard Content with Structured Information Hierarchy */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      >
        {/* Section 1: where the learner stands - stage, level, rank, the three
            skill scores, and what the next stage still requires. Placed first
            because it answers "where am I?" before the dashboard asks them to
            do anything. */}
        <LearnerProfileCard data={progression} loading={isLoadingProgression} />

        {/* The three-stage journey. Placed under the profile because "where am
            I in the whole thing" follows naturally from "how am I doing". */}
        <JourneyCard
          journey={progression?.journey || []}
          onContinue={() => navigate('/student/parambh')}
        />

        {/* Section 2: Continue where you left off */}
        <ContinueCard />

        {/* Section 2: Due today / this week */}
        <DueTasks />

        {/* Grid for Section 3 (Performance) & Section 4 (Leaderboard/Motivation) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Section 3: Your Performance (7 cols on desktop) */}
          <div className="lg:col-span-7">
            <PerformanceChart />
          </div>

          {/* Section 4: Leaderboard / motivation (5 cols on desktop) */}
          <div className="lg:col-span-5">
            <LeaderboardSection />
          </div>
        </div>

        {/* Section 5: Parambh Journey */}
        <ParambhJourney />

        {/* Section 6: the student's own enrollment identity, batch and teacher —
            all of which existed in the data and appeared on no screen. */}
        <MyEnrollmentCard />
      </motion.div>
    </div>
  );
}
