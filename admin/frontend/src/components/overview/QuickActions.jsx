import React from 'react';
import {
  UserPlus,
  BookPlus,
  GraduationCap,
  Bell,
  FileSpreadsheet,
} from 'lucide-react';

export default function QuickActions({
  onCreateTeacher,
  onCreateCourse,
  onAddStudent,
  onCreateAnnouncement,
  onGenerateReport,
}) {
  return (
    <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card space-y-4">
      <div className="border-b border-[#EDEAE0] pb-3">
        <h3 className="text-sm font-bold text-[#22355E]">Administrative Operations</h3>
        <p className="text-xs text-[#9B9690]">Shortcuts for platform governance and user provisioning</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* Primary CTA: Create Teacher (brick-terracotta #AB5236) */}
        <button
          type="button"
          onClick={onCreateTeacher}
          className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-[#AB5236] hover:bg-[#8F3E26] text-white font-semibold text-xs transition-all shadow-cta flex items-center justify-center gap-2 group hover:scale-[1.01] active:scale-[0.99]"
        >
          <UserPlus className="w-4 h-4 text-white flex-shrink-0" />
          <span className="truncate">Create Teacher</span>
        </button>

        {/* Secondary Action: Create Course */}
        <button
          type="button"
          onClick={onCreateCourse}
          className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] hover:bg-[#EDEAE0] text-[#22355E] font-semibold text-xs transition-all flex items-center justify-center gap-2"
        >
          <BookPlus className="w-4 h-4 text-[#22355E] flex-shrink-0" />
          <span className="truncate">Create Course</span>
        </button>

        {/* Secondary Action: Add Student */}
        <button
          type="button"
          onClick={onAddStudent}
          className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] hover:bg-[#EDEAE0] text-[#22355E] font-semibold text-xs transition-all flex items-center justify-center gap-2"
        >
          <GraduationCap className="w-4 h-4 text-[#22355E] flex-shrink-0" />
          <span className="truncate">Add Student</span>
        </button>

        {/* Secondary Action: Announcement */}
        <button
          type="button"
          onClick={onCreateAnnouncement}
          className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] hover:bg-[#EDEAE0] text-[#22355E] font-semibold text-xs transition-all flex items-center justify-center gap-2"
        >
          <Bell className="w-4 h-4 text-[#22355E] flex-shrink-0" />
          <span className="truncate">Announcement</span>
        </button>

        {/* Secondary Action: Generate Report */}
        <button
          type="button"
          onClick={onGenerateReport}
          className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] hover:bg-[#EDEAE0] text-[#22355E] font-semibold text-xs transition-all flex items-center justify-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4 text-[#22355E] flex-shrink-0" />
          <span className="truncate">Generate Report</span>
        </button>
      </div>
    </div>
  );
}
