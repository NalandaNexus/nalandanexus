import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Clock, Award, Flame, BookOpen, AlertCircle, X } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

export default function NotificationPopover({ isOpen, onClose }) {
  const popoverRef = useRef(null);
  const { notifications, unreadNotificationsCount, markNotificationsRead } = useStudent();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'points':
        return <Award className="w-4 h-4 text-[#C99A2E]" />;
      case 'streak':
        return <Flame className="w-4 h-4 text-[#AB5236]" />;
      case 'course':
        return <BookOpen className="w-4 h-4 text-[#22355E]" />;
      case 'deadline':
      default:
        return <Clock className="w-4 h-4 text-[#AB5236]" />;
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-12 w-80 sm:w-96 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#F2EFE6] border-b border-[#DFDACB]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#22355E]" />
          <h3 className="font-heading font-bold text-sm text-[#22355E]">Notifications</h3>
          {unreadNotificationsCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-data font-bold rounded-full bg-[#AB5236] text-white">
              {unreadNotificationsCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadNotificationsCount > 0 && (
            <button
              onClick={markNotificationsRead}
              className="text-xs font-semibold text-[#22355E] hover:text-[#AB5236] flex items-center gap-1 transition-colors student-focus rounded px-1"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-[#2B2B28]/60 hover:text-[#2B2B28] rounded-full hover:bg-black/5 transition-colors"
            aria-label="Close notification popover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#DFDACB]/60">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-[#2B2B28]/60 text-xs">
            No notifications right now.
          </div>
        ) : (
          notifications.map((notif) => (
            <Link
              key={notif.id}
              to={notif.link || '/student/dashboard'}
              onClick={onClose}
              className={`flex items-start gap-3 p-3.5 hover:bg-[#EDEAE0]/70 transition-colors block ${
                !notif.isRead ? 'bg-[#FAF5EA]' : ''
              }`}
            >
              <div className="p-2 rounded-xl bg-white border border-[#DFDACB] shadow-xs mt-0.5 shrink-0">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p
                    className={`text-xs font-medium truncate ${
                      !notif.isRead ? 'text-[#22355E] font-bold' : 'text-[#2B2B28]'
                    }`}
                  >
                    {notif.title}
                  </p>
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#AB5236] shrink-0" />
                  )}
                </div>
                {notif.description && (
                  <p className="text-[11px] text-[#2B2B28]/70 line-clamp-1 mt-0.5">
                    {notif.description}
                  </p>
                )}
                <span className="text-[10px] font-data text-[#2B2B28]/50 mt-1 block">
                  {notif.time}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-[#F2EFE6] border-t border-[#DFDACB] text-center">
        <Link
          to="/student/announcements"
          onClick={onClose}
          className="text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors"
        >
          View Institute Announcements →
        </Link>
      </div>
    </div>
  );
}
