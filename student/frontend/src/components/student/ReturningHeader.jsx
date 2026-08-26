import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Calendar as CalendarIcon, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import DiyaStreak from './DiyaStreak';
import NotificationPopover from './NotificationPopover';
import CalendarPopover from './CalendarPopover';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';
import { resolveAssetUrl } from '../../services/apiClient';

export default function ReturningHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { student, unreadNotificationsCount } = useStudent();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const accountMenuRef = useRef(null);

  // Close account menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    }
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAccountMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const studentName = student?.name || user?.name || 'Student';
  const streakCount = student?.streak?.current ?? 0;
  const longestStreak = student?.streak?.longest ?? 0;

  // Student Initials
  const initials = studentName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'ST';

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full bg-[#FAF9F4] border-b border-[#DFDACB] px-4 py-3 sm:px-6 lg:px-8 shadow-xs select-none sticky top-0 z-30"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* LEFT: Student Greeting with Avatar */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar / Monogram */}
          <div className="relative w-10 h-10 rounded-full bg-[#22355E] text-[#EDEAE0] flex items-center justify-center font-heading font-bold text-sm shadow-sm ring-2 ring-[#DFDACB] shrink-0">
            {student?.avatar ? (
              <img
                src={resolveAssetUrl(student.avatar)}
                alt={studentName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#5C7A5E] ring-1.5 ring-white" />
          </div>

          {/* Welcome Text */}
          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-lg lg:text-xl font-bold text-[#22355E] truncate leading-tight tracking-tight">
              Welcome back, {studentName.split(' ')[0]}
            </h1>
            <p className="text-[11px] sm:text-xs font-body font-medium text-[#2B2B28]/70 truncate -mt-0.5">
              Parambh Future-Ready Learner
            </p>
          </div>
        </div>

        {/* RIGHT: Diya Streak, Notifications, Calendar & Account */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* 1. Diya Streak Component */}
          <DiyaStreak streakDays={streakCount} longest={longestStreak} />

          {/* 2. Notification Button & Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen((prev) => !prev);
                setIsCalOpen(false);
                setIsAccountMenuOpen(false);
              }}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#22355E] flex items-center justify-center transition-colors shadow-2xs student-focus"
              title="Notifications"
              aria-label="Open notifications"
              aria-expanded={isNotifOpen}
            >
              <Bell className="w-4 h-4 text-[#22355E]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#AB5236] ring-1 ring-white" />
              )}
            </button>

            <NotificationPopover
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
            />
          </div>

          {/* 3. Calendar Button & Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsCalOpen((prev) => !prev);
                setIsNotifOpen(false);
                setIsAccountMenuOpen(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#22355E] flex items-center justify-center transition-colors shadow-2xs student-focus"
              title="Learning Calendar"
              aria-label="Open learning calendar"
              aria-expanded={isCalOpen}
            >
              <CalendarIcon className="w-4 h-4 text-[#22355E]" />
            </button>

            <CalendarPopover
              isOpen={isCalOpen}
              onClose={() => setIsCalOpen(false)}
            />
          </div>

          {/* 4. Student Account Menu */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsAccountMenuOpen((prev) => !prev);
                setIsNotifOpen(false);
                setIsCalOpen(false);
              }}
              className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-full bg-white hover:bg-[#EDEAE0] border border-[#DFDACB] transition-colors shadow-2xs student-focus text-xs font-semibold text-[#22355E]"
              aria-label="Open user menu"
              aria-expanded={isAccountMenuOpen}
            >
              <User className="w-4 h-4 text-[#22355E]" />
              <ChevronDown className="w-3.5 h-3.5 text-[#2B2B28]/60 hidden sm:block" />
            </button>

            {isAccountMenuOpen && (
              <div
                className="absolute right-0 top-12 w-52 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                role="menu"
              >
                <div className="px-3.5 py-2 border-b border-[#DFDACB]/70">
                  <p className="text-xs font-bold text-[#22355E] truncate">{studentName}</p>
                  <p className="text-[10px] text-[#2B2B28]/60 truncate font-mono">
                    {student?.email || user?.email || 'student@nalanda-nexus.local'}
                  </p>
                </div>

                <Link
                  to="/student/settings"
                  onClick={() => setIsAccountMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
                  role="menuitem"
                >
                  <User className="w-3.5 h-3.5 text-[#22355E]" />
                  <span>Student Profile</span>
                </Link>

                <Link
                  to="/student/settings"
                  onClick={() => setIsAccountMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
                  role="menuitem"
                >
                  <Settings className="w-3.5 h-3.5 text-[#22355E]" />
                  <span>Preferences & Alerts</span>
                </Link>

                <div className="my-1 border-t border-[#DFDACB]/70" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#AB5236] hover:bg-[#AB5236]/10 transition-colors text-left"
                  role="menuitem"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#AB5236]" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
