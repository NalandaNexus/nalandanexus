import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await authService.restoreSession();
      if (!cancelled) {
        setUser(restored?.user || null);
        setIsLoading(false);
      }
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

  const logout = useCallback(async () => {
    await authService.logout();
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
