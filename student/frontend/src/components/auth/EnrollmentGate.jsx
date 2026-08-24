import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useStudent } from '../../context/StudentContext';

/**
 * Route-level purchase gate: a logged-in student may not access the
 * dashboard, Parambh course, tasks, quizzes, or leaderboard until they
 * have an active (paid) course enrollment. This mirrors the backend's own
 * `requireEnrollment` middleware - the frontend gate is a UX convenience,
 * the backend is the actual security boundary (master doc section 74).
 */
export default function EnrollmentGate() {
  const { isEnrolled, isLoadingDashboard, profileLoaded } = useStudent();

  if (isEnrolled === null && (isLoadingDashboard || !profileLoaded)) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#22355E]/20 border-t-[#22355E] rounded-full animate-spin" />
      </div>
    );
  }

  if (isEnrolled === false) {
    return <Navigate to="/student/purchase" replace />;
  }

  return <Outlet />;
}
