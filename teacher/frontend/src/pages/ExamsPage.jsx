import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, CheckCircle2 } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';

const STATUS_STYLE = {
  draft: 'text-[#9B9690]',
  scheduled: 'text-[#C99A2E]',
  active: 'text-[#5C7A5E]',
  completed: 'text-[#22355E]',
};

export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', classId: '', type: 'quiz', durationMinutes: 30, scheduledAt: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [manageExam, setManageExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qDraft, setQDraft] = useState({ question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });

  const fetchExams = useCallback(async () => {
    try {
      setError(null);
      const data = await teacherApiService.getExams();
      setExams(data || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load exams.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
    teacherApiService.getClasses().then(setClasses).catch(() => {});
  }, [fetchExams]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.classId) {
      setFormError('Title and class are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await teacherApiService.createExam({ ...form, durationMinutes: Number(form.durationMinutes), scheduledAt: form.scheduledAt || undefined });
      setCreateOpen(false);
      setForm({ title: '', classId: '', type: 'quiz', durationMinutes: 30, scheduledAt: '' });
      fetchExams();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openManage = (exam) => {
    setManageExam(exam);
    setQuestions(exam.questions || []);
  };

  const addQuestion = () => {
    if (!qDraft.question.trim() || qDraft.options.some((o) => !o.trim())) return;
    setQuestions((prev) => [...prev, { ...qDraft }]);
    setQDraft({ question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });
  };

  const saveQuestions = async (activate) => {
    try {
      const updated = await teacherApiService.updateExam(manageExam.id, {
        questions,
        totalQuestions: questions.length,
        status: activate ? 'active' : undefined,
      });
      setManageExam(null);
      fetchExams();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Failed to save questions.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Exams & Quizzes Builder</h1>
          <p className="text-xs text-[#6E6A64] mt-1">Author real assessments — activating one delivers it to enrolled students instantly.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-[#AB5236] hover:bg-[#94452C] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-cta"
        >
          <Plus className="w-4 h-4" /> Create New Assessment
        </button>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">Loading…</div>
      ) : exams.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">No assessments created yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {exams.map((ex) => (
            <div key={ex.id} className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EDEAE0] text-[#22355E] border border-[#DFDACB]">
                  {ex.className}
                </span>
                <h3 className="text-base font-bold text-[#22355E] mt-2">{ex.title}</h3>
                <div className="flex items-center gap-3 text-xs text-[#6E6A64] mt-2">
                  <span>{ex.questions?.length || 0} Questions</span>
                  <span>•</span>
                  <span>{ex.durationMinutes} mins</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[#DFDACB] flex items-center justify-between">
                <span className={`text-[11px] font-semibold capitalize ${STATUS_STYLE[ex.status] || ''}`}>{ex.status}</span>
                <button onClick={() => openManage(ex)} className="px-3 py-1 rounded-xl bg-[#22355E] hover:bg-[#16233F] text-xs font-bold text-white shadow-xs">
                  {ex.status === 'active' ? 'View' : 'Configure'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button onClick={() => setCreateOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-4">Create Assessment</h3>
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
                  <label className="block text-xs font-semibold mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                    <option value="quiz">Quiz</option>
                    <option value="test">Test</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Duration (mins)</label>
                  <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Scheduled At</label>
                  <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-60">
                  {isSubmitting ? 'Creating…' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manageExam && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button onClick={() => setManageExam(null)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-1">{manageExam.title}</h3>
            <p className="text-xs text-[#6E6A64] mb-4">{questions.length} question(s) added. Correct answers are never shown to students before submission.</p>

            <div className="space-y-2 mb-4">
              {questions.map((q, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] text-xs">
                  <p className="font-bold text-[#22355E]">{i + 1}. {q.question}</p>
                  <p className="text-[10px] text-[#5C7A5E] mt-0.5">Correct: {q.options[q.correctIndex]}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl border border-dashed border-[#DFDACB] space-y-2">
              <input placeholder="Question text" value={qDraft.question} onChange={(e) => setQDraft({ ...qDraft, question: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-1.5 text-xs" />
              {qDraft.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={qDraft.correctIndex === i}
                    onChange={() => setQDraft({ ...qDraft, correctIndex: i })}
                  />
                  <input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => setQDraft({ ...qDraft, options: qDraft.options.map((o, idx) => (idx === i ? e.target.value : o)) })}
                    className="flex-1 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-1.5 text-xs"
                  />
                </div>
              ))}
              <button type="button" onClick={addQuestion} className="w-full py-1.5 rounded-xl bg-[#22355E] hover:bg-[#16233F] text-white text-xs font-bold">Add Question</button>
            </div>

            <div className="pt-4 mt-4 border-t border-[#DFDACB] flex justify-end gap-2">
              <button onClick={() => saveQuestions(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Save Draft</button>
              <button onClick={() => saveQuestions(true)} disabled={!questions.length} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-60">
                <CheckCircle2 className="w-3.5 h-3.5" /> Activate & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
