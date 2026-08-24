import React, { useState } from 'react';
import { X, UserPlus, CheckCircle2, ShieldAlert, Mail } from 'lucide-react';
import { adminApi } from '../../services/adminApi';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Department of Physics',
  'Department of Mathematics',
  'Department of Chemistry',
  'Electrical & Electronics',
  'Mechanical Engineering',
  'Civil Engineering',
  'Artificial Intelligence & ML',
  'Humanities & Social Sciences',
];

export default function CreateTeacherModal({ isOpen, onClose, onTeacherCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Computer Science & Engineering',
    subject: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [warnings, setWarnings] = useState([]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setErrorMsg('Full Name and Official Email are required fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await adminApi.createTeacher(formData);
      if (response.success) {
        setSuccessResult(response.data);
        setWarnings(response.meta?.warnings || []);
        onTeacherCreated?.(response.data, response.meta?.warnings || []);
      } else {
        setErrorMsg(response.message || 'Failed to create teacher account.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error occurred while provisioning teacher.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessResult(null);
    setWarnings([]);
    setErrorMsg('');
    setFormData({ name: '', email: '', phone: '', department: 'Computer Science & Engineering', subject: '' });
    onClose();
  };

  const WARNING_COPY = {
    PORTAL_PROVISIONING_FAILED: 'Teacher Portal account could not be provisioned — this teacher cannot log in yet. Retry from the teacher\'s profile once the Teacher Portal service is reachable.',
    EMAIL_DELIVERY_FAILED: 'Credentials email could not be delivered — share the temporary password below with the teacher securely.',
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border border-[#DFDACB] rounded-2xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetAndClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {successResult ? (
          /* Success State View */
          <div className="space-y-4 py-2">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-sm border ${
                warnings.length
                  ? 'bg-[#C99A2E]/15 border-[#C99A2E]/30 text-[#C99A2E]'
                  : 'bg-[#5C7A5E]/15 border-[#5C7A5E]/30 text-[#5C7A5E]'
              }`}
            >
              {warnings.length ? <ShieldAlert className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#22355E]">
                {warnings.length ? 'Teacher Created — Needs Attention' : 'Teacher Account Created Successfully'}
              </h3>
              <p className="text-xs text-[#2B2B28] mt-1 leading-relaxed">
                A Teacher Portal login with a temporary password was provisioned for{' '}
                <strong className="font-semibold text-[#22355E]">{successResult.email}</strong>.
              </p>
            </div>

            {warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-[#C99A2E]/10 border border-[#C99A2E]/30 space-y-1.5">
                {warnings.map((code) => (
                  <p key={code} className="text-xs text-[#8a6512] leading-relaxed">
                    ⚠ {WARNING_COPY[code] || code}
                  </p>
                ))}
              </div>
            )}

            {successResult.tempPasswordFallback && (
              <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] space-y-1">
                <span className="text-[11px] text-[#9B9690] font-semibold">Temporary password (share securely — not emailed)</span>
                <div className="font-mono text-sm font-bold text-[#22355E]">{successResult.tempPasswordFallback}</div>
              </div>
            )}

            <div className="p-4 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#2B2B28]">
                <span>Teacher ID:</span>
                <span className="font-mono font-bold text-[#22355E]">{successResult.teacherId}</span>
              </div>
              <div className="flex items-center justify-between text-[#2B2B28]">
                <span>Teacher Portal access:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold border ${
                    successResult.portalProvisioned
                      ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30'
                      : 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30'
                  }`}
                >
                  {successResult.portalProvisioned ? 'PROVISIONED' : 'NOT PROVISIONED'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#2B2B28]">
                <span>Credentials email:</span>
                <span className="font-mono text-[#9B9690]">{successResult.emailDeliveryStatus || 'unknown'}</span>
              </div>
              <div className="flex items-center justify-between text-[#2B2B28]">
                <span>First login:</span>
                <span className="font-mono text-[#9B9690]">Forces a password reset</span>
              </div>
            </div>

            <p className="text-[11px] text-[#9B9690] leading-relaxed">
              The teacher must set a new password the first time they sign in — the temporary one above stops
              working immediately afterward.
            </p>

            <div className="pt-3 border-t border-[#EDEAE0] flex justify-end">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form Input View */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#AB5236]/10 border border-[#AB5236]/30 flex items-center justify-center text-[#AB5236]">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#22355E]">Provision Faculty Account</h3>
                <p className="text-xs text-[#9B9690]">
                  Create a Teacher Portal login with a temporary password, emailed securely
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">
                  Full Name <span className="text-[#C1352B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Vikram Sarabhai"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                />
              </div>

              {/* Official Email */}
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">
                  Official Email <span className="text-[#C1352B]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="teacher@nalanda.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98450 12345"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Primary Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures & Algorithms"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
                />
              </div>

            </div>
            <p className="text-[11px] text-[#9B9690]">A Teacher ID is auto-assigned on creation.</p>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#EDEAE0] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-[#2B2B28] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              {/* Primary CTA: brick-terracotta */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#AB5236] hover:bg-[#8F3E26] text-white text-xs font-semibold transition-all shadow-cta flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Provisioning Account...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Create & Send Credentials</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
