import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, ShieldCheck, ArrowUpRight, Plus, X } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../../services/teacherApiService';
import { socketService } from '../../services/socketService';

const TYPE_OPTIONS = ['ANNOUNCEMENT', 'CLASS_UPDATE', 'EVENT', 'CONVOCATION', 'ACADEMIC', 'URGENT'];

/**
 * Real announcements only — merges the teacher's own published circulars
 * with real Admin broadcasts (GET /announcements + GET /announcements/admin,
 * the same endpoints AnnouncementsPage already uses), sorted by recency.
 * Refetches on the same socket events that page listens for, so a new
 * Admin announcement shows up here live without a manual reload.
 *
 * Also lets a teacher publish a new announcement directly from the
 * Dashboard — the same createAnnouncement + publishAnnouncement calls
 * AnnouncementsPage uses, which already bridge to real enrolled students
 * (studentBridge.service.js) and, as of this pass, real Admin notification
 * (adminBridge.service.js#pushAnnouncementActivity) — nothing new to wire
 * on this page beyond surfacing the same, already-real flow here too.
 */
export default function RecentAnnouncements() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [classes, setClasses] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'ANNOUNCEMENT', priority: 'normal', audience: 'all_my_classes', classes: [] });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRecent = useCallback(async () => {
    try {
      setError(null);
      const [mine, admin] = await Promise.all([
        teacherApiService.getAnnouncements({ limit: 5 }),
        teacherApiService.getAdminAnnouncements({ limit: 5 }),
      ]);
      const mineShaped = (mine?.data || []).map((a) => ({
        id: `mine-${a.id}`,
        title: a.title,
        body: a.description || a.content,
        priority: a.priority,
        source: 'mine',
        sourceLabel: 'You',
        at: a.publishedAt || a.createdAt,
      }));
      const adminShaped = (admin?.data || []).map((a) => ({
        id: `admin-${a.id}`,
        title: a.title,
        body: a.content,
        priority: a.priority,
        source: 'admin',
        sourceLabel: a.authorName || 'Administration',
        at: a.publishedAt || a.createdAt,
      }));
      const merged = [...mineShaped, ...adminShaped]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 5);
      setItems(merged);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load announcements.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
    teacherApiService.getClasses().then(setClasses).catch(() => {});
  }, [fetchRecent]);

  useEffect(() => {
    const events = ['announcement:published', 'announcement:updated', 'announcement:deleted', 'announcement:expired', 'announcement:admin', 'announcement:admin_removed'];
    const unbinds = events.map((ev) => socketService.on(ev, fetchRecent));
    return () => unbinds.forEach((u) => u());
  }, [fetchRecent]);

  const timeAgo = useMemo(() => (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, []);

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
      fetchRecent();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="dashboard-announcements-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[#22355E]" />
          <h3 id="dashboard-announcements-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
            Recent Announcements
          </h3>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="text-xs font-bold text-white bg-[#AB5236] hover:bg-[#94452C] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button
            type="button"
            onClick={() => navigate('/announcements')}
            className="text-xs font-bold text-[#AB5236] hover:text-[#94452C] flex items-center gap-1"
          >
            View All <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-[#9B9690]">Loading…</div>
      ) : error ? (
        <div className="py-6 text-center text-xs text-[#C1352B]">{error}</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-xs text-[#9B9690]">No announcements yet — circulars you publish and broadcasts from Admin will appear here.</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate('/announcements')}
              className="p-3.5 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] hover:border-[#22355E] cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.source === 'admin' && <ShieldCheck className="w-3.5 h-3.5 text-[#5C7A5E] flex-shrink-0" />}
                    <h4 className="text-xs font-bold text-[#22355E] truncate">{item.title}</h4>
                  </div>
                  <p className="text-[11px] text-[#6E6A64] mt-0.5 line-clamp-2">{item.body}</p>
                  <span className="text-[10px] text-[#9B9690] mt-1 block">
                    {item.source === 'admin' ? `From ${item.sourceLabel}` : 'Your circular'} · {timeAgo(item.at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setCreateOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-1">New Announcement</h3>
            <p className="text-[11px] text-[#9B9690] mb-4">Publishes instantly to your students, and notifies Admin.</p>
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
    </section>
  );
}
