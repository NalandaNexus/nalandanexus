import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';
import AtRiskAlertStrip from '../components/dashboard/AtRiskAlertStrip';
import RecommendedActions from '../components/dashboard/RecommendedActions';
import RecentAnnouncements from '../components/dashboard/RecentAnnouncements';
import PendingTasks from '../components/dashboard/PendingTasks';
import StatsGrid from '../components/dashboard/StatsGrid';
import AvgScoreModal from '../components/dashboard/AvgScoreModal';
import PerformanceOverview from '../components/dashboard/PerformanceOverview';
import ConceptBreakdown from '../components/dashboard/ConceptBreakdown';
import LeaderboardDiagnostic from '../components/dashboard/LeaderboardDiagnostic';
import ClassHealthTable from '../components/dashboard/ClassHealthTable';
import WorkloadSummary from '../components/dashboard/WorkloadSummary';
import TodaysSchedule from '../components/dashboard/TodaysSchedule';
import LiveClassPanel from '../components/dashboard/LiveClassPanel';
import StudentDrillDownDrawer from '../components/students/StudentDrillDownDrawer';
import { StatSkeleton, ChartSkeleton } from '../components/common/SkeletonLoaders';

export default function DashboardPage() {
  const navigate = useNavigate();

  const {
    isLoading,
    error,
    refetch,
    coreStats,
    avgScoreBreakdown,
    atRiskStudents,
    recommendedActions,
    pendingTasks,
    workloadSummary,
    classHealth,
    todaysSchedule,
    liveClassState,
    conceptPerformance,
    classes,
    selectedStudent,
    isStudentDrawerOpen,
    openStudentDrillDown,
    closeStudentDrillDown,
    isAvgScoreModalOpen,
    setIsAvgScoreModalOpen,
    timeFilter,
    setTimeFilter,
  } = useTeacherDashboard();

  const handleOpenClass = (classId) => navigate('/classes');
  const handleReteachConcept = (conceptId) => navigate('/grading');
  const handleViewStrugglingStudents = (conceptId) => navigate('/students');
  const handleLaunchLiveClass = (item) => navigate('/calendar');

  if (isLoading) {
    return (
      <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto pb-12">
        <div className="p-5 rounded-2xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={refetch}
            className="px-3 py-1.5 rounded-xl bg-[#C1352B] text-white text-xs font-bold hover:bg-[#a92c23] transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* 1. ATTENTION TIER — Immediate At-Risk Alert Strip with Pulsing Dots        */}
      {/* ========================================================================= */}
      <AtRiskAlertStrip
        atRiskData={atRiskStudents}
        onSelectStudent={openStudentDrillDown}
      />

      {/* ========================================================================= */}
      {/* 2. CORE PERFORMANCE METRICS & INTERACTIVE AVG SCORE BREAKDOWN              */}
      {/* ========================================================================= */}
      <StatsGrid
        stats={coreStats}
        onOpenAvgScoreModal={() => setIsAvgScoreModalOpen(true)}
      />

      {/* ========================================================================= */}
      {/* 3. ACTION TIER — Recommended Actions, Pending Tasks & Announcements        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <RecentAnnouncements />
        </div>
        <div className="lg:col-span-5">
          <RecommendedActions
            actions={recommendedActions}
            onOpenStudent={openStudentDrillDown}
            onOpenClass={handleOpenClass}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PERFORMANCE & DIAGNOSTIC ANALYTICS                                      */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {/* Class Longitudinal Trajectory Chart */}
        <PerformanceOverview
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          overlayCandidates={atRiskStudents.all}
        />

        {/* Concept-Wise Knowledge Gap Diagnostics */}
        <ConceptBreakdown
          concepts={conceptPerformance}
          onReteachConcept={handleReteachConcept}
          onViewStrugglingStudents={handleViewStrugglingStudents}
        />

        {/* Class-Scoped Diagnostic Leaderboard */}
        <LeaderboardDiagnostic
          classes={classes}
          onSelectStudent={openStudentDrillDown}
        />

        {/* 8-Class Health Overview Matrix */}
        <ClassHealthTable
          classHealth={classHealth}
          onSelectClass={handleOpenClass}
        />
      </div>

      {/* ========================================================================= */}
      {/* 5. WORKLOAD & TASKS TIER                                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <WorkloadSummary workload={workloadSummary} classCount={classes.length} />
        </div>
        <div className="lg:col-span-7">
          <PendingTasks tasks={pendingTasks} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. SCHEDULE & LIVE TEACHING TIER                                           */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {/* Real-Time Live Class Studio Panel (Active Class) */}
        <LiveClassPanel
          liveState={liveClassState}
          todaysSchedule={todaysSchedule}
        />

        {/* Today's Teaching Schedule with Attendance Risk Indicators */}
        <TodaysSchedule
          schedule={todaysSchedule}
          onLaunchLiveClass={handleLaunchLiveClass}
        />
      </div>

      {/* Average Score Deep-Dive Modal */}
      <AvgScoreModal
        isOpen={isAvgScoreModalOpen}
        onClose={() => setIsAvgScoreModalOpen(false)}
        breakdownData={avgScoreBreakdown}
        totalStudents={coreStats?.totalStudents?.value ?? 0}
        totalClasses={coreStats?.totalClasses?.value ?? 0}
      />

      {/* Reusable Universal Student Drill-Down Drawer */}
      <StudentDrillDownDrawer
        isOpen={isStudentDrawerOpen}
        onClose={closeStudentDrillDown}
        student={selectedStudent}
      />
    </div>
  );
}
