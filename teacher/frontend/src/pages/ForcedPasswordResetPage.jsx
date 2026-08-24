import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTeacherAuth } from '../context/TeacherAuthContext';
import { ApiClientError } from '../services/teacherApiService';

/**
 * Shown whenever the signed-in teacher's session has mustChangePassword set
 * — an admin-provisioned temporary password. TeacherProtectedRoute redirects
 * here from every other route until this succeeds; the backend enforces the
 * same rule independently (teacher/backend's middleware/auth.js), so this
 * page is the UX for a real server-side gate, not the gate itself.
 */
export default function ForcedPasswordResetPage() {
  const { user, changePassword, logout } = useTeacherAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a new password different from the temporary one.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B101B] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#131B2E] border border-[#243354] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-[#C99A2E]/15 border border-[#C99A2E]/40 flex items-center justify-center text-[#C99A2E]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#EDEAE0]">Set a New Password</h1>
            <p className="text-xs text-[#9B9690] mt-0.5">
              {user?.name ? `Welcome, ${user.name}. ` : ''}
              Your temporary password must be changed before you can continue.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-[#C1352B]/15 border border-[#C1352B]/40 text-xs text-[#D95248] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#9B9690] mb-1">Temporary Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[#0B101B] border border-[#243354] rounded-lg px-3 py-2 text-xs text-[#EDEAE0] focus:outline-none focus:border-[#C99A2E]"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9B9690] mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#0B101B] border border-[#243354] rounded-lg px-3 py-2 text-xs text-[#EDEAE0] focus:outline-none focus:border-[#C99A2E]"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9B9690] mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0B101B] border border-[#243354] rounded-lg px-3 py-2 text-xs text-[#EDEAE0] focus:outline-none focus:border-[#C99A2E]"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[#AB5236] hover:bg-[#94452C] disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'Updating…' : 'Set New Password'}</span>
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full py-2 text-[11px] text-[#9B9690] hover:text-[#EDEAE0] transition-colors"
          >
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
