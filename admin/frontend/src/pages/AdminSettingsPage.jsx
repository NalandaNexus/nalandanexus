import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Key, Bell, Info, CheckCircle2, Lock } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminSettingsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'security';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [toastMsg, setToastMsg] = useState(null);
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user, hasRole } = useAdminAuth();
  const canManageSettings = hasRole('SUPER_ADMIN') || hasRole('ADMIN');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadSettings = () => {
    setIsLoading(true);
    adminApi
      .getSettings()
      .then(setSettings)
      .catch((err) => showToast(err.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev, [path[0]]: { ...prev[path[0]] } };
      next[path[0]][path[1]] = value;
      return next;
    });
  };

  const handleSave = async (patch) => {
    try {
      setIsSaving(true);
      const updated = await adminApi.updateSettings(patch);
      setSettings(updated);
      showToast('Settings saved successfully');
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-8 h-8 border-3 border-[#22355E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#22355E] text-white border border-[#22355E] shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#5C7A5E]" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="border-b border-[#DFDACB]/80 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Institutional Platform Settings</h1>
        <p className="text-xs text-[#9B9690] mt-1">
          Configure security policies, invitation lifecycles, and view software release specifications.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DFDACB] pb-2">
        {[
          { id: 'security', label: 'Security & Access Policies', icon: Shield },
          { id: 'invitations', label: 'Invitation Parameters', icon: Key },
          { id: 'about', label: 'About & Release Specs', icon: Info },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#22355E] text-white shadow-sm'
                  : 'text-[#9B9690] hover:text-[#22355E] hover:bg-[#F7F5EE]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-6 shadow-card space-y-5 max-w-3xl">
          <h3 className="text-sm font-bold text-[#22355E] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#22355E]" />
            <span>Master Institutional Access Guardrails</span>
          </h3>

          {!canManageSettings && (
            <p className="text-[11px] text-[#9B9690]">Your role ({user?.role}) has read-only access to these settings.</p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
              <div>
                <p className="text-xs font-bold text-[#22355E]">Strict Admin Provisioning for Faculty</p>
                <p className="text-[11px] text-[#9B9690] mt-0.5">
                  Disable self-registration for teachers. Accounts can only be provisioned by authorized admins.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.security.strictAdminProvisioning}
                disabled={!canManageSettings}
                onChange={(e) => {
                  const value = e.target.checked;
                  updateField(['security', 'strictAdminProvisioning'], value);
                  handleSave({ security: { strictAdminProvisioning: value } });
                }}
                className="w-4 h-4 accent-[#22355E] rounded cursor-pointer disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
              <div>
                <p className="text-xs font-bold text-[#22355E]">SHA-256 Token Hash Enforcement</p>
                <p className="text-[11px] text-[#9B9690] mt-0.5">
                  Raw invitation and password reset tokens are never stored in the database. Only one-way hashes are verified.
                </p>
              </div>
              <input type="checkbox" checked disabled className="w-4 h-4 accent-[#22355E] rounded cursor-not-allowed" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
              <div>
                <p className="text-xs font-bold text-[#22355E]">Bcrypt Work Factor</p>
                <p className="text-[11px] text-[#9B9690] mt-0.5">
                  Salt rounds enforced on all admin and teacher/student credential hashing.
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-[#22355E] bg-white px-2 py-1 rounded border border-[#DFDACB]">
                {settings.security.bcryptWorkFactor}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Invitations */}
      {activeTab === 'invitations' && (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-6 shadow-card space-y-4 max-w-3xl">
          <h3 className="text-sm font-bold text-[#22355E]">Invitation Lifecycle Settings</h3>
          <div className="p-4 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#22355E]">Token TTL:</span>
              {canManageSettings ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={settings.security.invitationExpiryHours}
                    onChange={(e) => updateField(['security', 'invitationExpiryHours'], Number(e.target.value))}
                    onBlur={() => handleSave({ security: { invitationExpiryHours: settings.security.invitationExpiryHours } })}
                    className="w-16 bg-white border border-[#DFDACB] rounded px-2 py-1 text-xs font-mono text-[#22355E]"
                  />
                  <span className="text-[#9B9690]">Hours</span>
                </div>
              ) : (
                <span className="font-mono font-bold text-[#22355E]">{settings.security.invitationExpiryHours} Hours</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#22355E]">Single-Use Invalidation:</span>
              <span className="font-mono text-[#5C7A5E] font-bold">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#22355E]">Email Dispatch Channel:</span>
              <span className={`font-mono ${settings.smtpStatus === 'CONFIGURED' ? 'text-[#5C7A5E]' : settings.smtpStatus === 'INCOMPLETE' ? 'text-[#C99A2E]' : 'text-[#22355E]'}`}>
                {!settings.notifications.emailEnabled
                  ? 'Disabled'
                  : settings.smtpStatus === 'CONFIGURED'
                    ? 'Real SMTP (Gmail) — delivering'
                    : settings.smtpStatus === 'INCOMPLETE'
                      ? 'SMTP host set, SMTP_PASS missing — delivery will fail'
                      : 'Not configured — no SMTP host set'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: About */}
      {activeTab === 'about' && (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-6 shadow-card space-y-5 max-w-3xl">
          <div className="flex items-center gap-3 border-b border-[#EDEAE0] pb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#22355E] p-2 flex items-center justify-center shadow-md">
              <img src="/favicon.svg" alt="Nalanda Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#22355E]">{settings.platformName}</h2>
              <p className="text-xs text-[#9B9690]">Institutional Master Governance & Operations Engine</p>
            </div>
          </div>

          <div className="p-4 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#9B9690]">Software Release:</span>
              <span className="font-mono font-bold text-[#22355E] bg-white px-2 py-0.5 rounded border border-[#DFDACB]">
                Version 2.0.0 (MongoDB-backed)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9B9690]">Architecture:</span>
              <span className="font-mono text-[#22355E]">React 18 + Node/Express + MongoDB + Socket.IO</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9B9690]">Current Academic Session:</span>
              <span className="text-[#22355E] font-mono">{settings.academic.currentAcademicSession}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9B9690]">Support Email:</span>
              <span className="font-mono text-[#22355E]">{settings.supportEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9B9690]">Cluster Ports:</span>
              <span className="font-mono text-[#22355E]">Admin (5175/5003), Faculty (5174/5002), Student (5173/5001)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
