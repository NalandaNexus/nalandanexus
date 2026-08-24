import React from 'react';
import { Calendar, AlertTriangle, Video } from 'lucide-react';

export default function TodaysSchedule({ schedule, onLaunchLiveClass }) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <section aria-labelledby="todays-schedule-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#22355E]" />
            <h3 id="todays-schedule-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
              Today&apos;s Class Schedule
            </h3>
          </div>
          <p className="text-xs text-[#6E6A64] mt-0.5">
            Timetable with attendance risk warnings and prioritized live teaching studio triggers.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {schedule.map((item) => {
          const isLiveNow = item.isLiveNow;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isLiveNow
                  ? 'bg-[#FFFFFF] border-[#5C7A5E] shadow-card ring-1 ring-[#5C7A5E]/40'
                  : 'bg-[#F7F5EE] border-[#DFDACB] hover:border-[#22355E]'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="text-xs font-bold text-[#22355E] font-mono w-20 flex-shrink-0">
                  {item.time}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#22355E] truncate">{item.subject}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EDEAE0] text-[#22355E] border border-[#DFDACB]">
                      {item.className}
                    </span>
                    {isLiveNow && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#5C7A5E] text-white animate-pulse">
                        LIVE NOW
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6E6A64] mt-0.5">{item.topic}</p>
                </div>
              </div>

              {/* Warnings & Live Launch */}
              <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DFDACB]/60">
                {item.attendanceWarning && (
                  <div className="flex items-center gap-1 text-[11px] text-[#C1352B] font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{item.attendanceWarning}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onLaunchLiveClass && onLaunchLiveClass(item)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    isLiveNow
                      ? 'bg-[#AB5236] hover:bg-[#94452C] text-white'
                      : 'bg-[#22355E] hover:bg-[#16233F] text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  {isLiveNow ? 'Enter Studio' : 'Launch Session'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
