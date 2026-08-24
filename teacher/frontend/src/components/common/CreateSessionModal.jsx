import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../../services/teacherApiService';
import Modal, { FormField, inputClass } from './Modal';

/** Shared by CalendarPage and LiveSchedulePage — both let a teacher add a timetable slot the same way. */
export default function CreateSessionModal({ isOpen, onClose, classes, defaultStartAt, onCreated }) {
  const emptyForm = { classId: '', startAt: defaultStartAt || '', durationMinutes: '45', subject: '', topic: '', room: '', youtubeUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...emptyForm, classId: classes[0]?.id || '', startAt: defaultStartAt || '' });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultStartAt]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await teacherApiService.createSession({
        classId: form.classId,
        startAt: new Date(form.startAt).toISOString(),
        durationMinutes: Number(form.durationMinutes) || 45,
        subject: form.subject.trim() || undefined,
        topic: form.topic.trim() || undefined,
        room: form.room.trim() || undefined,
        youtubeUrl: form.youtubeUrl.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to schedule session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule New Session" icon={Calendar}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-2.5 rounded-lg bg-[#C1352B]/15 border border-[#C1352B]/40 text-xs text-[#D95248]">{error}</div>}

        <FormField label="Class *">
          <select required value={form.classId} onChange={set('classId')} className={inputClass}>
            <option value="" disabled>Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Time *">
            <input required type="datetime-local" value={form.startAt} onChange={set('startAt')} className={inputClass} />
          </FormField>
          <FormField label="Duration (minutes)">
            <input type="number" min="5" max="300" value={form.durationMinutes} onChange={set('durationMinutes')} className={inputClass} />
          </FormField>
        </div>

        <FormField label="Topic">
          <input value={form.topic} onChange={set('topic')} placeholder="e.g. Ray Optics: Reflection basics" className={inputClass} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Subject label (optional)">
            <input value={form.subject} onChange={set('subject')} placeholder="Defaults to the class subject" className={inputClass} />
          </FormField>
          <FormField label="Room">
            <input value={form.room} onChange={set('room')} placeholder="e.g. Lab 3" className={inputClass} />
          </FormField>
        </div>

        <FormField label="YouTube Live URL (optional — visible to enrolled students)">
          <input
            type="url"
            value={form.youtubeUrl}
            onChange={set('youtubeUrl')}
            placeholder="https://youtube.com/watch?v=..."
            className={inputClass}
          />
        </FormField>

        <div className="pt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-[#0B101B] hover:bg-[#182238] text-xs font-semibold text-[#EDEAE0] border border-[#243354] transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#314B82] disabled:opacity-50 text-[#EDEAE0] font-bold text-xs border border-[#314B82] transition-colors"
          >
            {isSubmitting ? 'Scheduling…' : 'Schedule Session'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
