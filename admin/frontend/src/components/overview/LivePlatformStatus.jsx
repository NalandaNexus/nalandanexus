import React, { useState, useEffect } from 'react';
import { Users, GraduationCap, Laptop, FileText, ShieldAlert } from 'lucide-react';

export default function LivePlatformStatus({ telemetryData, telemetryStatus = 'LIVE' }) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Every value below comes straight from the backend's live SSE snapshot —
  // real DB-derived counts and real Socket.IO connection state, not
  // simulated jitter. Falls back to 0 (not a fake baseline) before the
  // first event arrives.
  const activeStudentAccounts = telemetryData?.activeStudentAccounts ?? 0;
  const activeTeacherAccounts = telemetryData?.activeTeacherAccounts ?? 0;
  const connectedAdmins = telemetryData?.connectedAdmins ?? 0;
  const pendingCourseReviews = telemetryData?.pendingCourseReviews ?? 0;
  const suspendedTeachers = telemetryData?.suspendedTeachers ?? 0;

  useEffect(() => {
    setSecondsAgo(0);
    const interval = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [telemetryData]);

  const formatTimestamp = () => {
    if (telemetryStatus === 'DISCONNECTED') {
      return `Last updated ${secondsAgo} seconds ago`;
    }
    if (secondsAgo < 5) return 'Updated just now';
    return `Updated ${secondsAgo}s ago`;
  };

  const METRICS = [
    { label: 'Active Student Accounts', value: activeStudentAccounts.toLocaleString(), icon: Users, color: '#5C7A5E' },
    { label: 'Active Teacher Accounts', value: activeTeacherAccounts.toLocaleString(), icon: GraduationCap, color: '#22355E' },
    { label: 'Connected Admin Sessions', value: connectedAdmins.toLocaleString(), icon: Laptop, color: '#AB5236' },
    { label: 'Courses Awaiting Review', value: pendingCourseReviews.toLocaleString(), icon: FileText, color: '#C99A2E' },
    { label: 'Suspended Teacher Accounts', value: suspendedTeachers.toLocaleString(), icon: ShieldAlert, color: '#C1352B' },
  ];

  return (
    <section className="bg-white border border-[#DFDACB] rounded-2xl p-4 sm:p-5 shadow-card space-y-4">
      {/* Header with Live Status Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDEAE0] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EDEAE0] border border-[#DFDACB] text-xs font-bold text-[#22355E]">
            {telemetryStatus === 'LIVE' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#5C7A5E] animate-pulse" />
                <span className="text-[#5C7A5E]">LIVE NOW</span>
              </>
            ) : telemetryStatus === 'CONNECTING' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#C99A2E] animate-ping" />
                <span className="text-[#C99A2E]">CONNECTING</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#C1352B]" />
                <span className="text-[#C1352B]">RECONNECTING</span>
              </>
            )}
          </div>
          <span className="text-xs font-semibold text-[#22355E]">Real-Time Campus Telemetry</span>
        </div>

        <div className="text-[11px] font-mono text-[#9B9690] flex items-center gap-1">
          <span>●</span>
          <span>{formatTimestamp()}</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {METRICS.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className="p-3 bg-[#F7F5EE] rounded-xl border border-[#DFDACB]/80 hover:bg-[#F2EFE6] transition-colors"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-medium text-[#9B9690] truncate">{m.label}</span>
                <Icon className="w-3.5 h-3.5 text-[#22355E]/70 flex-shrink-0" />
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-[#22355E] tracking-tight">
                {m.value}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
