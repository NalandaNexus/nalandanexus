import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { socketService } from '../services/socketService';
import { teacherApiService, ApiClientError, onSessionExpired } from '../services/teacherApiService';

const TeacherAuthContext = createContext(null);

export function TeacherAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true until the initial session check resolves
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState(null);

  // The httpOnly session cookie (not localStorage) is the real source of
  // truth, so every load re-verifies against the backend via /auth/me
  // rather than trusting a cached blob — there is no "assume logged in"
  // fallback here on purpose (see the removed DEFAULT_FACULTY_USER, which
  // used to grant a fake session with no real backend check at all).
  useEffect(() => {
    let cancelled = false;
    teacherApiService
      .me()
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        socketService.connect();
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      socketService.disconnect();
    });
  }, []);

  const login = useCallback(async ({ email, password, rememberMe }) => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const data = await teacherApiService.login(email, password, rememberMe);
      setUser(data.user);
      socketService.connect();
      setIsAuthenticating(false);
      return { success: true, user: data.user };
    } catch (err) {
      setIsAuthenticating(false);
      // Never fabricate a session on failure — a wrong password, an
      // unreachable backend, or any other error all surface as a real,
      // visible failure instead of silently logging the user in anyway.
      const message = err instanceof ApiClientError ? err.message : 'Unable to sign in. Please try again.';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await teacherApiService.logout();
    } catch {
      // Best-effort — clear local state regardless of whether the request succeeded.
    }
    socketService.disconnect();
    setUser(null);
  }, []);

  /** Completes the mandatory first-login reset (or a voluntary password change). */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await teacherApiService.changePassword(currentPassword, newPassword);
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);

  /** Re-fetches the real profile from the backend — used after a profile/preferences save so the UI reflects what actually persisted, not just the optimistic form state. */
  const refreshUser = useCallback(async () => {
    try {
      const data = await teacherApiService.me();
      setUser(data.user);
      return data.user;
    } catch {
      return null;
    }
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    mustChangePassword: Boolean(user?.mustChangePassword),
    isLoading,
    isAuthenticating,
    error,
    login,
    logout,
    changePassword,
    refreshUser,
    setUser,
  };

  return <TeacherAuthContext.Provider value={value}>{children}</TeacherAuthContext.Provider>;
}

export function useTeacherAuth() {
  const context = useContext(TeacherAuthContext);
  if (!context) {
    throw new Error('useTeacherAuth must be used within a TeacherAuthProvider');
  }
  return context;
}

export default TeacherAuthContext;
