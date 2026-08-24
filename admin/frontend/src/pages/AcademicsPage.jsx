import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileCheck, FileSpreadsheet, CalendarCheck, FolderArchive } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

function EmptyActivity({ text }) {
  return <p className="text-xs text-[#9B9690] text-center py-10">{text}</p>;
}

export default function AcademicsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'assignments';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [attendanceSummaries, setAttendanceSummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const fetchAll = useCallback(() => {
    return Promise.all([adminApi.getAcademicsOverview(), adminApi.getAttendanceSummaries()])
      .then(([overview, summaries]) => {
        setData(overview);
        setAttendanceSummaries(summaries);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // This page previously fetched once and never refreshed — even its one
  // genuinely real tab (attendance) required a manual reload to see a
  // teacher's update. Live assignment/quiz/attendance activity bridged in
  // from teacher/backend now pushes here in real time.
  useRealtimeEvents(['assignment.activity.updated', 'quiz.activity.updated', 'attendance.summary.updated'], fetchAll);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Academic Operations & Assessments</h1>
          <p className="text-xs text-[#9B9690] mt-1">
            Institutional attendance and course-repository stats owned by the Admin service.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DFDACB] pb-2">
        {[
          { id: 'assignments', label: 'Assignments & Evaluations', icon: FileCheck },
          { id: 'exams', label: 'Examinations Timetable', icon: FileSpreadsheet },
          { id: 'attendance', label: 'Cohort Attendance Reports', icon: CalendarCheck },
          { id: 'content', label: 'Learning Material Repository', icon: FolderArchive },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#22355E] text-white shadow-sm'
                  : 'text-[#9B9690] hover:text-[#22355E] hover:bg-[#F7F5EE]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#9B9690] space-y-2">
          <div className="w-6 h-6 border-2 border-[#22355E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading academic data...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-white border border-[#C1352B]/30 rounded-2xl text-xs text-[#C1352B]">{error}</div>
      ) : (
        <>
          {activeTab === 'assignments' && (
            <div className="bg-white border border-[#DFDACB] rounded-2xl shadow-card overflow-hidden">
              <div className="p-4 bg-[#F7F5EE] border-b border-[#DFDACB]">
                <h3 className="text-sm font-bold text-[#22355E]">Assignments &amp; Evaluations</h3>
                <p className="text-[11px] text-[#9B9690] mt-0.5">
                  Live activity bridged from the Teacher Portal — read-only, monitored here, graded there.
                </p>
              </div>
              {data.assignments.items.length === 0 ? (
                <EmptyActivity text="No assignment activity has been bridged from the Teacher Portal yet." />
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F5EE]/60 border-b border-[#DFDACB] text-[#9B9690] font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Assignment</th>
                      <th className="py-2.5 px-4">Class</th>
                      <th className="py-2.5 px-4">Teacher</th>
                      <th className="py-2.5 px-4">Due</th>
                      <th className="py-2.5 px-4">Submitted</th>
                      <th className="py-2.5 px-4">To Grade</th>
                      <th className="py-2.5 px-4">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEAE0] text-[#2B2B28]">
                    {data.assignments.items.map((a) => (
                      <tr key={a.id || a._id}>
                        <td className="py-2.5 px-4 font-semibold text-[#22355E]">{a.title}</td>
                        <td className="py-2.5 px-4 text-[#9B9690]">{a.className || '—'}</td>
                        <td className="py-2.5 px-4 text-[#9B9690]">{a.teacherName || '—'}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[#9B9690]">{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</td>
                        <td className="py-2.5 px-4 font-mono">{a.submitted}/{a.total}</td>
                        <td className="py-2.5 px-4 font-mono">{a.toGrade}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-[#5C7A5E]">{a.avgScore != null ? `${a.avgScore}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="bg-white border border-[#DFDACB] rounded-2xl shadow-card overflow-hidden">
              <div className="p-4 bg-[#F7F5EE] border-b border-[#DFDACB]">
                <h3 className="text-sm font-bold text-[#22355E]">Examinations &amp; Quizzes</h3>
                <p className="text-[11px] text-[#9B9690] mt-0.5">
                  Live scheduling bridged from the Teacher Portal — question content stays there, never mirrored here.
                </p>
              </div>
              {data.exams.items.length === 0 ? (
                <EmptyActivity text="No exam/quiz activity has been bridged from the Teacher Portal yet." />
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F5EE]/60 border-b border-[#DFDACB] text-[#9B9690] font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Title</th>
                      <th className="py-2.5 px-4">Class</th>
                      <th className="py-2.5 px-4">Teacher</th>
                      <th className="py-2.5 px-4">Questions</th>
                      <th className="py-2.5 px-4">Duration</th>
                      <th className="py-2.5 px-4">Scheduled</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEAE0] text-[#2B2B28]">
                    {data.exams.items.map((e) => (
                      <tr key={e.id || e._id}>
                        <td className="py-2.5 px-4 font-semibold text-[#22355E]">{e.title}</td>
                        <td className="py-2.5 px-4 text-[#9B9690]">{e.className || '—'}</td>
                        <td className="py-2.5 px-4 text-[#9B9690]">{e.teacherName || '—'}</td>
                        <td className="py-2.5 px-4 font-mono">{e.questionCount}</td>
                        <td className="py-2.5 px-4 font-mono">{e.durationMinutes} min</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[#9B9690]">{e.scheduledAt ? new Date(e.scheduledAt).toLocaleString() : '—'}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22355E]/10 text-[#22355E] border border-[#22355E]/20 uppercase">
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#DFDACB] rounded-2xl p-6 shadow-card space-y-4">
                <h3 className="text-sm font-bold text-[#22355E]">Institutional Attendance Adherence</h3>
                {data.attendance.byDepartment.length === 0 ? (
                  <p className="text-xs text-[#9B9690]">No active students with attendance records yet.</p>
                ) : (
                  <>
                    <div className="p-4 bg-[#5C7A5E]/10 border border-[#5C7A5E]/30 rounded-xl text-xs text-[#5C7A5E] font-semibold">
                      ● Overall Campus Attendance: {data.attendance.overallPercent}% across{' '}
                      {data.attendance.byDepartment.length} department{data.attendance.byDepartment.length === 1 ? '' : 's'}
                    </div>
                    <div className="space-y-2 text-xs">
                      {data.attendance.byDepartment.map((d) => (
                        <div key={d.department} className="p-3 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl flex items-center justify-between">
                          <span className="font-semibold text-[#22355E]">{d.department}</span>
                          <span className="font-mono text-[#9B9690]">{d.studentCount} students</span>
                          <span className="font-mono font-bold text-[#5C7A5E]">{d.avgAttendance}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white border border-[#DFDACB] rounded-2xl shadow-card overflow-hidden">
                <div className="p-4 bg-[#F7F5EE] border-b border-[#DFDACB]">
                  <h3 className="text-sm font-bold text-[#22355E]">Daily Class Attendance (Teacher Portal)</h3>
                  <p className="text-[11px] text-[#9B9690] mt-0.5">Per-class daily tallies — per-student detail stays owned by the Teacher Portal.</p>
                </div>
                {attendanceSummaries.length === 0 ? (
                  <EmptyActivity text="No attendance has been bridged from the Teacher Portal yet." />
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F5EE]/60 border-b border-[#DFDACB] text-[#9B9690] font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Class</th>
                        <th className="py-2.5 px-4">Teacher</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Present</th>
                        <th className="py-2.5 px-4">Absent</th>
                        <th className="py-2.5 px-4">Late</th>
                        <th className="py-2.5 px-4">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEAE0] text-[#2B2B28]">
                      {attendanceSummaries.map((s) => (
                        <tr key={s.id || s._id}>
                          <td className="py-2.5 px-4 font-semibold text-[#22355E]">{s.className || '—'}</td>
                          <td className="py-2.5 px-4 text-[#9B9690]">{s.teacherName || '—'}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-[#9B9690]">{s.date}</td>
                          <td className="py-2.5 px-4 font-mono text-[#5C7A5E]">{s.presentCount}</td>
                          <td className="py-2.5 px-4 font-mono text-[#C1352B]">{s.absentCount}</td>
                          <td className="py-2.5 px-4 font-mono text-[#C99A2E]">{s.lateCount}</td>
                          <td className="py-2.5 px-4 font-mono font-bold">
                            {s.totalCount ? Math.round(((s.presentCount + s.lateCount * 0.5) / s.totalCount) * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="bg-white border border-[#DFDACB] rounded-2xl p-6 shadow-card space-y-4">
              <h3 className="text-sm font-bold text-[#22355E]">Curriculum Module Repository</h3>
              <div className="p-4 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl text-xs text-[#2B2B28] space-y-1">
                <p><strong>{data.content.totalModules}</strong> modules across <strong>{data.content.courseCount}</strong> approved courses</p>
                <p className="text-[#9B9690]">File/video storage is not owned by the Admin service — see implementation report.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
