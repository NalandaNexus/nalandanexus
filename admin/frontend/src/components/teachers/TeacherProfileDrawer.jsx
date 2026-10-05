import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  RotateCcw,
  Ban,
  CheckCircle2,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function TeacherProfileDrawer({
  teacher,
  isOpen,
  onClose,
  onSuspend,
  onReactivate,
  onResetPassword,
  onResendInvite,
  onResendCredentials,
  onUpdateWebsiteProfile,
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'security'
  // Held per teacher, so opening another drawer shows their values rather than
  // whatever was typed for the last one.
  const [websiteDraft, setWebsiteDraftState] = useState(null);
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);
  const setWebsiteDraft = (id, fields) => setWebsiteDraftState({ id, fields });

  if (!isOpen || !teacher) return null;

  const websiteProfile =
    websiteDraft?.id === teacher.id
      ? websiteDraft.fields
      : {
          showOnWebsite: Boolean(teacher.showOnWebsite),
          websiteRole: teacher.websiteRole || '',
          websiteCategory: teacher.websiteCategory || '',
          expertise: (teacher.expertise || []).join('\n'),
          experienceNote: teacher.experienceNote || '',
        };

  const isInvited = teacher.status === 'INVITED';
  const isSuspended = teacher.status === 'SUSPENDED';
  const isActive = teacher.status === 'ACTIVE';

  const getInitials = (name) => {
    if (!name) return 'TC';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex justify-end">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border-l border-[#DFDACB] w-full max-w-xl h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#EDEAE0] bg-[#F7F5EE] relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#22355E] text-white flex items-center justify-center font-bold text-lg shadow-md flex-shrink-0">
              {getInitials(teacher.name)}
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-[#22355E] truncate">{teacher.name}</h2>
                <StatusBadge status={teacher.status} size="xs" />
              </div>
              <p className="text-xs text-[#9B9690] truncate">{teacher.email}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-[#2B2B28]">
                <span className="font-mono bg-[#EDEAE0] px-2 py-0.5 rounded text-[11px] text-[#22355E] font-bold">
                  {teacher.teacherId}
                </span>
                <span>•</span>
                <span className="text-[#9B9690] truncate">{teacher.department || 'No department'}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#DFDACB]/80 text-center">
            <div className="bg-white p-2 rounded-xl border border-[#DFDACB]">
              <div className="text-[10px] text-[#9B9690] uppercase font-semibold">Students</div>
              <div className="text-sm font-bold font-mono text-[#22355E]">{teacher.studentsCount || 0}</div>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#DFDACB]">
              <div className="text-[10px] text-[#9B9690] uppercase font-semibold">Courses</div>
              <div className="text-sm font-bold font-mono text-[#22355E]">{teacher.coursesCount || 0}</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#EDEAE0] bg-white">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'security', label: 'Security & Auth' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-[#22355E] text-[#22355E]'
                  : 'border-transparent text-[#9B9690] hover:text-[#2B2B28]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              <div className="bg-[#F7F5EE] p-4 rounded-xl border border-[#DFDACB] space-y-2.5">
                <h4 className="font-bold text-[#22355E] text-xs uppercase tracking-wider">Faculty Information</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#9B9690] block text-[11px]">Primary Subject</span>
                    <strong className="text-[#2B2B28]">{teacher.subject || 'Not assigned'}</strong>
                  </div>
                  <div>
                    <span className="text-[#9B9690] block text-[11px]">Qualification</span>
                    <strong className="text-[#2B2B28]">{teacher.qualification || 'Not on file'}</strong>
                  </div>
                  <div>
                    <span className="text-[#9B9690] block text-[11px]">Contact Phone</span>
                    <strong className="text-[#2B2B28]">{teacher.phone || 'Not on file'}</strong>
                  </div>
                  <div>
                    <span className="text-[#9B9690] block text-[11px]">Last Active</span>
                    <strong className="text-[#2B2B28] font-mono">
                      {teacher.lastActive ? new Date(teacher.lastActive).toLocaleString() : 'Never'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#9B9690] block text-[11px]">Faculty Rating</span>
                    <strong className="text-[#2B2B28] font-mono">
                      {teacher.rating ? `${teacher.rating.toFixed(1)} / 5` : 'Not yet rated'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#9B9690] block text-[11px]">Account Created</span>
                    <strong className="text-[#2B2B28] font-mono">
                      {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString() : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* What the public About page shows. Saving publishes it to the
                  student portal, or withdraws it when switched off. */}
              <div className="bg-[#F7F5EE] p-4 rounded-xl border border-[#DFDACB] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-[#22355E] text-xs uppercase tracking-wider">Student Website Profile</h4>
                  {teacher.facultySyncStatus === 'failed' && (
                    <span className="text-[10px] font-bold text-[#C1352B] bg-[#C1352B]/10 px-2 py-0.5 rounded-full">
                      Not published yet
                    </span>
                  )}
                  {teacher.facultySyncStatus === 'synced' && teacher.showOnWebsite && (
                    <span className="text-[10px] font-bold text-[#5C7A5E] bg-[#5C7A5E]/10 px-2 py-0.5 rounded-full">Published</span>
                  )}
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    id="drawer-show-on-website"
                    checked={websiteProfile.showOnWebsite}
                    onChange={(e) => setWebsiteDraft(teacher.id, { ...websiteProfile, showOnWebsite: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-[#DFDACB] text-[#22355E] focus:ring-[#22355E]"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-[#2B2B28]">Show in the Nalanda Nexus Network</span>
                    <span className="block text-[11px] text-[#9B9690]">
                      Email, phone and account details are never published. A suspended teacher is withdrawn automatically.
                    </span>
                  </span>
                </label>

                {websiteProfile.showOnWebsite && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="drawer-website-role" className="block text-[11px] font-semibold text-[#2B2B28] mb-1">
                          Public Role
                        </label>
                        <input
                          id="drawer-website-role"
                          type="text"
                          placeholder="e.g. Cyber Specialist"
                          value={websiteProfile.websiteRole}
                          onChange={(e) => setWebsiteDraft(teacher.id, { ...websiteProfile, websiteRole: e.target.value })}
                          className="w-full bg-white border border-[#DFDACB] rounded-lg px-3 py-1.5 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                        />
                      </div>
                      <div>
                        <label htmlFor="drawer-website-category" className="block text-[11px] font-semibold text-[#2B2B28] mb-1">
                          Website Tab
                        </label>
                        <input
                          id="drawer-website-category"
                          type="text"
                          placeholder="e.g. Cyber Security"
                          value={websiteProfile.websiteCategory}
                          onChange={(e) => setWebsiteDraft(teacher.id, { ...websiteProfile, websiteCategory: e.target.value })}
                          className="w-full bg-white border border-[#DFDACB] rounded-lg px-3 py-1.5 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="drawer-expertise" className="block text-[11px] font-semibold text-[#2B2B28] mb-1">
                        Expertise <span className="font-normal text-[#9B9690]">(one per line)</span>
                      </label>
                      <textarea
                        id="drawer-expertise"
                        rows={3}
                        value={websiteProfile.expertise}
                        onChange={(e) => setWebsiteDraft(teacher.id, { ...websiteProfile, expertise: e.target.value })}
                        className="w-full bg-white border border-[#DFDACB] rounded-lg px-3 py-1.5 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                      />
                    </div>
                    <div>
                      <label htmlFor="drawer-experience" className="block text-[11px] font-semibold text-[#2B2B28] mb-1">
                        Experience
                      </label>
                      <input
                        id="drawer-experience"
                        type="text"
                        value={websiteProfile.experienceNote}
                        onChange={(e) => setWebsiteDraft(teacher.id, { ...websiteProfile, experienceNote: e.target.value })}
                        className="w-full bg-white border border-[#DFDACB] rounded-lg px-3 py-1.5 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSavingWebsite}
                  onClick={async () => {
                    setIsSavingWebsite(true);
                    try {
                      await onUpdateWebsiteProfile(teacher, {
                        showOnWebsite: websiteProfile.showOnWebsite,
                        websiteRole: websiteProfile.websiteRole,
                        websiteCategory: websiteProfile.websiteCategory,
                        expertise: websiteProfile.expertise
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                        experienceNote: websiteProfile.experienceNote,
                      });
                    } finally {
                      setIsSavingWebsite(false);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#22355E] hover:bg-[#1A2A4A] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                >
                  {isSavingWebsite ? 'Saving…' : 'Save website profile'}
                </button>
              </div>

              {teacher.suspensionReason && (
                <div className="p-3 bg-[#C1352B]/10 border border-[#C1352B]/30 rounded-xl text-[#C1352B]">
                  <strong>Suspension Note:</strong> {teacher.suspensionReason}
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#22355E]">Account Status:</span>
                  <span className="font-mono text-[#22355E] font-bold">{teacher.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#22355E]">Auth Mechanism:</span>
                  <span className="text-[#9B9690]">bcrypt + temporary-password provisioning</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#22355E]">Last Active:</span>
                  <span className="font-mono text-[#22355E]">
                    {teacher.lastActive ? new Date(teacher.lastActive).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/logs')}
                className="w-full py-2 px-3 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] text-[#22355E] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>View full audit trail for this account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onResetPassword(teacher)}
                  className="w-full py-2 px-3 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] text-[#22355E] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Issue Password Reset Authorization</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Action Bar */}
        <div className="p-4 bg-[#F7F5EE] border-t border-[#EDEAE0] flex flex-wrap items-center justify-between gap-2">
          {isInvited && (
            <button
              type="button"
              onClick={() => onResendInvite(teacher)}
              className="px-3 py-1.5 rounded-xl bg-[#22355E] text-white hover:bg-[#1A2A4A] text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resend Invitation</span>
            </button>
          )}
          {isActive && (
            <button
              type="button"
              onClick={() => onResendCredentials(teacher)}
              className="px-3 py-1.5 rounded-xl bg-[#22355E] text-white hover:bg-[#1A2A4A] text-xs font-semibold transition-colors flex items-center gap-1.5"
              title="Issues a brand-new temporary password and emails it — invalidates the current one"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resend Credentials</span>
            </button>
          )}

          {isActive && (
            <button
              type="button"
              onClick={() => onSuspend(teacher)}
              className="px-3 py-1.5 rounded-xl bg-[#C1352B]/10 hover:bg-[#C1352B] text-[#C1352B] hover:text-white border border-[#C1352B]/30 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspend Account</span>
            </button>
          )}

          {isSuspended && (
            <button
              type="button"
              onClick={() => onReactivate(teacher)}
              className="px-3 py-1.5 rounded-xl bg-[#5C7A5E] hover:bg-[#4A644C] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Reactivate Account</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] text-xs font-medium text-[#2B2B28]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
