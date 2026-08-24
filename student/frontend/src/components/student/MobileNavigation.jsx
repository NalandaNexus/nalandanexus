import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  CheckSquare,
  TrendingUp,
  Menu,
  X,
  LogOut,
  Bell,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { studentNavItems } from './StudentSidebar';
import DiyaStreak from './DiyaStreak';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';

export default function MobileNavigation() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { student, unreadNotificationsCount } = useStudent();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const streakCount = student?.streak?.current ?? 0;
  const longestStreak = student?.streak?.longest ?? 0;

  return (
    <>
      {/* 1. Mobile Bottom Navigation Bar (Visible <1024px) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F4] border-t border-[#DFDACB] px-2 py-1.5 shadow-lg select-none"
        aria-label="Mobile Bottom Navigation"
      >
        <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
          {/* Item 1: Home / Dashboard */}
          <NavLink
            to="/student/dashboard"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 rounded-xl min-h-[44px] transition-colors ${
                isActive ? 'text-[#22355E] font-bold' : 'text-[#2B2B28]/70 hover:text-[#22355E]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard
                  className={`w-4 h-4 ${isActive ? 'text-[#AB5236]' : 'text-[#22355E]'}`}
                />
                <span className="text-[10px] tracking-tight mt-0.5">Home</span>
              </>
            )}
          </NavLink>

          {/* Item 2: Parambh */}
          <NavLink
            to="/student/parambh"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 rounded-xl min-h-[44px] transition-colors ${
                isActive ? 'text-[#22355E] font-bold' : 'text-[#2B2B28]/70 hover:text-[#22355E]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <GraduationCap
                  className={`w-4 h-4 ${isActive ? 'text-[#AB5236]' : 'text-[#22355E]'}`}
                />
                <span className="text-[10px] tracking-tight mt-0.5">Parambh</span>
              </>
            )}
          </NavLink>

          {/* Item 3: Tasks */}
          <NavLink
            to="/student/tasks"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 rounded-xl min-h-[44px] transition-colors ${
                isActive ? 'text-[#22355E] font-bold' : 'text-[#2B2B28]/70 hover:text-[#22355E]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <CheckSquare
                  className={`w-4 h-4 ${isActive ? 'text-[#AB5236]' : 'text-[#22355E]'}`}
                />
                <span className="text-[10px] tracking-tight mt-0.5">Tasks</span>
              </>
            )}
          </NavLink>

          {/* Item 4: Performance */}
          <NavLink
            to="/student/performance"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 rounded-xl min-h-[44px] transition-colors ${
                isActive ? 'text-[#22355E] font-bold' : 'text-[#2B2B28]/70 hover:text-[#22355E]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <TrendingUp
                  className={`w-4 h-4 ${isActive ? 'text-[#AB5236]' : 'text-[#22355E]'}`}
                />
                <span className="text-[10px] tracking-tight mt-0.5">Stats</span>
              </>
            )}
          </NavLink>

          {/* Item 5: More Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl min-h-[44px] text-[#2B2B28]/70 hover:text-[#22355E] transition-colors student-focus"
            aria-label="Open more navigation links"
          >
            <Menu className="w-4 h-4 text-[#22355E]" />
            <span className="text-[10px] tracking-tight mt-0.5">More</span>
          </button>
        </div>
      </nav>

      {/* 2. Slideout Mobile Drawer */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Content Panel */}
          <div className="relative w-4/5 max-w-xs bg-[#FAF9F4] h-full shadow-2xl flex flex-col justify-between p-4 z-10 border-r border-[#DFDACB] animate-in slide-in-from-left duration-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#DFDACB]">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/favicon.svg"
                    alt="Nalanda Nexus Seal"
                    className="w-8 h-8 rounded-full shadow-xs ring-1 ring-[#DFDACB]"
                  />
                  <span className="font-heading font-extrabold text-sm text-[#22355E]">
                    Nalanda Nexus
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-[#2B2B28]/70 hover:text-[#2B2B28] rounded-full hover:bg-black/5"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Links */}
              <div className="py-4 space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
                {studentNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold min-h-[44px] transition-colors ${
                          isActive
                            ? 'bg-[#22355E] text-white shadow-xs'
                            : 'text-[#2B2B28] hover:bg-[#EDEAE0]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4 h-4 ${
                              isActive ? 'text-[#C99A2E]' : 'text-[#22355E]'
                            }`}
                          />
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Bottom Logout */}
            <div className="pt-3 border-t border-[#DFDACB]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#AB5236]/10 hover:bg-[#AB5236]/20 text-[#AB5236] font-heading font-bold text-xs rounded-xl min-h-[44px] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
