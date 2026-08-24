import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  FileText,
  Video,
  BrainCircuit,
  CheckSquare,
  Trophy,
  TrendingUp,
  MessageSquare,
  Megaphone,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';

export const studentNavItems = [
  { path: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/student/parambh', label: 'Parambh Course', icon: GraduationCap },
  { path: '/student/notes', label: 'Notes', icon: FileText },
  { path: '/student/live-classes', label: 'Live Classes', icon: Video },
  { path: '/student/quizzes', label: 'Quizzes', icon: BrainCircuit },
  { path: '/student/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/student/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/student/performance', label: 'My Performance', icon: TrendingUp },
  { path: '/student/messages', label: 'Messages', icon: MessageSquare },
  { path: '/student/announcements', label: 'Announcements', icon: Megaphone },
  { path: '/student/settings', label: 'Settings', icon: Settings },
  { path: '/student/help', label: 'Help & Support', icon: HelpCircle },
];

export default function StudentSidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { student } = useStudent();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const studentName = student?.name || user?.name || 'Student';
  const initials = studentName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'ST';

  return (
    <aside
      className="hidden lg:flex flex-col w-64 bg-[#FAF9F4] border-r border-[#DFDACB] h-screen sticky top-0 shrink-0 z-40 select-none"
      aria-label="Student Sidebar Navigation"
    >
      {/* Brand Seal & Header */}
      <div className="p-5 border-b border-[#DFDACB]/80 flex items-center justify-between">
        <Link
          to="/student/dashboard"
          className="flex items-center gap-3 group focus:outline-hidden"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-md ring-2 ring-[#DFDACB] bg-white group-hover:scale-105 transition-transform">
            <img
              src="/favicon.svg"
              alt="Nalanda Nexus Seal"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="font-heading font-extrabold text-base text-[#22355E] tracking-tight block">
              Nalanda <span className="text-[#AB5236]">Nexus</span>
            </span>
            <span className="text-[10px] font-semibold text-[#C99A2E] tracking-wider uppercase">
              Student Workspace
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation List with Subtle Scrollbar */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {studentNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] student-focus ${
                  isActive
                    ? 'bg-[#22355E] text-white shadow-xs'
                    : 'text-[#2B2B28]/80 hover:text-[#22355E] hover:bg-[#EDEAE0]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#C99A2E]' : 'text-[#22355E]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Student Profile Footer & Logout Action */}
      <div className="p-3 border-t border-[#DFDACB]/80 bg-[#F2EFE6]">
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-[#DFDACB] shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#22355E] text-[#EDEAE0] flex items-center justify-center font-heading font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#22355E] truncate leading-tight">
                {studentName}
              </p>
              <p className="text-[10px] font-data text-[#2B2B28]/60 truncate">
                {student?.points ?? 0} pts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-[#2B2B28]/60 hover:text-[#AB5236] rounded-lg hover:bg-black/5 transition-colors student-focus"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
