import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import CharacterStage from '../components/CharacterStage';
import AuthCard from '../components/AuthCard';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import ToastContainer from '../components/ToastContainer';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import {
  initAudio,
  playSuccessChime,
  playErrorBuzzer,
  playTone,
} from '../utils/sound';

export default function AuthPage({ initialMode = 'login' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, signup, resendVerification, loginWithGoogle, isAuthenticated } = useAuth();
  
  // If already authenticated, redirect immediately to student dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/student/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  // Set mode based on path: /signup -> 'signup', /login -> 'login'
  const isSignupPath = location.pathname === '/signup';
  const [mode, setMode] = useState(isSignupPath ? 'signup' : initialMode);
  const [focusState, setFocusState] = useState('idle');
  const [mousePos, setMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [caretRatio, setCaretRatio] = useState(0.2);
  const [speechText, setSpeechText] = useState(
    isSignupPath ? 'New student? Welcome to Nalanda! 🎓' : 'Welcome back to Nalanda Nexus! 🎓'
  );
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  // Set after a successful registration - login is refused until the
  // student verifies their email, so there's no session to route into a
  // dashboard with; this renders a "check your email" panel instead.
  const [verificationPending, setVerificationPending] = useState(null); // { email, fallbackUrl } | null
  // Set when login is refused specifically for EMAIL_NOT_VERIFIED, so the
  // form can offer a one-click resend instead of just a generic error toast.
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  // Sync mode with route changes
  useEffect(() => {
    if (location.pathname === '/signup') {
      setMode('signup');
      setSpeechText('New student? Welcome! 🎓');
    } else if (location.pathname === '/login') {
      setMode('login');
      setSpeechText('Welcome back to Nalanda! 📚');
    }
  }, [location.pathname]);

  // Global Mouse Movement Listener for Character Eye Tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Toast System
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    // A success toast clears any errors still on screen from earlier attempts.
    // Without this, fixing a validation problem left the old complaint stacked
    // directly above "Account created…", so the screen contradicted itself at
    // the exact moment the user needed a clear answer.
    setToasts((prev) => (type === 'success' ? [] : prev).concat({ id, message, type }));

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Mode Switch
  const handleSwitchMode = (newMode) => {
    initAudio();
    playTone(440, 'sine', 0.06, 0.04);
    setMode(newMode);
    setFocusState('idle');
    if (newMode === 'signup') {
      setSpeechText('New student? Welcome! 🎓');
      navigate('/signup');
    } else {
      setSpeechText('Welcome back to Nalanda! 📚');
      navigate('/login');
    }
  };

  // Character Click Dialogue
  const handleCharacterClick = (charName) => {
    initAudio();
    playTone(580, 'sine', 0.08, 0.05);
    const dialogues = {
      purple: ['I keep things organized! 📚', 'Ready for class? 🎓', 'Nalanda Nexus rocks! 🌟'],
      pink: ['Welcome back! 💕', 'Need study help? ✨', 'You got this! 🚀'],
      orange: ['Boing! 🍊', 'I am super squishy! 😊', 'Learning is fun! 📖'],
      yellow: ['Hello there! 👋', 'Have a great day! ☀️', 'Knowledge is power! 💡'],
    };
    const pool = dialogues[charName] || ['Hello from Nalanda Nexus! 🎓'];
    const msg = pool[Math.floor(Math.random() * pool.length)];
    setSpeechText(msg);
  };

  // Trigger Confetti Celebration
  const triggerConfetti = () => {
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7C3AED', '#EC4899', '#F97316', '#FACC15', '#1E40AF', '#10B981'],
    });
  };

  // Login Submit Handler - real backend authentication (JWT + httpOnly refresh cookie).
  const handleLoginSubmit = async ({ isValid, email, password, rememberMe }) => {
    if (!isValid) {
      playErrorBuzzer();
      setFocusState('confused');
      setSpeechText('Oops! Please check again 🤔');
      addToast('Please correct the highlighted errors', 'error');
      setTimeout(() => setFocusState('idle'), 2000);
      return;
    }

    setIsLoading(true);
    setUnverifiedEmail(null);
    try {
      await login({ email, password });
      if (rememberMe) {
        localStorage.setItem('nalanda_remembered_email', email);
      } else {
        localStorage.removeItem('nalanda_remembered_email');
      }
      playSuccessChime();
      setFocusState('celebrating');
      setSpeechText('Welcome aboard! 🚀✨');
      triggerConfetti();
      addToast(`Welcome back, ${email.split('@')[0]}! Logged in successfully.`, 'success');
      setTimeout(() => {
        setFocusState('idle');
        navigate('/student/dashboard');
      }, 1200);
    } catch (err) {
      playErrorBuzzer();
      setFocusState('confused');
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email);
        setSpeechText('Almost there — verify your email first 📧');
        addToast('Please verify your email before logging in.', 'error');
      } else {
        setSpeechText('Hmm, that did not work 🤔');
        addToast(err.message || 'Login failed. Please check your credentials.', 'error');
      }
      setTimeout(() => setFocusState('idle'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // Signup Submit Handler - real backend registration.
  const handleSignupSubmit = async ({ isValid, name, email, password }) => {
    if (!isValid) {
      playErrorBuzzer();
      setFocusState('confused');
      setSpeechText('Please check your registration fields 🤔');
      addToast('Please check the required registration fields', 'error');
      setTimeout(() => setFocusState('idle'), 2000);
      return;
    }

    setIsLoading(true);
    try {
      const result = await signup({ name, email, password });
      playSuccessChime();
      setFocusState('celebrating');
      setSpeechText('Check your email to verify! 📧');
      triggerConfetti();
      addToast(`Account created for ${name}! Check your email to verify.`, 'success');
      // No session was issued (login is refused until verified) - show the
      // "check your email" panel instead of navigating to the dashboard.
      setVerificationPending({ email, fallbackUrl: result?.verificationUrlFallback || null });
      setTimeout(() => setFocusState('idle'), 1200);
    } catch (err) {
      playErrorBuzzer();
      setFocusState('confused');
      setSpeechText('Something needs fixing 🤔');
      addToast(err.message || 'Registration failed. Please try again.', 'error');
      setTimeout(() => setFocusState('idle'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback when VITE_GOOGLE_CLIENT_ID isn't configured - be honest instead
  // of faking a successful login (master doc section 63: no fake success).
  const handleGoogleAuth = () => {
    initAudio();
    playTone(320, 'sine', 0.08, 0.05);
    addToast('Google sign-in is not configured on this deployment. Please use email + password.', 'info');
  };

  // Google Identity Services handed us a verified ID token - the backend
  // independently re-verifies it against Google before creating a session.
  const handleGoogleCredential = async (idToken) => {
    setIsLoading(true);
    try {
      const googleUser = await loginWithGoogle(idToken);
      playSuccessChime();
      setFocusState('celebrating');
      setSpeechText('Welcome aboard! 🚀✨');
      triggerConfetti();
      addToast(`Welcome, ${googleUser.name?.split(' ')[0] || 'there'}! Signed in with Google.`, 'success');
      setTimeout(() => {
        setFocusState('idle');
        navigate('/student/dashboard');
      }, 1200);
    } catch (err) {
      playErrorBuzzer();
      setFocusState('confused');
      setSpeechText('Hmm, that did not work 🤔');
      addToast(err.message || 'Google sign-in failed. Please try again.', 'error');
      setTimeout(() => setFocusState('idle'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Reset Handler - real backend request.
  const handleSendResetLink = async (email) => {
    setIsLoading(true);
    try {
      const message = await authService.forgotPassword(email);
      setIsForgotModalOpen(false);
      playSuccessChime();
      setSpeechText('Reset link on the way! 📧');
      addToast(message || `If an account exists for ${email}, a reset link has been sent.`, 'success');
    } catch (err) {
      addToast(err.message || 'Could not send reset link. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async (email) => {
    setIsLoading(true);
    try {
      const message = await resendVerification(email);
      addToast(message || 'If an unverified account exists for that email, a new link has been sent.', 'success');
    } catch (err) {
      addToast(err.message || 'Could not resend the verification email. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-24 sm:px-6 md:px-8">
      {/* Return to Home link */}
      <Link
        to="/"
        className="absolute top-24 left-6 sm:left-12 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors z-20"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Landing Page</span>
      </Link>

      {/* Main Split-Screen Container Card */}
      <main className="relative z-10 w-full max-w-[960px] min-h-[580px] md:min-h-[640px] bg-white dark:bg-slate-900 rounded-card shadow-card dark:shadow-card-dark border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 overflow-hidden transition-all duration-300">
        
        {/* LEFT PANEL: 2.5D Animated Characters Stage */}
        <section className="w-full h-full">
          <CharacterStage
            focusState={focusState}
            mousePosition={mousePos}
            caretRatio={caretRatio}
            onCharacterClick={handleCharacterClick}
            speechText={speechText}
          />
        </section>

        {/* RIGHT PANEL: Auth Form Container */}
        <section className="w-full h-full">
          {verificationPending ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-4xl">📧</div>
              <h2 className="font-heading font-bold text-xl text-slate-900 dark:text-white">Check your email</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
                We sent a verification link to <strong>{verificationPending.email}</strong>. Click it to activate your account and log in.
              </p>
              {verificationPending.fallbackUrl && (
                <div className="w-full max-w-xs p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-left">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    Email delivery isn't configured in this environment — use this link directly instead:
                  </p>
                  <a
                    href={verificationPending.fallbackUrl}
                    className="text-[11px] text-cyan-700 dark:text-cyan-400 underline break-all"
                  >
                    {verificationPending.fallbackUrl}
                  </a>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleResendVerification(verificationPending.email)}
                disabled={isLoading}
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-60"
              >
                Didn't get it? Resend verification email
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerificationPending(null);
                  setMode('login');
                  navigate('/login');
                }}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:underline"
              >
                Back to log in
              </button>
            </div>
          ) : (
            <>
              {unverifiedEmail && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-800 dark:text-amber-300">Please verify your email to log in.</span>
                  <button
                    type="button"
                    onClick={() => handleResendVerification(unverifiedEmail)}
                    disabled={isLoading}
                    className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap disabled:opacity-60"
                  >
                    Resend link
                  </button>
                </div>
              )}
              <AuthCard
                mode={mode}
                onSwitchMode={handleSwitchMode}
                onFocusField={(field) => setFocusState(field)}
                onCaretChange={(ratio) => setCaretRatio(ratio)}
                onPasswordPeek={(isPeeking) =>
                  setFocusState(isPeeking ? 'password-peek' : 'password-hidden')
                }
                onSubmitLogin={handleLoginSubmit}
                onSubmitSignup={handleSignupSubmit}
                onGoogleAuth={handleGoogleAuth}
                onGoogleCredential={handleGoogleCredential}
                onForgotPasswordClick={() => setIsForgotModalOpen(true)}
                isLoading={isLoading}
              />
            </>
          )}
        </section>
      </main>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onSendReset={handleSendResetLink}
        isLoading={isLoading}
      />

      {/* Notification Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
