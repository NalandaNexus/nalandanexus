import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { announcementService } from '../../services/announcementService';
import { connectPublicSocket } from '../../services/socket';

const TYPE_STYLE = {
  urgent: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  course: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  general: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Real, backend-driven announcements (see services/announcementService.js
 * -> GET /api/public/announcements) - left-aligned, constrained-width panel
 * per the design brief, not a full-bleed section. No hardcoded copy: an
 * empty/failed fetch shows an honest empty/error state, never fake items.
 */
export default function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | success | empty | error

  const fetchAnnouncements = useCallback(() => {
    setStatus('loading');
    announcementService
      .listPublicAnnouncements(6)
      .then((data) => {
        setAnnouncements(data);
        setStatus(data.length ? 'success' : 'empty');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Live sync: an admin/teacher-created institution-wide announcement pushes
  // over the public socket namespace right after the write is confirmed -
  // refetch rather than trying to splice the bare event payload in.
  useEffect(() => {
    const socket = connectPublicSocket();
    const onCreated = () => fetchAnnouncements();
    socket.on('announcement.created', onCreated);
    return () => socket.off('announcement.created', onCreated);
  }, [fetchAnnouncements]);

  return (
    <section className="relative py-8 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-4"
        >
          <Megaphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h2 className="font-heading font-bold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
            Announcements
          </h2>
        </motion.div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#0D1424]/60 backdrop-blur-sm divide-y divide-slate-200 dark:divide-white/10 max-h-[420px] overflow-y-auto">
          {status === 'loading' && (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">Loading announcements…</div>
          )}

          {status === 'error' && (
            <div className="p-6 flex flex-col items-center gap-2 text-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Announcements unavailable right now.</span>
              <button
                onClick={fetchAnnouncements}
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {status === 'empty' && (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">No announcements available right now.</div>
          )}

          {status === 'success' &&
            announcements.map((a) => (
              <div key={a.id} className="p-4 hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${TYPE_STYLE[a.type] || TYPE_STYLE.general}`}>
                    {a.type}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{timeAgo(a.publishAt)}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{a.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{a.content}</p>
              </div>
            ))}
        </div>

        {status === 'success' && announcements.length >= 6 && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing latest {announcements.length} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
