import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, ArrowRight } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPopover({ isOpen, onClose }) {
  const popoverRef = useRef(null);
  const { tasks } = useStudent();

  const today = new Date();
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const currentMonth = MONTH_NAMES[viewDate.getMonth()];
  const currentYear = viewDate.getFullYear();
  const isViewingCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();

  const changeMonth = (delta) => {
    setViewDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      setSelectedDay(1);
      return next;
    });
  };

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

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const startDayOffset = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 = Sunday
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Map task due dates within the currently-viewed month only (e.g. '2026-08-16' -> day 16)
  const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  const taskDueDayMap = {};
  tasks.forEach((t) => {
    if (t.dueIsoDate && t.dueIsoDate.startsWith(monthPrefix)) {
      const day = parseInt(t.dueIsoDate.split('-')[2], 10);
      if (!taskDueDayMap[day]) taskDueDayMap[day] = [];
      taskDueDayMap[day].push(t);
    }
  });

  const selectedDateTasks = taskDueDayMap[selectedDay] || [];

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-12 w-80 sm:w-96 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-label="Student Learning Calendar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#F2EFE6] border-b border-[#DFDACB]">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 text-[#22355E]" />
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="p-0.5 text-[#2B2B28]/60 hover:text-[#22355E] rounded transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <h3 className="font-heading font-bold text-sm text-[#22355E] w-28 text-center">
            {currentMonth} {currentYear}
          </h3>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="p-0.5 text-[#2B2B28]/60 hover:text-[#22355E] rounded transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#2B2B28]/60 hover:text-[#2B2B28] rounded-full hover:bg-black/5 transition-colors"
          aria-label="Close calendar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Calendar Matrix */}
      <div className="p-3.5 border-b border-[#DFDACB]">
        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {weekDays.map((wd) => (
            <span key={wd} className="text-[10px] font-semibold text-[#2B2B28]/60 uppercase">
              {wd}
            </span>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Empty offset spaces */}
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-7 w-7" />
          ))}

          {/* Days 1 to 31 */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const hasTasks = Boolean(taskDueDayMap[dayNum]);
            const isSelected = selectedDay === dayNum;
            const isToday = isViewingCurrentMonth && dayNum === today.getDate();

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => setSelectedDay(dayNum)}
                className={`relative h-7 w-7 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-data transition-all student-focus ${
                  isSelected
                    ? 'bg-[#22355E] text-white font-bold shadow-xs'
                    : isToday
                    ? 'bg-[#AB5236]/15 text-[#AB5236] font-bold ring-1 ring-[#AB5236]'
                    : 'text-[#2B2B28] hover:bg-[#EDEAE0]'
                }`}
              >
                <span>{dayNum}</span>
                {/* Task indicator dot */}
                {hasTasks && !isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#AB5236]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Task Details */}
      <div className="p-3.5 bg-[#FAF5EA]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-heading font-bold text-[#22355E]">
            {currentMonth} {selectedDay}, {currentYear}
          </span>
          <span className="text-[10px] font-data text-[#2B2B28]/60">
            {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'task due' : 'tasks due'}
          </span>
        </div>

        {selectedDateTasks.length === 0 ? (
          <p className="text-xs text-[#2B2B28]/60 italic py-2">
            No deadlines scheduled for this date. Great day for deep revision!
          </p>
        ) : (
          <div className="space-y-2">
            {selectedDateTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#DFDACB] shadow-2xs"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-[#22355E] truncate">{t.title}</p>
                  <p className="text-[10px] font-body text-[#2B2B28]/70 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-[#AB5236]" />
                    <span>{t.type} · {t.dueDateLabel}</span>
                  </p>
                </div>
                <Link
                  to={t.targetUrl}
                  onClick={onClose}
                  className="px-2.5 py-1 text-xs font-bold text-white bg-[#AB5236] hover:bg-[#92422a] rounded-lg transition-colors shrink-0 flex items-center gap-1"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
