import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Check } from 'lucide-react';
import { playKeyStroke, playTone } from '../utils/sound';
import GoogleSignInButton from './auth/GoogleSignInButton';

export default function AuthCard({
  mode = 'login', // 'login' | 'signup'
  onSwitchMode,
  onFocusField,
  onCaretChange,
  onPasswordPeek,
  onSubmitLogin,
  onSubmitSignup,
  onGoogleAuth,
  onGoogleCredential,
  onForgotPasswordClick,
  isLoading = false,
}) {
  // Login Form States
  const [loginEmail, setLoginEmail] = useState(() => {
    return localStorage.getItem('nalanda_remembered_email') || '';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem('nalanda_remembered_email');
  });

  // Sign Up Form States
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupShowPassword, setSignupShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Field Errors
  const [errors, setErrors] = useState({});

  // Password Strength Calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: 'Must be at least 8 characters', color: 'bg-slate-200 dark:bg-slate-700' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass)) score++;

    switch (score) {
      case 1: return { score: 25, text: 'Weak password', color: 'bg-red-500' };
      case 2: return { score: 50, text: 'Fair password', color: 'bg-amber-500' };
      case 3: return { score: 75, text: 'Good password', color: 'bg-blue-500' };
      case 4: return { score: 100, text: 'Strong password! 🔒', color: 'bg-emerald-500' };
      default: return { score: 15, text: 'Too short', color: 'bg-red-400' };
    }
  };

  const strength = getPasswordStrength(signupPassword);

  const handleInputChange = (setter, fieldName, e) => {
    const val = e.target.value;
    setter(val);
    playKeyStroke(val.length);

    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: '' }));
    }

    if (onCaretChange) {
      const len = val.length;
      const ratio = len > 0 ? (e.target.selectionStart || len) / 30 : 0.2;
      onCaretChange(ratio);
    }
  };

  // Toggle Password Peek Mode
  const toggleLoginPasswordPeek = () => {
    const nextState = !loginShowPassword;
    setLoginShowPassword(nextState);
    playTone(nextState ? 600 : 450, 'sine', 0.05, 0.04);
    if (onPasswordPeek) onPasswordPeek(nextState);
  };

  const toggleSignupPasswordPeek = () => {
    const nextState = !signupShowPassword;
    setSignupShowPassword(nextState);
    playTone(nextState ? 600 : 450, 'sine', 0.05, 0.04);
    if (onPasswordPeek) onPasswordPeek(nextState);
  };

  // Validation & Submit
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!loginEmail.trim()) {
      newErrors.loginEmail = 'Please enter your registered email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      newErrors.loginEmail = 'Please enter a valid email address';
    }

    if (!loginPassword) {
      newErrors.loginPassword = 'Please enter your password';
    } else if (loginPassword.length < 6) {
      newErrors.loginPassword = 'Password must be at least 6 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (onSubmitLogin) onSubmitLogin({ isValid: false });
      return;
    }

    setErrors({});
    if (onSubmitLogin) {
      onSubmitLogin({
        isValid: true,
        email: loginEmail,
        password: loginPassword,
        rememberMe,
      });
    }
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!signupName.trim()) {
      newErrors.signupName = 'Please enter your full name';
    }

    if (!signupEmail.trim()) {
      newErrors.signupEmail = 'Please enter your institute email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) {
      newErrors.signupEmail = 'Please enter a valid email address';
    }

    if (!signupPassword) {
      newErrors.signupPassword = 'Please create a password';
    } else if (signupPassword.length < 8) {
      newErrors.signupPassword = 'Password must be at least 8 characters';
    }

    if (signupPassword !== signupConfirmPassword) {
      newErrors.signupConfirmPassword = 'Passwords do not match';
    }

    if (!agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms & Privacy Policy';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (onSubmitSignup) onSubmitSignup({ isValid: false });
      return;
    }

    setErrors({});
    if (onSubmitSignup) {
      onSubmitSignup({
        isValid: true,
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 md:px-12 md:py-12 bg-white dark:bg-slate-900 transition-colors duration-300">
      
      {/* Branding Header with Nalanda Nexus Seal */}
      <div className="mb-6 text-left">
        <motion.div
          whileHover={{ rotate: 10, scale: 1.05 }}
          className="w-14 h-14 rounded-full mb-3 shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30 overflow-hidden inline-block"
        >
          <img
            src="favicon.svg"
            alt="Nalanda Nexus Educational Institute Seal"
            className="w-full h-full object-cover"
          />
        </motion.div>

        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight leading-tight">
          {mode === 'login' ? 'Welcome back!' : 'Create an account'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {mode === 'login'
            ? 'Please enter your details'
            : 'Join Nalanda Nexus Educational Institute'}
        </p>
      </div>

      {/* Forms Container with Framer Motion Animated Slider */}
      <div className="relative overflow-hidden w-full">
        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            /* ==================== LOGIN FORM ==================== */
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              onSubmit={handleLoginSubmit}
              noValidate
              className="space-y-4"
            >
              {/* Email Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Email
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => handleInputChange(setLoginEmail, 'loginEmail', e)}
                    onFocus={() => onFocusField && onFocusField('email')}
                    onBlur={() => onFocusField && onFocusField('idle')}
                    placeholder="name@nalandanexus.edu"
                    className={`w-full h-11 px-3.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800/80 border ${
                      errors.loginEmail
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/15'
                    } rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  <Mail className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.loginEmail && (
                  <p className="text-xs text-red-500 font-medium mt-1">{errors.loginEmail}</p>
                )}
              </div>

              {/* Password Field with Show/Hide Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={loginShowPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => handleInputChange(setLoginPassword, 'loginPassword', e)}
                    onFocus={() => onFocusField && onFocusField(loginShowPassword ? 'password-peek' : 'password-hidden')}
                    onBlur={() => onFocusField && onFocusField('idle')}
                    placeholder="••••••••••••"
                    className={`w-full h-11 px-3.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800/80 border ${
                      errors.loginPassword
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/15'
                    } rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={toggleLoginPasswordPeek}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    title={loginShowPassword ? 'Hide password' : 'Show password'}
                  >
                    {loginShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.loginPassword && (
                  <p className="text-xs text-red-500 font-medium mt-1">{errors.loginPassword}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="hidden"
                  />
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                      rememberMe
                        ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={onForgotPasswordClick}
                  className="font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-heading font-semibold text-sm rounded-full shadow-lg shadow-slate-900/15 dark:shadow-blue-600/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Log in'
                )}
              </motion.button>

              {/* Google Sign-In */}
              <GoogleSignInButton
                text="signin_with"
                onCredential={onGoogleCredential}
                onUnavailable={() => onGoogleAuth && onGoogleAuth('Login')}
              />

              {/* Bottom Switch Prompt */}
              <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-3">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => onSwitchMode('signup')}
                  className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 underline ml-1 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </motion.form>
          ) : (
            /* ==================== SIGN UP FORM ==================== */
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              onSubmit={handleSignupSubmit}
              noValidate
              className="space-y-3.5"
            >
              {/* Full Name Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => handleInputChange(setSignupName, 'signupName', e)}
                    onFocus={() => onFocusField && onFocusField('name')}
                    onBlur={() => onFocusField && onFocusField('idle')}
                    placeholder="e.g. Adarsh Sharma"
                    className={`w-full h-10 px-3.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800/80 border ${
                      errors.signupName
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/15'
                    } rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  <User className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.signupName && (
                  <p className="text-xs text-red-500 font-medium mt-0.5">{errors.signupName}</p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Institute Email
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => handleInputChange(setSignupEmail, 'signupEmail', e)}
                    onFocus={() => onFocusField && onFocusField('email')}
                    onBlur={() => onFocusField && onFocusField('idle')}
                    placeholder="name@nalandanexus.edu"
                    className={`w-full h-10 px-3.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800/80 border ${
                      errors.signupEmail
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/15'
                    } rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  <Mail className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.signupEmail && (
                  <p className="text-xs text-red-500 font-medium mt-0.5">{errors.signupEmail}</p>
                )}
              </div>

              {/* Password Field with Strength Bar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={signupShowPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => handleInputChange(setSignupPassword, 'signupPassword', e)}
                    onFocus={() => onFocusField && onFocusField(signupShowPassword ? 'password-peek' : 'password-hidden')}
                    onBlur={() => onFocusField && onFocusField('idle')}
                    placeholder="Create a strong password"
                    className={`w-full h-10 px-3.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800/80 border ${
                      errors.signupPassword
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/15'
                    } rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={toggleSignupPasswordPeek}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    {signupShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${strength.color} transition-all duration-300`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>{strength.text}</span>
                </div>
                {errors.signupPassword && (
                  <p className="text-xs text-red-500 font-medium mt-0.5">{errors.signupPassword}</p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    value={signupConfirmPassword}
                    onChange={(e) => handleInputChange(setSignupConfirmPassword, 'signupConfirmPassword', e)}
                    onFocus={() => onFocusField && onFocusField('password-hidden')}
                    onBlur={() => onFocusField && onFocusField('idle')}
                    placeholder="Repeat your password"
                    className={`w-full h-10 px-3.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800/80 border ${
                      errors.signupConfirmPassword
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/15'
                    } rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  <Lock className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.signupConfirmPassword && (
                  <p className="text-xs text-red-500 font-medium mt-0.5">{errors.signupConfirmPassword}</p>
                )}
              </div>

              {/* Agree Terms Checkbox */}
              <div className="pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="hidden"
                  />
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                      agreeTerms
                        ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    {agreeTerms && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span>
                    I agree to the{' '}
                    <a href="#terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                      Terms
                    </a>{' '}
                    &{' '}
                    <a href="#privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {errors.agreeTerms && (
                  <p className="text-xs text-red-500 font-medium mt-0.5">{errors.agreeTerms}</p>
                )}
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-heading font-semibold text-sm rounded-full shadow-lg shadow-slate-900/15 dark:shadow-blue-600/20 transition-all flex items-center justify-center gap-2 mt-1"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Create Account'
                )}
              </motion.button>

              {/* Google Sign-In */}
              <GoogleSignInButton
                text="signup_with"
                onCredential={onGoogleCredential}
                onUnavailable={() => onGoogleAuth && onGoogleAuth('Sign Up')}
              />

              {/* Bottom Switch Prompt */}
              <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => onSwitchMode('login')}
                  className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 underline ml-1 transition-colors"
                >
                  Log In
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
