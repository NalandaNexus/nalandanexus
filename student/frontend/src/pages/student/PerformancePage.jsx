import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Award, CheckCircle2, Target, BrainCircuit, Compass } from 'lucide-react';
import PerformanceChart from '../../components/student/PerformanceChart';
import { useStudent } from '../../context/StudentContext';

export default function PerformancePage() {
  const { student } = useStudent();

  const avgQuiz = student?.performance?.averageQuiz ?? 0;
  const avgTask = student?.performance?.averageTask ?? 0;
  const overall = student?.performance?.overallScore ?? 0;
  const quizzesCompleted = student?.quizzesCompleted ?? 0;
  const tasksCompleted = student?.tasksCompleted ?? 0;

  // Per-pillar mastery isn't a tracked backend concept - the one honest
  // signal available is the student's real overall score on the pillar
  // their enrolled course actually belongs to; the other two pillars are
  // genuinely "not started" rather than a fabricated percentage.
  const enrolledPillar = student?.course?.pillar || null;
  const pillars = [
    { key: 'communicate', label: '1. Communicate (Confidence & Vocal Clarity)', color: '#22355E' },
    { key: 'compute', label: '2. Compute (Critical Thinking & Logic)', color: '#AB5236' },
    { key: 'create', label: '3. Create (Vision & Execution)', color: '#C99A2E' },
  ].map((p) => ({
    ...p,
    mastery: p.key === enrolledPillar ? overall : 0,
    started: p.key === enrolledPillar,
  }));

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[#22355E]">
            Detailed Performance & Competency Breakdown
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Holistic analytics tracking your quiz retention, task completion velocity, and pillar growth.
          </p>
        </div>

        {/* Top 3 Summary Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs">
            <span className="text-xs font-semibold text-[#2B2B28]/70">Overall Competency</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-data font-extrabold text-3xl text-[#22355E]">{overall}%</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs">
            <span className="text-xs font-semibold text-[#2B2B28]/70">Quiz Accuracy</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-data font-extrabold text-3xl text-[#22355E]">{avgQuiz}%</span>
              <span className="text-xs text-[#2B2B28]/60 font-data">{quizzesCompleted} completed</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs">
            <span className="text-xs font-semibold text-[#2B2B28]/70">Task Execution</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-data font-extrabold text-3xl text-[#AB5236]">{avgTask}%</span>
              <span className="text-xs text-[#2B2B28]/60 font-data">{tasksCompleted} completed</span>
            </div>
          </div>
        </div>

        {/* Line Chart Performance Module */}
        <PerformanceChart />

        {/* 3 Pillars Competency Strengths */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs space-y-4">
          <h2 className="font-heading font-bold text-sm text-[#22355E]">
            Progress Across The 3 Pillars of Nalanda Nexus
          </h2>

          <div className="space-y-3">
            {pillars.map((p) => (
              <div key={p.key} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#22355E]">{p.label}</span>
                  <span className="font-data" style={{ color: p.started ? p.color : '#2B2B2899' }}>
                    {p.started ? `${p.mastery}% Mastery` : 'Not started'}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#EDEAE0] rounded-full overflow-hidden border border-[#DFDACB]">
                  <div className="h-full rounded-full" style={{ width: `${p.mastery}%`, backgroundColor: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
