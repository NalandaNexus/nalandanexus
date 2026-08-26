import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Check, Save, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';
import { studentApiService } from '../../services/studentApiService';
import { resolveAssetUrl } from '../../services/apiClient';

export default function SettingsPage() {
  const { user } = useAuth();
  const { student, refreshData } = useStudent();

  const [name, setName] = useState(student?.name || user?.name || '');
  // Email is the account identifier and isn't editable here - there is no
  // change-email flow (would require re-verification) in this build.
  const email = student?.email || user?.email || '';
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    setAvatarError('');
    try {
      await studentApiService.uploadAvatar(file);
      refreshData();
    } catch (err) {
      setAvatarError(err.message || 'Could not upload your photo. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await studentApiService.updateProfile({ name });
      refreshData();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[#22355E]">
            Account & Learning Settings
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Manage your personal profile, notifications, and testing preferences.
          </p>
        </div>

        {/* Profile Form */}
        <div className="p-6 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-[#DFDACB] pb-3">
            <User className="w-4 h-4 text-[#22355E]" />
            <h2 className="font-heading font-bold text-sm text-[#22355E]">Student Profile Information</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {student?.avatar ? (
                <img src={resolveAssetUrl(student.avatar)} alt="" className="w-16 h-16 rounded-full object-cover border border-[#DFDACB]" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#22355E] text-white flex items-center justify-center font-bold text-lg">
                  {(name || 'S').slice(0, 1).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Change profile photo"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#AB5236] hover:bg-[#92422a] text-white flex items-center justify-center shadow-xs disabled:opacity-60"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarChange} className="hidden" />
            </div>
            <div>
              <p className="text-xs font-heading font-bold text-[#22355E]">Profile Photo</p>
              <p className="text-[11px] text-[#2B2B28]/60 mt-0.5">{isUploadingAvatar ? 'Uploading…' : 'PNG, JPEG, WEBP or GIF, up to 2MB.'}</p>
              {avatarError && <p className="text-[11px] font-semibold text-[#AB5236] mt-1">{avatarError}</p>}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-heading font-bold text-[#22355E] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#DFDACB] rounded-xl text-xs text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-[#22355E] mb-1">
                  Registered Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  title="Email cannot be changed here."
                  className="w-full p-2.5 bg-[#EDEAE0] border border-[#DFDACB] rounded-xl text-xs text-[#2B2B28]/70 cursor-not-allowed"
                />
              </div>
            </div>

            {error && <p className="text-xs font-semibold text-[#AB5236]">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#2B2B28]/60">
                Student ID: <strong className="font-mono">{student?.id || '—'}</strong>
              </span>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-[#22355E] hover:bg-[#1a2949] text-white text-xs font-heading font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? 'Saving…' : isSaved ? 'Changes Saved!' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
