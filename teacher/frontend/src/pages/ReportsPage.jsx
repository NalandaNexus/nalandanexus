import React, { useState, useEffect } from 'react';
import { Download, Users, CalendarCheck, ClipboardList, GraduationCap, Layers } from 'lucide-react';
import { teacherApiService } from '../services/teacherApiService';

const REPORTS = [
  { type: 'students', title: 'Student Roster Report', description: 'Every active student, verified-enrollment status, scores, and attendance.', icon: Users },
  { type: 'attendance', title: 'Attendance Report', description: 'Full attendance log across all classes and dates.', icon: CalendarCheck },
  { type: 'assignments', title: 'Assignment Report', description: 'Every assignment with submission and grading counts.', icon: ClipboardList },
  { type: 'grades', title: 'Grade Report', description: 'Every graded submission with scores and feedback.', icon: GraduationCap },
  { type: 'classes', title: 'Class Summary Report', description: 'Per-class roster size, verified enrollment, and averages.', icon: Layers },
];

export default function ReportsPage() {
  const [overview, setOverview] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    teacherApiService.getDashboardOverview().then(setOverview).catch(() => {});
  }, []);

  const handleDownload = async (type) => {
    setDownloading(type);
    try {
      await teacherApiService.downloadReport(type);
    } catch (err) {
      alert(err.message || 'Failed to generate report.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Academic Reports</h1>
        <p className="text-xs text-[#6E6A64] mt-1">Every report is generated live from real MongoDB data — nothing here is estimated.</p>
      </div>

      {overview?.coreStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-2">
            <span className="text-xs text-[#6E6A64]">Total Classes</span>
            <div className="text-3xl font-extrabold text-[#22355E] font-mono">{overview.coreStats.totalClasses?.value ?? 0}</div>
          </div>
          <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-2">
            <span className="text-xs text-[#6E6A64]">Total Students</span>
            <div className="text-3xl font-extrabold text-[#22355E] font-mono">{overview.coreStats.totalStudents?.value ?? 0}</div>
          </div>
          <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-2">
            <span className="text-xs text-[#6E6A64]">Class Average Score</span>
            <div className="text-3xl font-extrabold text-[#22355E] font-mono">{overview.coreStats.avgScore?.value ?? 0}%</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.type} className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-center text-[#22355E] flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#22355E]">{r.title}</h3>
                  <p className="text-xs text-[#6E6A64] mt-1">{r.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(r.type)}
                disabled={downloading === r.type}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22355E] hover:bg-[#16233F] text-white text-xs font-bold disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" /> {downloading === r.type ? 'Exporting…' : 'CSV'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
