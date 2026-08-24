import React from 'react';
import { Outlet } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import MobileNavigation from './MobileNavigation';
import { useStudent } from '../../context/StudentContext';

export default function StudentLayout({ children }) {
  const { activeNotification } = useStudent();

  return (
    <div className="min-h-screen bg-[#EDEAE0] text-[#2B2B28] font-body flex flex-col lg:flex-row antialiased selection:bg-[#AB5236]/20 selection:text-[#22355E]">
      {/* Desktop Sidebar (Fixed left on lg screens) */}
      <StudentSidebar />

      {/* Main Dynamic Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-10">
        {/* Dynamic Toast for Task/Quiz Submissions */}
        {activeNotification && (
          <div className="fixed bottom-20 lg:bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="bg-[#22355E] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#C99A2E] animate-ping" />
              <div>
                <p className="text-xs font-bold font-heading">{activeNotification.title}</p>
                <p className="text-[11px] text-white/80">{activeNotification.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nested Content Route */}
        <main className="flex-1">
          {children || <Outlet />}
        </main>
      </div>

      {/* Mobile Navigation (Bottom Bar & Drawer) */}
      <MobileNavigation />
    </div>
  );
}
