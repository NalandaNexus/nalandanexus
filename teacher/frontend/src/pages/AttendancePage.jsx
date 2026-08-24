import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';

const STATUS_OPTIONS = ['present', 'absent', 'late'];
const STATUS_STYLE = {
  present: 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30',
  absent: 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30',
  late: 'bg-[#C99A2E]/15 text-[#8F6A15] border-[#C99A2E]/30',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    teacherApiService
      .getClasses()
      .then((data) => {
        setClasses(data || []);
        if (data?.length) setSelectedClassId(data[0].id);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load classes.'))
      .finally(() => setIsLoading(false));
  }, []);

  const loadRosterAndAttendance = useCallback(async () => {
    if (!selectedClassId) return;
    setIsLoadingRoster(true);
    try {
      const [studentsRes, attendanceRecords] = await Promise.all([
        teacherApiService.getClassStudents(selectedClassId, { limit: 100 }),
        teacherApiService.getAttendance({ classId: selectedClassId, date }),
      ]);
      const students = studentsRes?.data || [];
      setRoster(students);
      const initial = {};
      students.forEach((s) => {
        initial[s.id] = 'present';
      });
      (attendanceRecords || []).forEach((r) => {
        initial[r.studentId] = r.status;
      });
      setStatuses(initial);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load roster.');
    } finally {
      setIsLoadingRoster(false);
    }
  }, [selectedClassId, date]);

  useEffect(() => {
    loadRosterAndAttendance();
  }, [loadRosterAndAttendance]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const records = roster.map((s) => ({ studentId: s.id, status: statuses[s.id] || 'present' }));
      await teacherApiService.markAttendance(selectedClassId, date, records);
      setSaveMessage('Attendance saved.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage(err instanceof ApiClientError ? err.message : 'Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Attendance Command Center</h1>
        <p className="text-xs text-[#6E6A64] mt-1">Take roll call and correct attendance for any class and date.</p>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">No classes created yet.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedClassId === c.id
                      ? 'bg-[#22355E] text-white border-[#16233F] shadow-xs'
                      : 'bg-[#FFFFFF] text-[#6E6A64] border-[#DFDACB] hover:text-[#2B2B28]'
                  }`}
                >
                  {c.name} ({c.attendanceRate}%)
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <CalendarDays className="w-4 h-4 text-[#6E6A64]" />
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white border border-[#DFDACB] rounded-lg px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#DFDACB] bg-[#FFFFFF]">
            {isLoadingRoster ? (
              <div className="p-8 text-center text-xs text-[#9B9690]">Loading roster…</div>
            ) : roster.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9B9690]">No enrolled students found in this class.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5EE] text-[#22355E] border-b border-[#DFDACB]">
                  <tr>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider">Student</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider">Attendance %</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider">Status for {date}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDACB] text-[#2B2B28]">
                  {roster.map((st) => (
                    <tr key={st.id} className="hover:bg-[#F7F5EE] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img src={st.avatar} alt="" className="w-8 h-8 rounded-xl border border-[#DFDACB] bg-[#EDEAE0]" />
                          <div>
                            <div className="font-bold text-[#22355E]">{st.name}</div>
                            <div className="text-[10px] text-[#6E6A64]">{st.email}{st.verified && <span className="ml-1.5 text-[#5C7A5E]">· Verified</span>}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold tabular-nums">
                        <span className={st.attendanceRate < 75 ? 'text-[#C1352B]' : 'text-[#5C7A5E]'}>{st.attendanceRate}%</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setStatuses((prev) => ({ ...prev, [st.id]: opt }))}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                                statuses[st.id] === opt ? STATUS_STYLE[opt] : 'bg-white text-[#9B9690] border-[#DFDACB]'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {roster.length > 0 && (
            <div className="flex items-center justify-end gap-3">
              {saveMessage && <span className="text-xs font-semibold text-[#5C7A5E]">{saveMessage}</span>}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#AB5236] hover:bg-[#94452C] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-cta disabled:opacity-60"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
