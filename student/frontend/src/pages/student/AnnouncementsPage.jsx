import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, UserCircle2 } from 'lucide-react';
import { studentApiService } from '../../services/studentApiService';
import { getSocket } from '../../services/socket';

const TYPE_LABEL = { general: 'General', course: 'Course', urgent: 'Urgent' };
const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', super_admin: 'Super Admin' };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    studentApiService
      .getAnnouncements()
      .then((data) => {
        if (!cancelled) setAnnouncements(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load announcements.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live push: a newly-published announcement appears instantly for every
  // connected student, no refresh needed (master doc section 12).
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleCreated = (announcement) => {
      setAnnouncements((prev) => [announcement, ...prev.filter((a) => a.id !== announcement.id)]);
    };
    socket.on('announcement.created', handleCreated);
    return () => socket.off('announcement.created', handleCreated);
  }, []);

  const handleMarkRead = (id) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    studentApiService.markAnnouncementRead(id).catch(() => {
      // best-effort - read state will just re-sync on next load
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[#22355E]">
            Institute Announcements & Notices
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Official updates from Nalanda Nexus academic administration.
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#2B2B28]/60">Loading announcements…</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-[#AB5236] bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl">{error}</div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#2B2B28]/60 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl">
            No announcements right now. Check back soon.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.isRead && handleMarkRead(item.id)}
                className={`w-full text-left p-5 rounded-2xl bg-[#FAF9F4] border shadow-xs space-y-2 transition-colors student-focus ${
                  item.isRead ? 'border-[#DFDACB]' : 'border-[#AB5236]/50 bg-[#FAF5EA]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-bold font-data rounded bg-[#22355E] text-white uppercase">
                    {TYPE_LABEL[item.type] || 'General'}
                  </span>
                  <span className="text-xs font-data text-[#2B2B28]/60 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(item.publishAt)}
                  </span>
                </div>

                <h3 className="font-heading font-bold text-sm sm:text-base text-[#22355E] flex items-center gap-2">
                  {item.title}
                  {!item.isRead && <span className="w-2 h-2 rounded-full bg-[#AB5236]" />}
                </h3>

                <p className="text-xs sm:text-sm text-[#2B2B28]/80 leading-relaxed">{item.content}</p>

                {item.author && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[#2B2B28]/60">
                    <UserCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Posted by <strong className="text-[#22355E]">{item.author.name}</strong>
                      {' · '}
                      {ROLE_LABEL[item.author.role] || item.author.role}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
