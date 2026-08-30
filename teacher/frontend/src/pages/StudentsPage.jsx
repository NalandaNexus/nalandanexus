import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowUpRight, ShieldCheck } from 'lucide-react';
import RiskPulseIndicator from '../components/common/RiskPulseIndicator';
import StudentDrillDownDrawer from '../components/students/StudentDrillDownDrawer';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

export default function StudentsPage() {
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [meta, setMeta] = useState({ totalRecords: 0, page: 1, totalPages: 1 });
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState(searchParams.get('classId') || 'all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [page, setPage] = useState(1);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      setError(null);
      const res = await teacherApiService.getStudents({
        search: search || undefined,
        classId: selectedClass !== 'all' ? selectedClass : undefined,
        riskLevel: selectedRisk !== 'all' ? selectedRisk : undefined,
        page,
        limit: 24,
      });
      setStudents(res?.data || []);
      setMeta(res?.meta || { totalRecords: 0, page: 1, totalPages: 1 });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load students.');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedClass, selectedRisk, page]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    socketService.connect();
    const unbindScore = socketService.on('score:update', fetchStudents);
    const unbindSubmission = socketService.on('submission.received', fetchStudents);
    return () => {
      unbindScore();
      unbindSubmission();
    };
  }, [fetchStudents]);

  useEffect(() => {
    teacherApiService.getClasses().then(setClasses).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, selectedClass, selectedRisk]);

  const openStudent = async (st) => {
    setSelectedStudent(st);
    setIsDrawerOpen(true);
    try {
      const full = await teacherApiService.getStudentById(st.id);
      setSelectedStudent(full);
    } catch {
      /* keep the summary shape if detail fetch fails */
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Student Roster & Cohort Directory</h1>
          <p className="text-xs text-[#6E6A64] mt-1">{meta.totalRecords} student{meta.totalRecords === 1 ? '' : 's'} across your classes.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FFFFFF] border border-[#DFDACB]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6A64]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student by name or email..."
            className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#2B2B28] placeholder-[#6E6A64] focus:outline-none focus:border-[#22355E]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#6E6A64] font-semibold">Class:</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-[#F7F5EE] border border-[#DFDACB] rounded-lg px-2.5 py-1 text-xs text-[#22355E] font-bold">
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#6E6A64] font-semibold">Risk:</span>
            <select value={selectedRisk} onChange={(e) => setSelectedRisk(e.target.value)} className="bg-[#F7F5EE] border border-[#DFDACB] rounded-lg px-2.5 py-1 text-xs text-[#22355E] font-bold">
              <option value="all">All Status</option>
              <option value="act_now">Act Now</option>
              <option value="watch">Watch</option>
              <option value="good">Good</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">Loading…</div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">No enrolled students found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {students.map((st) => (
              <div
                key={st.id}
                onClick={() => openStudent(st)}
                className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DFDACB] hover:border-[#22355E] cursor-pointer transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <img src={st.avatar} alt="" className="w-10 h-10 rounded-xl border border-[#DFDACB] bg-[#EDEAE0]" />
                    {st.riskLevel !== 'good' && (
                      <div className="absolute -top-1 -right-1">
                        <RiskPulseIndicator level={st.riskLevel} size="sm" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[#22355E] group-hover:text-[#AB5236] transition-colors truncate flex items-center gap-1">
                      {st.name}
                      {st.verified && <ShieldCheck className="w-3 h-3 text-[#5C7A5E]" title="Verified enrollment" />}
                    </h4>
                    <p className="text-[11px] text-[#6E6A64] truncate">{st.className} • {st.email}</p>
                    {/* The business identity the student quotes in support and
                        that cross-portal sync matches on. Shown because a
                        teacher cannot otherwise tie a person to their enrollment. */}
                    {st.enrollmentId && (
                      <p className="text-[10px] text-[#9B9690] font-mono truncate">{st.enrollmentId}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-[#22355E] font-mono tabular-nums">{st.score}%</div>
                  <span className="text-[10px] text-[#AB5236] font-bold flex items-center gap-0.5 justify-end">
                    Profile <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg bg-white border border-[#DFDACB] text-xs font-bold disabled:opacity-40">Previous</button>
              <span className="text-xs text-[#6E6A64]">Page {meta.page} of {meta.totalPages}</span>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-white border border-[#DFDACB] text-xs font-bold disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}

      <StudentDrillDownDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} student={selectedStudent} />
    </div>
  );
}
