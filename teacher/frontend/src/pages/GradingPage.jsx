import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

export default function GradingPage() {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', classId: '', dueDate: '', description: '', maxScore: 100, status: 'published' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeAssignment, setActiveAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [gradeDrafts, setGradeDrafts] = useState({});

  const fetchAssignments = useCallback(async () => {
    try {
      setError(null);
      const data = await teacherApiService.getAssignments();
      setAssignments(data || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load assignments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
    teacherApiService.getClasses().then(setClasses).catch(() => {});
  }, [fetchAssignments]);

  useEffect(() => {
    socketService.connect();
    const unbindScore = socketService.on('score:update', fetchAssignments);
    const unbindSubmission = socketService.on('submission.received', fetchAssignments);
    return () => {
      unbindScore();
      unbindSubmission();
    };
  }, [fetchAssignments]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.classId || !form.dueDate) {
      setFormError('Title, class, and due date are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await teacherApiService.createAssignment({ ...form, maxScore: Number(form.maxScore) });
      setCreateOpen(false);
      setForm({ title: '', classId: '', dueDate: '', description: '', maxScore: 100, status: 'published' });
      fetchAssignments();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEvaluate = async (assignment) => {
    setActiveAssignment(assignment);
    try {
      const data = await teacherApiService.getAssignmentSubmissions(assignment.id);
      setSubmissions(data || []);
      const drafts = {};
      (data || []).forEach((s) => {
        if (s.status === 'graded') drafts[s.id] = { score: s.score, feedback: s.feedback || '' };
      });
      setGradeDrafts(drafts);
    } catch {
      setSubmissions([]);
    }
  };

  const handleGrade = async (submissionId, maxScore) => {
    const draft = gradeDrafts[submissionId];
    if (!draft || draft.score === undefined || draft.score === '') return;
    try {
      await teacherApiService.gradeSubmission(submissionId, Number(draft.score), draft.feedback || '');
      const data = await teacherApiService.getAssignmentSubmissions(activeAssignment.id);
      setSubmissions(data || []);
      fetchAssignments();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Failed to save grade.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Assignments & Grading Studio</h1>
          <p className="text-xs text-[#6E6A64] mt-1">Create assignments, review submissions, and grade with feedback.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-[#AB5236] hover:bg-[#94452C] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-cta"
        >
          <Plus className="w-4 h-4" /> Create Assignment
        </button>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-[#DFDACB] bg-[#FFFFFF]">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#9B9690]">Loading…</div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#9B9690]">No assignments created yet.</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F5EE] text-[#22355E] border-b border-[#DFDACB]">
              <tr>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Assignment Title</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Class</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Due Date</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Submissions</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">To Grade</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Avg Score</th>
                <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFDACB] text-[#2B2B28]">
              {assignments.map((asg) => (
                <tr key={asg.id} className="hover:bg-[#F7F5EE] transition-colors">
                  <td className="py-3 px-4 font-bold text-[#22355E]">{asg.title}</td>
                  <td className="py-3 px-4 text-[#22355E] font-semibold">{asg.className}</td>
                  <td className="py-3 px-4 text-[#6E6A64]">{new Date(asg.dueDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-mono text-[#2B2B28]">{asg.submitted} / {asg.total}</td>
                  <td className="py-3 px-4">
                    {asg.toGrade > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C99A2E]/15 text-[#8F6A15] border border-[#C99A2E]/30">
                        {asg.toGrade} Urgent
                      </span>
                    ) : (
                      <span className="text-[#5C7A5E] font-semibold">Caught up</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[#22355E]">{asg.avgScore != null ? `${asg.avgScore}%` : '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openEvaluate(asg)}
                      className="px-3 py-1 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-xs font-bold text-white transition-colors shadow-xs"
                    >
                      Evaluate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button onClick={() => setCreateOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-4">Create Assignment</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && <div className="p-2.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-semibold mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Class *</label>
                  <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                    <option value="">Select class</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Due Date *</label>
                  <input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Max Score</label>
                  <input type="number" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-60">
                  {isSubmitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeAssignment && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button onClick={() => setActiveAssignment(null)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-1">{activeAssignment.title}</h3>
            <p className="text-xs text-[#6E6A64] mb-4">Max score: {activeAssignment.maxScore}</p>
            <div className="space-y-2">
              {submissions.length === 0 ? (
                <p className="text-xs text-[#9B9690] text-center py-6">No submissions yet.</p>
              ) : (
                submissions.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl border border-[#DFDACB] bg-[#F7F5EE] space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#22355E]">{s.studentName}</p>
                        <p className="text-[10px] text-[#6E6A64]">{s.studentEmail} · {s.status}</p>
                      </div>
                      {s.content && <p className="text-[10px] text-[#6E6A64] max-w-xs truncate">{s.content}</p>}
                    </div>
                    {(s.status === 'submitted' || s.status === 'late' || s.status === 'graded') && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Score"
                          max={s.maxScore || activeAssignment.maxScore}
                          value={gradeDrafts[s.id]?.score ?? ''}
                          onChange={(e) => setGradeDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], score: e.target.value } }))}
                          className="w-20 bg-white border border-[#DFDACB] rounded-lg px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Feedback (optional)"
                          value={gradeDrafts[s.id]?.feedback ?? ''}
                          onChange={(e) => setGradeDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], feedback: e.target.value } }))}
                          className="flex-1 bg-white border border-[#DFDACB] rounded-lg px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => handleGrade(s.id, s.maxScore || activeAssignment.maxScore)}
                          className="px-3 py-1 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-[11px] font-bold"
                        >
                          {s.status === 'graded' ? 'Update' : 'Grade'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
