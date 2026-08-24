import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTeacherAuth } from '../context/TeacherAuthContext';

/**
 * `skipPasswordCheck` is used only by the /reset-password route itself — it
 * must stay reachable for a mustChangePassword=true session (which every
 * OTHER route redirects away from), while still requiring a real login.
 * The backend enforces the same gate independently (middleware/auth.js on
 * teacher/backend), so this is a UX redirect, not the actual security
 * boundary — a bypass here couldn't reach protected data anyway.
 */
export default function TeacherProtectedRoute({ children, skipPasswordCheck = false }) {
  const { isAuthenticated, isLoading, mustChangePassword } = useTeacherAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center text-[#22355E]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#22355E] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-[#2B2B28]">Verifying Faculty Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (mustChangePassword && !skipPasswordCheck) {
    return <Navigate to="/reset-password" replace />;
  }

  return children;
}
