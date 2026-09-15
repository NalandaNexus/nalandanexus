import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/authService';
import { ApiError } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Starts true: we always attempt to restore a session from the httpOnly
  // refresh cookie before deciding the user is logged out (fixes "browser
  // refresh loses my session").
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  // Bumped whenever a sign-in, verification or sign-out completes, so a session
  // restore that started before it can tell it has been overtaken.
  const authEpoch = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = authEpoch.current;
    (async () => {
      const restored = await authService.restoreSession();
      if (cancelled) return;
      // Restoring reads whichever session the refresh cookie held when the page
      // loaded. A sign-in, verification or sign-out that completed while it was
      // in flight is newer and stands. Applying the restored user regardless is
      // what put the previous account's name on screen after continuing with
      // Google or opening a verification link - and what could sign a student
      // straight back out after verifying on a slow start.
      if (startedAt === authEpoch.current) setUser(restored?.user || null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const loggedInUser = await authService.login({ email, password });
      authEpoch.current += 1;
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to log in right now.';
      setAuthError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // No longer logs the student in directly - registration now requires
  // email verification first (see authService.js#register's doc-comment).
  // Returns the full response so the caller can show a "check your email"
  // screen instead of navigating straight to the dashboard.
  const signup = useCallback(async ({ name, email, password, grade }) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      return await authService.register({ name, email, password, grade });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to create your account right now.';
      setAuthError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (token) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const verifiedUser = await authService.verifyEmail(token);
      authEpoch.current += 1;
      setUser(verifiedUser);
      return verifiedUser;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to verify your email right now.';
      setAuthError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email) => {
    return authService.resendVerification(email);
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const googleUser = await authService.googleAuth(idToken);
      authEpoch.current += 1;
      setUser(googleUser);
      return googleUser;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to sign in with Google right now.';
      setAuthError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-reads the signed-in account, e.g. after the student changes their name on
  // their profile, so every screen shows what the account now holds.
  const refreshUser = useCallback(async () => {
    const data = await authService.me();
    if (data?.user) setUser(data.user);
    return data?.user || null;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    authEpoch.current += 1;
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    login,
    signup,
    verifyEmail,
    resendVerification,
    loginWithGoogle,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
