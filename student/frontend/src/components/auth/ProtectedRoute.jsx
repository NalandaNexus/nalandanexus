import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // The backend sleeps when idle and takes roughly 23 seconds to wake. Without
  // a word of explanation that reads as a hung page, so after a few seconds we
  // say what is actually happening instead of spinning silently.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setSlow(false);
      return undefined;
    }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 border-3 border-[#22355E]/20 border-t-[#22355E] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#22355E] tracking-wider uppercase">Loading Nalanda Nexus...</p>
          {slow && (
            <p className="text-xs text-[#2B2B28]/70 max-w-xs">
              The server is waking up after a period of inactivity. This first load can take up to a
              minute &mdash; it will be quick from here on.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
