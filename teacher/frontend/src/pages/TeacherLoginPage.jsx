import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  BookOpen,
  ExternalLink,
  Moon,
} from 'lucide-react';
import CuteLamp from '../components/CuteLamp';
import { useTeacherAuth } from '../context/TeacherAuthContext';
import { ADMIN_PORTAL_URL, STUDENT_PORTAL_URL } from '../services/teacherApiService';

const TEACHER_LAMP_STATES = [
  {
    lamp: 'OFF',
    name: 'Stealth Sleep',
    themeColor: '#2a2c30',
    themeGlowRGB: '42, 44, 48',
    shadeColor: '#2c2c2c',
    bulbColor: '#1a1a1a',
    lightOpacity: 0,
    btnBg: '#2a2c30',
    btnText: '#94a3b8',
    faceAwakeOpacity: 0,
    faceSleepOpacity: 1,
  },
  {
    lamp: 'ON',
    name: 'Crystal Cyan',
    themeColor: '#06b6d4',
    themeGlowRGB: '6, 182, 212',
    shadeColor: '#0e7490',
    bulbColor: '#cffafe',
    lightOpacity: 0.18,
    btnBg: '#0891b2',
    btnText: '#ffffff',
    faceAwakeOpacity: 1,
    faceSleepOpacity: 0,
  },
  {
    lamp: 'OFF',
    name: 'Sleep Mode',
    themeColor: '#2a2c30',
    themeGlowRGB: '42, 44, 48',
    shadeColor: '#2c2c2c',
    bulbColor: '#1a1a1a',
    lightOpacity: 0,
    btnBg: '#2a2c30',
    btnText: '#94a3b8',
    faceAwakeOpacity: 0,
    faceSleepOpacity: 1,
  },
  {
    lamp: 'ON',
    name: 'Warm Amber',
    themeColor: '#f59e0b',
    themeGlowRGB: '245, 158, 11',
    shadeColor: '#b45309',
    bulbColor: '#fef3c7',
    lightOpacity: 0.18,
    btnBg: '#d97706',
    btnText: '#ffffff',
    faceAwakeOpacity: 1,
    faceSleepOpacity: 0,
  },
  {
    lamp: 'OFF',
    name: 'Sleep Mode',
    themeColor: '#2a2c30',
    themeGlowRGB: '42, 44, 48',
    shadeColor: '#2c2c2c',
    bulbColor: '#1a1a1a',
    lightOpacity: 0,
    btnBg: '#2a2c30',
    btnText: '#94a3b8',
    faceAwakeOpacity: 0,
    faceSleepOpacity: 1,
  },
  {
    lamp: 'ON',
    name: 'Mentor Emerald',
    themeColor: '#10b981',
    themeGlowRGB: '16, 185, 129',
    shadeColor: '#047857',
    bulbColor: '#d1fae5',
    lightOpacity: 0.18,
    btnBg: '#059669',
    btnText: '#ffffff',
    faceAwakeOpacity: 1,
    faceSleepOpacity: 0,
  },
  {
    lamp: 'OFF',
    name: 'Sleep Mode',
    themeColor: '#2a2c30',
    themeGlowRGB: '42, 44, 48',
    shadeColor: '#2c2c2c',
    bulbColor: '#1a1a1a',
    lightOpacity: 0,
    btnBg: '#2a2c30',
    btnText: '#94a3b8',
    faceAwakeOpacity: 0,
    faceSleepOpacity: 1,
  },
  {
    lamp: 'ON',
    name: 'Academic Violet',
    themeColor: '#8b5cf6',
    themeGlowRGB: '139, 92, 246',
    shadeColor: '#6d28d9',
    bulbColor: '#ede9fe',
    lightOpacity: 0.18,
    btnBg: '#7c3aed',
    btnText: '#ffffff',
    faceAwakeOpacity: 1,
    faceSleepOpacity: 0,
  },
  {
    lamp: 'OFF',
    name: 'Sleep Mode',
    themeColor: '#2a2c30',
    themeGlowRGB: '42, 44, 48',
    shadeColor: '#2c2c2c',
    bulbColor: '#1a1a1a',
    lightOpacity: 0,
    btnBg: '#2a2c30',
    btnText: '#94a3b8',
    faceAwakeOpacity: 0,
    faceSleepOpacity: 1,
  },
  {
    lamp: 'ON',
    name: 'Sunset Coral',
    themeColor: '#f97316',
    themeGlowRGB: '249, 115, 22',
    shadeColor: '#c2410c',
    bulbColor: '#ffedd5',
    lightOpacity: 0.18,
    btnBg: '#ea580c',
    btnText: '#ffffff',
    faceAwakeOpacity: 1,
    faceSleepOpacity: 0,
  },
];

export default function TeacherLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useTeacherAuth();

  // Default to index 1 (ON) so form is visible on initial load
  const [stateIndex, setStateIndex] = useState(1);
  const [isPulling, setIsPulling] = useState(false);
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('nalanda_teacher_remembered_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const currentTheme = TEACHER_LAMP_STATES[stateIndex];
  const isOn = currentTheme.lamp === 'ON';

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleToggleLamp = () => {
    setIsPulling(true);
    setTimeout(() => setIsPulling(false), 180);
    setStateIndex((prev) => (prev + 1) % TEACHER_LAMP_STATES.length);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please provide both faculty email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await login({ email, password, rememberMe });
      if (result.success) {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setErrorMsg(result.error || 'Authentication failed. Please check credentials.');
      }
    } catch {
      setErrorMsg('An unexpected error occurred during sign in. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#070b11] text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 relative overflow-hidden selection:bg-cyan-500 selection:text-slate-950"
      style={{
        '--theme-color': currentTheme.themeColor,
        '--theme-glow-rgb': currentTheme.themeGlowRGB,
      }}
    >
      {/* Background Decorative Radial Gradient Mesh */}
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 30% 40%, rgba(${currentTheme.themeGlowRGB}, ${
            isOn ? '0.14' : '0.02'
          }) 0%, transparent 80%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(8, 51, 68, 0.3) 0%, transparent 70%)`,
        }}
      />

      {/* Top Header / Portal Brand */}
      <header className="w-full max-w-6xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl p-1.5 flex items-center justify-center font-bold text-white shadow-lg transition-all duration-500 bg-slate-900 border border-slate-700"
            style={{
              borderColor: isOn ? currentTheme.themeColor : '#334155',
              boxShadow: isOn ? `0 0 20px rgba(${currentTheme.themeGlowRGB}, 0.5)` : 'none',
            }}
          >
            <img src="/favicon.svg" alt="Nalanda Logo" className="w-full h-full object-contain filter brightness-125" />
          </div>
          <div>
            <div className="font-bold text-base tracking-wider text-slate-100 flex items-center gap-2">
              NALANDA <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-semibold uppercase tracking-widest">Faculty Portal</span>
            </div>
            <div className="text-xs text-slate-400">Educator Suite • Course Management & Live Lectures</div>
          </div>
        </div>
      </header>

      {/* Main Interactive Stage Container */}
      <main className="w-full max-w-6xl my-auto py-6 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Interactive Cute Lamp */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center order-2 lg:order-1">
            <CuteLamp
              currentTheme={currentTheme}
              isOn={isOn}
              onToggleLamp={handleToggleLamp}
              isPulling={isPulling}
            />
          </div>

          {/* Right Column: Dynamic Login Form Stage */}
          <div className="lg:col-span-6 flex justify-center order-1 lg:order-2">
            {isOn ? (
              /* Light is ON: Login Form is VISIBLE */
              <div
                className="w-full max-w-md bg-slate-900/75 backdrop-blur-2xl p-7 sm:p-9 rounded-2xl border-2 transition-all duration-500 ease-out shadow-2xl relative animate-in fade-in zoom-in-95 duration-500"
                style={{
                  borderColor: currentTheme.themeColor,
                  boxShadow: `0 0 35px rgba(${currentTheme.themeGlowRGB}, 0.2), inset 0 0 20px rgba(${currentTheme.themeGlowRGB}, 0.05)`,
                }}
              >
                {/* Card Header */}
                <div className="text-center mb-6">
                  <div
                    className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-colors duration-500"
                    style={{
                      backgroundColor: `rgba(${currentTheme.themeGlowRGB}, 0.15)`,
                      border: `1px solid ${currentTheme.themeColor}`,
                    }}
                  >
                    <BookOpen
                      className="w-6 h-6 transition-colors duration-500"
                      style={{ color: currentTheme.themeColor }}
                    />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                    Faculty Sign In
                  </h1>
                  <p className="text-xs text-slate-400">
                    Access your classroom dashboard, student grading & curriculum tools
                  </p>
                </div>

                {/* Error Alert */}
                {errorMsg && (
                  <div className="mb-5 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email / Username Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Faculty Email / Educator ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rajesh@nalanda.edu"
                        className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all duration-300"
                        onFocus={(e) => {
                          e.target.style.borderColor = currentTheme.themeColor;
                          e.target.style.boxShadow = `0 0 12px rgba(${currentTheme.themeGlowRGB}, 0.3)`;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#334155';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Faculty Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setForgotModalOpen(true)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all duration-300"
                        onFocus={(e) => {
                          e.target.style.borderColor = currentTheme.themeColor;
                          e.target.style.boxShadow = `0 0 12px rgba(${currentTheme.themeGlowRGB}, 0.3)`;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#334155';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900"
                      />
                      <span className="text-xs text-slate-300">Remember on this workstation</span>
                    </label>
                  </div>

                  {/* Submit Button with Dynamic Theme Styling */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-400 flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99] mt-2"
                    style={{
                      backgroundColor: currentTheme.btnBg,
                      color: currentTheme.btnText,
                      boxShadow: `0 4px 20px rgba(${currentTheme.themeGlowRGB}, 0.35)`,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Opening Faculty Suite...</span>
                      </>
                    ) : (
                      <>
                        <span>Enter Faculty Portal</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Ecosystem Portal Switchers */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Other Nalanda Portals:</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={ADMIN_PORTAL_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 font-medium transition-colors"
                    >
                      <span>Admin</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-slate-700">•</span>
                    <a
                      href={STUDENT_PORTAL_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-medium transition-colors"
                    >
                      <span>Student</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              /* Light is OFF: Login Form is INVISIBLE, sleeping guidance shown */
              <div
                onClick={handleToggleLamp}
                className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl p-8 sm:p-10 rounded-2xl border border-slate-800/80 text-center cursor-pointer hover:border-slate-700 transition-all duration-500 flex flex-col items-center justify-center min-h-[380px] shadow-xl group animate-in fade-in zoom-in-95 duration-500"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:border-cyan-500/50 transition-all duration-300 shadow-inner">
                  <Moon className="w-7 h-7 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                </div>
                <h2 className="text-xl font-semibold text-slate-200 mb-2">
                  Faculty Lamp is Switched Off
                </h2>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  The faculty workspace is dormant. Pull the string on the cute lamp to switch ON the light and reveal the login form.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 py-3 border-t border-slate-800/60 z-10">
        <div>© 2026 Nalanda Educational Nexus. Faculty & Academic Portal.</div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-cyan-400">
            <GraduationCap className="w-3.5 h-3.5" /> Verified Educator Clearance
          </span>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-cyan-400" />
              Faculty Credential Recovery
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              To reset your institutional faculty password, contact your Admin — they can issue a new set of login credentials from the Teacher Management console.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
