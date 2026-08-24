import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Youtube, RotateCcw, Ban } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

const STATUS_STYLE = {
  upcoming: 'bg-[#EDEAE0] text-[#22355E] border-[#DFDACB]',
  live_now: 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30',
  completed: 'bg-[#9B9690]/15 text-[#6E6A64] border-[#9B9690]/30',
  cancelled: 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30',
};

function weekRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function CalendarPage() {
  const [entries, setEntries] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ classId: '', startAt: '', durationMinutes: 45, topic: '', room: '', youtubeUrl: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ startAt: '', reason: '' });

  const fetchTimetable = useCallback(async () => {
    try {
      setError(null);
      const { from, to } = weekRange();
      const data = await teacherApiService.getTimetable({ from, to });
      setEntries(data || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load timetable.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetable();
    teacherApiService.getClasses().then(setClasses).catch(() => {});
  }, [fetchTimetable]);

  useEffect(() => {
    socketService.connect();
    const unbinds = ['class.rescheduled', 'class.started', 'class.completed', 'class.cancelled', 'class.updated'].map((ev) =>
      socketService.on(ev, fetchTimetable)
    );
    return () => unbinds.forEach((u) => u());
  }, [fetchTimetable]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.classId || !form.startAt) {
      setFormError('Class and start time are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await teacherApiService.createSession({ ...form, durationMinutes: Number(form.durationMinutes), youtubeUrl: form.youtubeUrl || undefined });
      setCreateOpen(false);
      setForm({ classId: '', startAt: '', durationMinutes: 45, topic: '', room: '', youtubeUrl: '' });
      fetchTimetable();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to schedule session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this class session? Enrolled students will be notified.')) return;
    try {
      await teacherApiService.cancelSession(id);
      fetchTimetable();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Failed to cancel session.');
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleForm.startAt) return;
    try {
      await teacherApiService.updateSession(rescheduleTarget.id, { startAt: rescheduleForm.startAt, reason: rescheduleForm.reason || undefined });
      setRescheduleTarget(null);
      setRescheduleForm({ startAt: '', reason: '' });
      fetchTimetable();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Failed to reschedule.');
    }
  };

  const grouped = entries.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Faculty Master Timetable</h1>
          <p className="text-xs text-[#6E6A64] mt-1">Next 7 days of scheduled class sessions — every entry is a real, notifiable class.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-[#22355E] hover:bg-[#16233F] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" /> Schedule Class Session
        </button>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">No classes scheduled in the next 7 days.</div>
      ) : (
        Object.entries(grouped).map(([date, dayEntries]) => (
          <div key={date} className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
            <h3 className="text-sm font-bold text-[#22355E]">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
            <div className="space-y-3">
              {dayEntries.map((sch) => (
                <div key={sch.id} className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-[#22355E] font-mono w-20">{sch.time}</div>
                    <div>
                      <h4 className="text-sm font-bold text-[#22355E] flex items-center gap-1.5">
                        {sch.className}
                        {sch.youtubeUrl && <Youtube className="w-3.5 h-3.5 text-[#C1352B]" />}
                        {sch.wasRescheduled && <span className="text-[9px] font-bold text-[#C99A2E] bg-[#C99A2E]/15 px-1.5 py-0.5 rounded">Rescheduled</span>}
                      </h4>
                      <p className="text-xs text-[#6E6A64]">{sch.topic || 'No topic set'} • {sch.room || 'No room'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase ${STATUS_STYLE[sch.status] || ''}`}>{sch.status.replace('_', ' ')}</span>
                    {sch.status !== 'completed' && sch.status !== 'cancelled' && (
                      <>
                        <button
                          onClick={() => {
                            setRescheduleTarget(sch);
                            setRescheduleForm({ startAt: '', reason: '' });
                          }}
                          title="Reschedule"
                          className="p-1.5 rounded-lg bg-white border border-[#DFDACB] text-[#22355E] hover:bg-[#EDEAE0]"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleCancel(sch.id)} title="Cancel" className="p-1.5 rounded-lg bg-white border border-[#DFDACB] text-[#C1352B] hover:bg-[#C1352B]/10">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button onClick={() => setCreateOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-4">Schedule Class Session</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && <div className="p-2.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-semibold mb-1">Class *</label>
                <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                  <option value="">Select class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Time *</label>
                  <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Duration (mins)</label>
                  <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Topic</label>
                <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Room</label>
                <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">YouTube Live URL (optional — delivered to enrolled students if class is linked to a course)</label>
                <input value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} placeholder="https://youtube.com/..." className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-60">
                  {isSubmitting ? 'Scheduling…' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button onClick={() => setRescheduleTarget(null)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-1">Reschedule</h3>
            <p className="text-xs text-[#6E6A64] mb-4">{rescheduleTarget.className} — currently {rescheduleTarget.time}</p>
            <form onSubmit={handleReschedule} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">New Start Time *</label>
                <input type="datetime-local" value={rescheduleForm.startAt} onChange={(e) => setRescheduleForm({ ...rescheduleForm, startAt: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Reason (optional)</label>
                <input value={rescheduleForm.reason} onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <p className="text-[10px] text-[#9B9690]">Enrolled students will be notified of the new time automatically.</p>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setRescheduleTarget(null)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold">Reschedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
