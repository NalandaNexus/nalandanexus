import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { adminApi, TEACHER_PORTAL_URL } from '../services/adminApi';

export default function TeacherActivationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [verificationState, setVerificationState] = useState('CHECKING'); // 'CHECKING' | 'VALID' | 'EXPIRED' | 'ALREADY_USED' | 'INVALID' | 'SUSPENDED'
  const [teacherData, setTeacherData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Password setup state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerificationState('INVALID');
      setErrorMessage('No invitation token was detected in the URL. Please click the exact link from your email.');
      return;
    }

    const verify = async () => {
      try {
        setVerificationState('CHECKING');
        const res = await adminApi.verifyInviteToken(token);
        if (res.valid) {
          setVerificationState('VALID');
          setTeacherData(res.teacher);
        } else {
          if (res.error === 'INVITE_EXPIRED') setVerificationState('EXPIRED');
          else if (res.error === 'INVITE_ALREADY_USED') setVerificationState('ALREADY_USED');
          else setVerificationState('INVALID');
          setErrorMessage(res.message || 'Invitation token verification failed.');
        }
      } catch (err) {
        setVerificationState('INVALID');
        setErrorMessage(err.message || 'Network error verifying invitation.');
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await adminApi.activateTeacherAccount({
        token,
        password,
      });

      if (res.success) {
        setActivationSuccess(true);
      } else {
        setErrorMessage(res.message || 'Failed to activate account.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to activate account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEAE0] text-[#2B2B28] flex flex-col justify-between items-center p-4 sm:p-6 md:p-8">
      {/* Brand Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2 border-b border-[#DFDACB]/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22355E] p-1.5 flex items-center justify-center shadow-md">
            <img src="/favicon.svg" alt="Nalanda Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-base tracking-wider text-[#22355E]">NALANDA NEXUS</div>
            <div className="text-xs text-[#9B9690]">Faculty Account Onboarding Portal</div>
          </div>
        </div>
        <div className="text-xs font-mono font-semibold text-[#5C7A5E] bg-white border border-[#DFDACB] px-3 py-1.5 rounded-xl shadow-sm">
          TLS 1.3 / AES-256 Verified
        </div>
      </header>

      {/* Main Activation Card */}
      <main className="w-full max-w-md my-auto py-8">
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-7 sm:p-8 shadow-card space-y-6">
          {/* 1. Checking state */}
          {verificationState === 'CHECKING' && (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#22355E] border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-sm font-bold text-[#22355E]">Verifying Cryptographic Invitation...</h3>
              <p className="text-xs text-[#9B9690]">Validating token hash and single-use status against database.</p>
            </div>
          )}

          {/* 2. Success State */}
          {activationSuccess && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-2xl bg-[#5C7A5E]/15 border border-[#5C7A5E]/30 text-[#5C7A5E] flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#22355E]">Account Activated Successfully!</h2>
              <p className="text-xs text-[#2B2B28] leading-relaxed">
                Your password has been securely hashed and stored. Your invitation token has been permanently invalidated.
              </p>
              <div className="p-3.5 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl text-xs space-y-1 text-left">
                <p className="text-[#2B2B28]"><strong>Account:</strong> {teacherData?.email}</p>
                <p className="text-[#2B2B28]"><strong>Status:</strong> <span className="text-[#5C7A5E] font-bold">ACTIVE</span></p>
              </div>
              <div className="pt-2">
                <a
                  href={TEACHER_PORTAL_URL}
                  className="w-full py-3 px-4 rounded-xl bg-[#AB5236] hover:bg-[#8F3E26] text-white font-semibold text-xs transition-all shadow-cta flex items-center justify-center gap-2 inline-flex"
                >
                  <span>Log Into Faculty Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* 3. Valid State -> Create Password Form */}
          {verificationState === 'VALID' && !activationSuccess && (
            <div className="space-y-5">
              <div className="text-center border-b border-[#EDEAE0] pb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#22355E]/10 border border-[#22355E]/30 text-[#22355E] flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold text-[#22355E]">Set Up Faculty Password</h1>
                <p className="text-xs text-[#9B9690] mt-1">
                  Welcome, <strong className="text-[#22355E]">{teacherData?.name}</strong>. Create a secure password to activate your account.
                </p>
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="p-3 bg-[#C1352B]/10 border border-[#C1352B]/30 rounded-xl text-[#C1352B] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">
                    Official Email
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={teacherData?.email || ''}
                    className="w-full bg-[#EDEAE0] border border-[#DFDACB] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#22355E] select-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">
                    Create New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9690] hover:text-[#2B2B28]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2.5 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                  />
                </div>

                {/* Primary CTA: brick-terracotta */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-[#AB5236] hover:bg-[#8F3E26] text-white text-xs font-semibold transition-all shadow-cta flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Activating Faculty Account...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Activate Account & Proceed</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* 4. Expired State */}
          {verificationState === 'EXPIRED' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-[#C99A2E]/15 border border-[#C99A2E]/30 text-[#C99A2E] flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#22355E]">This invitation has expired</h3>
              <p className="text-xs text-[#2B2B28] leading-relaxed">
                Nalanda Nexus invitation tokens expire 24 hours after issuance to protect platform security.
              </p>
              <div className="p-3 bg-[#F7F5EE] rounded-xl border border-[#DFDACB] text-xs text-[#9B9690]">
                Please contact your institution administrator (admin@nalanda.edu) to request a new invitation token.
              </div>
            </div>
          )}

          {/* 5. Already Used State */}
          {verificationState === 'ALREADY_USED' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-[#5C7A5E]/15 border border-[#5C7A5E]/30 text-[#5C7A5E] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#22355E]">This invitation has already been used</h3>
              <p className="text-xs text-[#2B2B28] leading-relaxed">
                Your account is already active. You can log into the Faculty Portal directly.
              </p>
              <div className="pt-2">
                <a
                  href={TEACHER_PORTAL_URL}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white font-semibold text-xs transition-colors inline-flex items-center justify-center gap-2"
                >
                  <span>Go to Faculty Login</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* 6. Invalid / Suspended State */}
          {(verificationState === 'INVALID' || verificationState === 'SUSPENDED') && (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-[#C1352B]/15 border border-[#C1352B]/30 text-[#C1352B] flex items-center justify-center mx-auto">
                <Ban className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#22355E]">
                {verificationState === 'SUSPENDED' ? 'Account Suspended' : 'Invalid Invitation Link'}
              </h3>
              <p className="text-xs text-[#2B2B28] leading-relaxed">{errorMessage}</p>
              <div className="p-3 bg-[#F7F5EE] rounded-xl border border-[#DFDACB] text-xs text-[#9B9690]">
                If you believe this is an error, please reach out to institutional support.
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center text-xs text-[#9B9690] py-4 border-t border-[#DFDACB]/80">
        © {new Date().getFullYear()} Nalanda Nexus Educational Platform. All rights reserved.
      </footer>
    </div>
  );
}
