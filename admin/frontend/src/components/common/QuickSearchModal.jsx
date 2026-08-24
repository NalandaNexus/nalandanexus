import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileSpreadsheet,
  Activity,
  Bell,
  Settings,
  Shield,
  ArrowRight,
  X,
} from 'lucide-react';

const SEARCH_DIRECTORY = [
  { title: 'System Overview Dashboard', category: 'Navigation', path: '/', icon: LayoutDashboard },
  { title: 'Teacher Management & Provisioning', category: 'Management', path: '/teachers', icon: GraduationCap },
  { title: 'Student Enrollment & Records', category: 'Management', path: '/students', icon: Users },
  { title: 'Course Governance & Syllabus Accreditation', category: 'Management', path: '/courses', icon: BookOpen },
  { title: 'Academic Operations & Assessments', category: 'Academics', path: '/academics', icon: FileSpreadsheet },
  { title: 'Institutional Telemetry & Analytics', category: 'System', path: '/analytics', icon: Activity },
  { title: 'Campus Broadcast Announcements', category: 'System', path: '/announcements', icon: Bell },
  { title: 'System Security & Audit Trail', category: 'System', path: '/logs', icon: Shield },
  { title: 'Global Platform Settings & Policies', category: 'Settings', path: '/settings', icon: Settings },
];

export default function QuickSearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const filtered = query.trim()
    ? SEARCH_DIRECTORY.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_DIRECTORY;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard events (Cmd/Ctrl+K, Arrows, Enter, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        navigate(filtered[selectedIndex].path);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border border-[#DFDACB] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#EDEAE0] flex items-center gap-3 bg-[#F7F5EE]">
          <Search className="w-5 h-5 text-[#22355E] flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search operational console (Teachers, Courses, Logs, Settings)..."
            className="w-full bg-transparent text-sm text-[#2B2B28] placeholder-[#9B9690] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9B9690] hover:text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#EDEAE0]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9B9690]">
              No administrative modules found matching "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#22355E] text-white'
                      : 'hover:bg-[#F7F5EE] text-[#2B2B28]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-white/15 text-white' : 'bg-[#EDEAE0] text-[#22355E]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#22355E]'}`}>
                        {item.title}
                      </p>
                      <p className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-[#9B9690]'}`}>
                        {item.category}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      isSelected ? 'text-white translate-x-1' : 'text-[#9B9690]'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[#F7F5EE] border-t border-[#EDEAE0] flex items-center justify-between text-[11px] text-[#9B9690]">
          <div className="flex items-center gap-2">
            <span>Use</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#DFDACB] rounded text-[10px] font-mono text-[#2B2B28]">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#DFDACB] rounded text-[10px] font-mono text-[#2B2B28]">↓</kbd>
            <span>to navigate</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#DFDACB] rounded text-[10px] font-mono text-[#2B2B28]">Enter</kbd>
            <span>to select</span>
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#DFDACB] rounded text-[10px] font-mono text-[#2B2B28]">Esc</kbd>
            <span className="ml-1">to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
