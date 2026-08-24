import React, { useState, useEffect } from 'react';
import { User, Save, CheckCircle2, Bell } from 'lucide-react';
import { useTeacherAuth } from '../context/TeacherAuthContext';
import ProBadge from '../components/common/ProBadge';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';

export default function SettingsPage() {
  const { user, refreshUser } = useTeacherAuth();
  const [form, setForm] = useState({ name: '', title: '', department: '', subject: '' });
  const [preferences, setPreferences] = useState({ emailNotifications: true, pushNotifications: true, weeklyDigest: true });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', title: user.title || '', department: user.department || '', subject: user.subject || '' });
      if (user.preferences) setPreferences(user.preferences);
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await teacherApiService.updateProfile(form);
      await teacherApiService.updatePreferences(preferences);
      refreshUser?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Faculty Profile & Settings</h1>
          {user?.isPro && <ProBadge size="sm" />}
        </div>
        <p className="text-xs text-[#6E6A64] mt-1">Manage your profile and notification preferences.</p>
      </div>

      {saved && (
        <div className="p-3 rounded-xl bg-[#5C7A5E]/15 border border-[#5C7A5E]/30 text-xs text-[#5C7A5E] font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Preferences saved successfully.
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-xs text-[#C1352B]">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
          <h3 className="text-sm font-bold text-[#22355E] flex items-center gap-2">
            <User className="w-4 h-4 text-[#22355E]" /> Educator Profile
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#22355E] block mb-1">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#22355E] block mb-1">Title / Designation</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#22355E] block mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#22355E] block mb-1">Primary Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
              />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-3">
          <h3 className="text-sm font-bold text-[#22355E] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#22355E]" /> Notification Preferences
          </h3>
          {[
            { key: 'emailNotifications', label: 'Email notifications' },
            { key: 'pushNotifications', label: 'Push notifications' },
            { key: 'weeklyDigest', label: 'Weekly summary digest' },
          ].map((pref) => (
            <label key={pref.key} className="flex items-center justify-between text-xs text-[#2B2B28] py-1">
              {pref.label}
              <input
                type="checkbox"
                checked={preferences[pref.key] ?? true}
                onChange={(e) => setPreferences({ ...preferences, [pref.key]: e.target.checked })}
                className="w-4 h-4"
              />
            </label>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-cta disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}
