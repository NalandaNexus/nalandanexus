import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Megaphone, ShieldCheck } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

const TYPE_OPTIONS = ['ANNOUNCEMENT', 'CLASS_UPDATE', 'EVENT', 'CONVOCATION', 'ACADEMIC', 'URGENT'];

export default function AnnouncementsPage() {
  const [tab, setTab] = useState('mine');
  const [announcements, setAnnouncements] = useState([]);
  const [adminAnnouncements, setAdminAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'ANNOUNCEMENT', priority: 'normal', audience: 'all_my_classes', classes: [] });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [mine, admin] = await Promise.all([teacherApiService.getAnnouncements(), teacherApiService.getAdminAnnouncements()]);
      setAnnouncements(mine?.data || []);
      setAdminAnnouncements(admin?.data || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load announcements.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    teacherApiService.getClasses().then(setClasses).catch(() => {});
  }, [fetchAll]);

  useEffect(() => {
    socketService.connect();
    const unbinds = ['announcement:published', 'announcement:updated', 'announcement:deleted', 'announcement:expired', 'announcement:admin', 'announcement:admin_removed'].map((ev) =>
      socketService.on(ev, fetchAll)
    );
    return () => unbinds.forEach((u) => u());
  }, [fetchAll]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('Title and description are required.');
      return;
    }
    if (form.audience === 'classes' && form.classes.length === 0) {
      setFormError('Select at least one class.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      const created = await teacherApiService.createAnnouncement(form);
      await teacherApiService.publishAnnouncement(created.id);
      setCreateOpen(false);
      setForm({ title: '', description: '', type: 'ANNOUNCEMENT', priority: 'normal', audience: 'all_my_classes', classes: [] });
      fetchAll();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const list = tab === 'mine' ? announcements : adminAnnouncements;
  const filtered = list.filter((a) => a.title?.toLowerCase().includes(search.toLowerCase()) || (a.description || a.content || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Announcements</h1>
          <p className="text-xs text-[#6E6A64] mt-1">Publish circulars to your classes, and view institution-wide broadcasts from Admin.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-[#AB5236] hover:bg-[#94452C] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-cta"
        >
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      <div className="flex items-center gap-2 bg-[#F7F5EE] p-1 rounded-xl border border-[#DFDACB] w-fit">
        <button onClick={() => setTab('mine')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${tab === 'mine' ? 'bg-white text-[#22355E] shadow-xs' : 'text-[#6E6A64]'}`}>
          <Megaphone className="w-3.5 h-3.5" /> My Announcements ({announcements.length})
        </button>
        <button onClick={() => setTab('admin')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${tab === 'admin' ? 'bg-white text-[#22355E] shadow-xs' : 'text-[#6E6A64]'}`}>
          <ShieldCheck className="w-3.5 h-3.5" /> From Admin ({adminAnnouncements.length})
        </button>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">
          {tab === 'mine' ? 'No announcements published yet.' : 'No announcements from Admin yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((ann) => (
            <div key={ann.id} className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EDEAE0] text-[#22355E] border border-[#DFDACB]">
                  {ann.type || ann.priority}
                </span>
                <span className="text-[10px] text-[#6E6A64]">{new Date(ann.publishedAt || ann.createdAt).toLocaleString()}</span>
              </div>
              <h3 className="text-sm font-bold text-[#22355E]">{ann.title}</h3>
              <p className="text-xs text-[#6E6A64]">{ann.description || ann.content}</p>
              <div className="pt-3 border-t border-[#DFDACB] flex items-center justify-between text-xs text-[#6E6A64]">
                {tab === 'mine' ? (
                  <>
                    <span>Audience: <strong className="text-[#22355E]">{ann.audience === 'all_my_classes' ? 'All my classes' : `${ann.classIds?.length || 0} class(es)`}</strong></span>
                    <span className="text-[#5C7A5E] font-bold capitalize">{ann.status}</span>
                  </>
                ) : (
                  <span>From: <strong className="text-[#22355E]">{ann.authorName || 'Administration'}</strong></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setCreateOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-4">New Announcement</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && <div className="p-2.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-semibold mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Audience</label>
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value, classes: [] })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                  <option value="all_my_classes">All my classes</option>
                  <option value="classes">Specific classes</option>
                </select>
              </div>
              {form.audience === 'classes' && (
                <div className="flex flex-wrap gap-1.5">
                  {classes.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          classes: f.classes.includes(c.id) ? f.classes.filter((id) => id !== c.id) : [...f.classes, c.id],
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        form.classes.includes(c.id) ? 'bg-[#22355E] text-white border-[#22355E]' : 'bg-white text-[#6E6A64] border-[#DFDACB]'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-[#9B9690]">You may only target classes you teach — students in other teachers' classes will not receive this.</p>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-60">
                  {isSubmitting ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
