import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Greeting from '../components/overview/Greeting';
import NeedsAttention from '../components/overview/NeedsAttention';
import LivePlatformStatus from '../components/overview/LivePlatformStatus';
import StatsGrid from '../components/overview/StatsGrid';
import LearningActivityChart from '../components/overview/LearningActivityChart';
import QuickActions from '../components/overview/QuickActions';
import RecentActivity from '../components/overview/RecentActivity';
import PerformanceLeaderboard from '../components/overview/PerformanceLeaderboard';
import TeacherStatusChart from '../components/overview/TeacherStatusChart';

// Modals
import CreateTeacherModal from '../components/teachers/CreateTeacherModal';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

export default function AdminOverviewPage() {
  const { liveData, telemetryStatus } = useOutletContext() || {};
  const navigate = useNavigate();

  const [overviewData, setOverviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [createTeacherOpen, setCreateTeacherOpen] = useState(false);

  // Fetch complete overview snapshot from backend API
  const fetchOverview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminApi.getOverview();
      setOverviewData(data);
    } catch (err) {
      console.error('Failed to load overview data:', err);
      setError(err.message || 'Unable to connect to Nalanda Master Admin Backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // Real-time: the backend already emits 'analytics.updated' on every
  // getOverview() computation plus create/update events for the entities
  // this page's KPIs/leaderboard/activity feed are built from - previously
  // nothing on this page (the one every admin lands on first) subscribed to
  // any of them, so it only ever refreshed on a manual reload.
  useRealtimeEvents(
    [
      'analytics.updated',
      'student.created',
      'student.updated',
      'student.deleted',
      'teacher.created',
      'teacher.updated',
      'teacher.deleted',
      'course.created',
      'course.updated',
      'course.deleted',
      'payment.created',
      'payment.updated',
    ],
    fetchOverview
  );

  if (isLoading && !overviewData) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#22355E] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-[#22355E]">Loading Nalanda Nexus Master Telemetry...</p>
      </div>
    );
  }

  if (error && !overviewData) {
    return (
      <div className="p-8 max-w-xl mx-auto bg-white border border-[#DFDACB] rounded-2xl shadow-card text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#C1352B]/10 border border-[#C1352B]/30 flex items-center justify-center text-[#C1352B] mx-auto">
          ⚠️
        </div>
        <h2 className="text-base font-bold text-[#22355E]">Backend Service Disconnected</h2>
        <p className="text-xs text-[#2B2B28] leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={fetchOverview}
          className="px-4 py-2 rounded-xl bg-[#22355E] text-white text-xs font-semibold hover:bg-[#1A2A4A] transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Personalized Greeting (Fraunces) */}
      <Greeting />

      {/* 2. Needs Your Attention (Actionable Triage Queue) */}
      <NeedsAttention items={overviewData?.needsAttention} />

      {/* 3. Live Platform Status (Real-Time Telemetry) */}
      <LivePlatformStatus
        telemetryData={liveData || overviewData?.liveData}
        telemetryStatus={telemetryStatus}
      />

      {/* 4. Core Statistics (4 Primary KPI Cards) */}
      <StatsGrid kpiData={overviewData?.kpi} />

      {/* 5. Learning Activity Chart (Recharts AreaChart + Range Switcher) */}
      <LearningActivityChart dataByRange={overviewData?.learningActivityData} />

      {/* 6. Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Quick Actions (5 cols) */}
        <div className="lg:col-span-5">
          <QuickActions
            onCreateTeacher={() => setCreateTeacherOpen(true)}
            onCreateCourse={() => navigate('/courses')}
            onAddStudent={() => navigate('/students')}
            onCreateAnnouncement={() => navigate('/announcements')}
            onGenerateReport={() => navigate('/reports')}
          />
        </div>

        {/* Recent Activity (7 cols) */}
        <div className="lg:col-span-7">
          <RecentActivity activities={overviewData?.recentActivity} />
        </div>
      </div>

      {/* 7 & 8. Performance Leaderboard + Teachers by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 7. Performance / Leaderboard (7 cols) */}
        <div className="lg:col-span-7">
          <PerformanceLeaderboard leaderboardData={overviewData?.leaderboard} />
        </div>

        {/* 8. Teachers by Status Donut Chart (5 cols) */}
        <div className="lg:col-span-5">
          <TeacherStatusChart statusCounts={overviewData?.teacherStatus} />
        </div>
      </div>

      {/* Modals */}
      <CreateTeacherModal
        isOpen={createTeacherOpen}
        onClose={() => setCreateTeacherOpen(false)}
        onTeacherCreated={() => {
          fetchOverview();
        }}
      />
    </div>
  );
}
