import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Reads the token from GET /verify-email?token=... (the link emailed by
 * registration/resend) and consumes it against the real backend endpoint -
 * never assumes success from the URL alone. Verifying logs the student in
 * directly (see AuthContext#verifyEmail), matching the backend's own
 * behavior of issuing a session on successful verification.
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [error, setError] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus('error');
      setError('This verification link is missing its token.');
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/student/dashboard', { replace: true }), 1800);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'This verification link is invalid or has expired.');
      });
  }, [token, verifyEmail, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-card dark:shadow-card-dark border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-cyan-500 animate-spin" />
            <h1 className="font-heading font-bold text-lg text-slate-900 dark:text-white">Verifying your email…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <h1 className="font-heading font-bold text-lg text-slate-900 dark:text-white">Email verified!</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">You're logged in — taking you to your dashboard…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 mx-auto text-red-500" />
            <h1 className="font-heading font-bold text-lg text-slate-900 dark:text-white">Verification failed</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
            <Link
              to="/login"
              className="inline-block mt-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl"
            >
              Back to Log In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
