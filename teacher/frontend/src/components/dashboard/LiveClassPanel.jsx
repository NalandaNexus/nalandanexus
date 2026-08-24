import React from 'react';
import { Video, Users } from 'lucide-react';

/**
 * Real fields only: className/subject/topic/activeStudents/totalStudents
 * come from GET /dashboard (schedule.service.js#getActiveLiveSession).
 * That endpoint intentionally returns null/[] for responseRate/correctRate/
 * questions/earlyFinishers because no live-polling capability exists in
 * this backend yet — so this panel doesn't render a fabricated in-session
 * quiz dashboard for a feature that was never built.
 */
export default function LiveClassPanel({ liveState, todaysSchedule = [] }) {
  if (!liveState || !liveState.isActive) {
    const next = todaysSchedule.find((item) => !item.isLiveNow) || todaysSchedule[0];
    return (
      <section aria-labelledby="live-classroom-heading" className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-center text-[#6E6A64]">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h3 id="live-classroom-heading" className="text-xs font-bold text-[#22355E]">
              No Live Class Currently Active
            </h3>
            <p className="text-[11px] text-[#6E6A64]">
              {next
                ? `Next scheduled lecture today: ${next.time} — ${next.subject} (${next.className}).`
                : 'No more classes scheduled today.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="live-classroom-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#5C7A5E] shadow-card space-y-4 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5C7A5E]/15 border border-[#5C7A5E]/30 flex items-center justify-center text-[#5C7A5E]">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#5C7A5E] text-white">
                LIVE CLASSROOM IN SESSION
              </span>
              <span className="text-xs font-bold text-[#22355E]">{liveState.className}</span>
            </div>
            <h3 id="live-classroom-heading" className="text-base font-bold text-[#22355E] font-display mt-0.5">
              {liveState.subject}{liveState.topic ? `: ${liveState.topic}` : ''}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#22355E] bg-[#F7F5EE] px-3 py-1.5 rounded-xl border border-[#DFDACB]">
          <Users className="w-4 h-4 text-[#5C7A5E]" />
          <span className="font-bold">
            {liveState.activeStudents} / {liveState.totalStudents} Present
          </span>
        </div>
      </div>
    </section>
  );
}
