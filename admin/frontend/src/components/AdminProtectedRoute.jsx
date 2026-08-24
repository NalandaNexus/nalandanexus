import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { TEACHER_PORTAL_URL } from '../services/adminApi';

export default function AdminProtectedRoute({ children, requiredRole = 'SUPER_ADMIN' }) {
  const { isAuthenticated, isLoading, user } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center text-[#22355E]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#22355E] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-[#22355E]">Verifying Administrator Clearance...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role verification: Super Admin has universal access
  const role = user?.role ? user.role.toUpperCase() : '';
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== requiredRole.toUpperCase()) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center p-6 text-center">
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-8 max-w-md shadow-card space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#C1352B]/10 text-[#C1352B] flex items-center justify-center mx-auto text-xl font-bold">
            🚫
          </div>
          <h2 className="text-lg font-bold text-[#22355E]">Access Denied — Root Clearance Required</h2>
          <p className="text-xs text-[#2B2B28] leading-relaxed">
            Your account ({user?.email}) with role <strong className="font-mono text-[#C1352B]">{user?.role}</strong> does not possess administrative permissions for this zone.
          </p>
          <button
            type="button"
            onClick={() => window.location.href = TEACHER_PORTAL_URL}
            className="px-4 py-2 rounded-xl bg-[#22355E] text-white text-xs font-semibold"
          >
            Return to Faculty Portal
          </button>
        </div>
      </div>
    );
  }

  return children;
}
