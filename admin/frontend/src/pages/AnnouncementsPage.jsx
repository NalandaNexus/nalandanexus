import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, CheckCircle2, AlertTriangle, Send, GraduationCap } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

export default function AnnouncementsPage() {
  const [tab, setTab] = useState('mine');
  const [announcements, setAnnouncements] = useState([]);
  const [teacherAnnouncements, setTeacherAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'MEDIUM',
    audience: 'ALL',
  });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const [loadError, setLoadError] = useState('');

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [mine, fromTeachers] = await Promise.all([
        adminApi.getAnnouncements({ limit: 50 }),
        adminApi.getTeacherAnnouncements({ limit: 50 }),
      ]);
      setAnnouncements(mine);
      setTeacherAnnouncements(fromTeachers);
    } catch (err) {
      setLoadError(err.message || 'Failed to load announcements.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useRealtimeEvents(['announcement.created', 'notification.created'], fetchAnnouncements);

  const list = tab === 'mine' ? announcements : teacherAnnouncements;

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createAnnouncement(formData);
      showToast('Announcement broadcasted successfully across platform portals!');
      setCreateModalOpen(false);
      setFormData({ title: '', content: '', priority: 'MEDIUM', audience: 'ALL' });
      fetchAnnouncements();
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#22355E] text-white border border-[#22355E] shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#5C7A5E]" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Campus Broadcast Announcements</h1>
          <p className="text-xs text-[#9B9690] mt-1">
            Publish institutional notices, examination directives, and term schedules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Broadcast</span>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-[#F7F5EE] p-1 rounded-xl border border-[#DFDACB] w-fit">
        <button
          onClick={() => setTab('mine')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${tab === 'mine' ? 'bg-white text-[#22355E] shadow-xs' : 'text-[#9B9690]'}`}
        >
          <Bell className="w-3.5 h-3.5" /> My Broadcasts ({announcements.length})
        </button>
        <button
          onClick={() => setTab('teachers')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${tab === 'teachers' ? 'bg-white text-[#22355E] shadow-xs' : 'text-[#9B9690]'}`}
        >
          <GraduationCap className="w-3.5 h-3.5" /> From Teachers ({teacherAnnouncements.length})
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#9B9690] space-y-2">
          <div className="w-6 h-6 border-2 border-[#22355E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading announcements...</p>
        </div>
      ) : loadError ? (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-8 text-center space-y-3">
          <AlertTriangle className="w-6 h-6 text-[#AB5236] mx-auto" />
          <p className="text-xs text-[#2B2B28]">{loadError}</p>
          <button
            type="button"
            onClick={fetchAnnouncements}
            className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-8">
          <EmptyState
            title={tab === 'mine' ? 'No announcements yet' : 'No announcements from teachers yet'}
            description={tab === 'mine' ? 'Broadcasts you publish will appear here.' : 'Announcements teachers publish to their classes will appear here.'}
          />
        </div>
      ) : (
      <div className="space-y-3">
        {list.map((anc) => (
          <div key={anc.id} className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    anc.priority === 'HIGH'
                      ? 'bg-[#AB5236]/15 text-[#AB5236] border border-[#AB5236]/30'
                      : 'bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/30'
                  }`}
                >
                  {anc.priority}
                </span>
                <h3 className="text-sm font-bold text-[#22355E]">{anc.title}</h3>
              </div>
              <span className="text-[11px] font-mono text-[#9B9690]">{new Date(anc.publishedAt).toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#2B2B28] leading-relaxed">{anc.content}</p>
            <div className="pt-2 border-t border-[#EDEAE0] flex items-center justify-between text-[11px] text-[#9B9690]">
              {tab === 'mine' ? (
                <>
                  <span>Author: <strong className="text-[#22355E]">{anc.author?.name || 'Admin'}</strong></span>
                  <span>Audience: <strong className="text-[#22355E]">{anc.audience}</strong></span>
                </>
              ) : (
                <>
                  <span>Teacher: <strong className="text-[#22355E]">{anc.teacherName || 'Faculty'}</strong></span>
                  <span>Class: <strong className="text-[#22355E]">{anc.className || '—'}</strong></span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#22355E]">Compose Broadcast</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End-Term Schedule Released"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Message Content</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detailed announcement directive..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Normal</option>
                    <option value="HIGH">High Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Audience</label>
                  <select
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28]"
                  >
                    <option value="TEACHERS">All Faculty</option>
                    <option value="STUDENTS">All Students</option>
                    <option value="ALL">Entire Campus</option>
                  </select>
                </div>
              </div>
              <div className="pt-3 border-t border-[#EDEAE0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDEAE0] text-xs font-semibold text-[#2B2B28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
