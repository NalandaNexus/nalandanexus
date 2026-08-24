import React, { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

export default function GradesPage() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [gradebook, setGradebook] = useState({ assignments: [], students: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGradebook = useCallback(async (classId) => {
    try {
      setError(null);
      const data = await teacherApiService.getGradebook(classId || undefined);
      setGradebook(data || { assignments: [], students: [] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load gradebook.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    teacherApiService.getClasses().then(setClasses).catch(() => {});
    fetchGradebook();
  }, [fetchGradebook]);

  useEffect(() => {
    socketService.connect();
    const unbind = socketService.on('score:update', () => fetchGradebook(selectedClassId));
    return unbind;
  }, [fetchGradebook, selectedClassId]);

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    setIsLoading(true);
    fetchGradebook(classId);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Gradebook</h1>
          <p className="text-xs text-[#6E6A64] mt-1">Real scores from graded assignment submissions — nothing here is estimated.</p>
        </div>
        <button
          onClick={() => teacherApiService.downloadReport('grades', selectedClassId ? { classId: selectedClassId } : {})}
          className="flex items-center gap-2 bg-[#22355E] hover:bg-[#16233F] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs"
        >
          <Download className="w-4 h-4" /> Export CSV Report
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[#6E6A64]">Class:</span>
        <select value={selectedClassId} onChange={(e) => handleClassChange(e.target.value)} className="bg-white border border-[#DFDACB] rounded-lg px-2.5 py-1.5 text-xs">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-[#DFDACB] bg-[#FFFFFF]">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#9B9690]">Loading…</div>
        ) : gradebook.students.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#9B9690]">No students to grade in this selection.</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F5EE] text-[#22355E] border-b border-[#DFDACB]">
              <tr>
                <th className="py-3 px-4 font-bold uppercase tracking-wider sticky left-0 bg-[#F7F5EE]">Student</th>
                {gradebook.assignments.map((a) => (
                  <th key={a.id} className="py-3 px-4 font-bold uppercase tracking-wider whitespace-nowrap">{a.title}</th>
                ))}
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Overall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFDACB] text-[#2B2B28]">
              {gradebook.students.map((st) => (
                <tr key={st.id} className="hover:bg-[#F7F5EE]">
                  <td className="py-3 px-4 font-bold text-[#22355E] sticky left-0 bg-white">{st.name}</td>
                  {st.grades.map((g, i) => (
                    <td key={i} className="py-3 px-4 font-mono">
                      {g.percent != null ? `${g.percent}%` : <span className="text-[#9B9690]">—</span>}
                    </td>
                  ))}
                  <td className="py-3 px-4 font-mono font-bold text-[#22355E]">
                    {st.overallPercent != null ? `${st.overallPercent}%` : <span className="text-[#9B9690]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
