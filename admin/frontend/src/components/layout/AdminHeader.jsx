import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  User,
  Settings,
  LogOut,
  ExternalLink,
  Shield,
  Radio,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { TEACHER_PORTAL_URL, STUDENT_PORTAL_URL } from '../../services/adminApi';

export default function AdminHeader({
  onToggleMobileSidebar,
  onOpenSearch,
  onOpenNotifications,
  telemetryStatus = 'LIVE',
  unreadNotificationsCount = 0,
}) {
  const { user, logout } = useAdminAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'AD';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 bg-[#EDEAE0] border-b border-[#DFDACB] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-subtle">
      {/* Left: Mobile Toggle & Quick Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] text-[#22355E] hover:bg-white transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full max-w-md flex items-center justify-between bg-white border border-[#DFDACB] hover:border-[#22355E]/50 rounded-xl px-3.5 py-2 text-xs text-[#9B9690] transition-all shadow-sm group text-left"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#9B9690] group-hover:text-[#22355E] transition-colors" />
            <span className="truncate">Search anything (Teachers, Courses, Logs)...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#EDEAE0] border border-[#DFDACB] rounded text-[10px] font-mono text-[#2B2B28]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Telemetry Pill, Notifications, Help, User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Telemetry Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#DFDACB] text-[11px] font-medium text-[#22355E] shadow-sm">
          {telemetryStatus === 'LIVE' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#5C7A5E] animate-pulse" />
              <span className="font-semibold text-[#5C7A5E]">LIVE</span>
              <span className="text-[#9B9690]">Cluster</span>
            </>
          ) : telemetryStatus === 'CONNECTING' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#C99A2E] animate-ping" />
              <span className="text-[#C99A2E]">Connecting...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#C1352B]" />
              <span className="text-[#C1352B]">○ Reconnecting</span>
            </>
          )}
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          onClick={onOpenNotifications}
          title="Notifications & Triage"
          className="relative p-2 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#F7F5EE] text-[#22355E] transition-colors shadow-sm"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#AB5236] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#EDEAE0]">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Help / Guide Shortcut */}
        <button
          type="button"
          onClick={() => navigate('/settings?tab=about')}
          title="Institutional Handbook & Version"
          className="hidden sm:flex p-2 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#F7F5EE] text-[#22355E] transition-colors shadow-sm"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="h-6 w-[1px] bg-[#DFDACB] mx-0.5" />

        {/* Admin Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#F7F5EE] transition-all shadow-sm"
          >
            <div className="w-7 h-7 rounded-lg bg-[#22355E] text-white flex items-center justify-center font-bold text-xs shadow-inner">
              {getInitials(user?.name)}
            </div>
            {/* lg, not md. The sidebar is still expanded at the md breakpoint
                (768px), and revealing the name there pushed the header ~130px
                past the viewport - the block appeared at exactly the width that
                could no longer hold it. Measured at 768x1024. */}
            <div className="hidden lg:block text-left">
              <p className="text-xs font-bold text-[#22355E] leading-tight truncate max-w-[100px]">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[10px] text-[#9B9690] leading-tight">Super Admin</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#9B9690]" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-[#DFDACB] rounded-2xl shadow-dropdown py-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#EDEAE0]">
              <div className="px-4 py-2.5">
                <p className="text-xs font-bold text-[#22355E] truncate">{user?.name || 'Super Admin'}</p>
                <p className="text-[11px] text-[#9B9690] truncate">{user?.email || 'admin@nalanda.edu'}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#22355E]/10 text-[#22355E] text-[10px] font-bold">
                  <Shield className="w-3 h-3" /> Root Authority
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-[#2B2B28] hover:bg-[#F7F5EE] flex items-center gap-2.5"
                >
                  <Settings className="w-3.5 h-3.5 text-[#22355E]" />
                  <span>Platform Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigate('/logs');
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-[#2B2B28] hover:bg-[#F7F5EE] flex items-center gap-2.5"
                >
                  <Shield className="w-3.5 h-3.5 text-[#22355E]" />
                  <span>Audit Logs</span>
                </button>
              </div>

              <div className="py-1">
                <a
                  href={TEACHER_PORTAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-left px-4 py-2 text-xs text-[#2B2B28] hover:bg-[#F7F5EE] flex items-center justify-between"
                >
                  <span className="flex items-center gap-2.5">
                    <User className="w-3.5 h-3.5 text-[#5C7A5E]" />
                    <span>Faculty Portal</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-[#9B9690]" />
                </a>
                <a
                  href={STUDENT_PORTAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-left px-4 py-2 text-xs text-[#2B2B28] hover:bg-[#F7F5EE] flex items-center justify-between"
                >
                  <span className="flex items-center gap-2.5">
                    <User className="w-3.5 h-3.5 text-[#C99A2E]" />
                    <span>Student Portal</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-[#9B9690]" />
                </a>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-[#C1352B] hover:bg-[#C1352B]/10 flex items-center gap-2.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
