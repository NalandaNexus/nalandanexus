import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { disconnectSocket } from '../services/socket';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  // No default-authenticated fallback user — session state starts unknown
  // (isLoading=true) and is only ever set from a real backend response.
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // The session lives in an httpOnly cookie this code cannot read, so the
  // only way to know whether one exists is to ask the backend. /auth/me is
  // also the more truthful check: a readable cached token only ever proved
  // that a token existed, never that the account behind it was still active.
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const me = await adminApi.getMe();
        if (!cancelled) setUser(me);
      } catch {
        // No session, or it has expired/been revoked - stay logged out.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 response from the API (expired/revoked token) clears the
  // session immediately, wherever in the app it happens.
  useEffect(() => {
    const handleUnauthorized = () => {
      disconnectSocket();
      setUser(null);
    };
    window.addEventListener('nalanda-admin-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nalanda-admin-unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async ({ email, password, rememberMe }) => {
    setIsLoading(true);
    setError(null);

    try {
      // rememberMe is sent to the backend, which decides how long the
      // session cookie lives - it is no longer a client-side storage choice.
      const result = await adminApi.login({ email, password, rememberMe });
      setUser(result.admin);
      if (rememberMe) {
        localStorage.setItem('nalanda_admin_remembered_email', email);
      } else {
        localStorage.removeItem('nalanda_admin_remembered_email');
      }
      setIsLoading(false);
      return { success: true, user: result.admin };
    } catch (err) {
      setError(err.message || 'Invalid administrator credentials');
      setIsLoading(false);
      return { success: false, error: err.message || 'Invalid credentials' };
    }
  }, []);

  const logout = useCallback(() => {
    // The backend clears the httpOnly cookie; there is nothing to clear here.
    adminApi.logout().catch(() => {});
    disconnectSocket();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (requiredRole) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return user.role === requiredRole;
    },
    [user]
  );

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return (user.permissions || []).includes(permission);
    },
    [user]
  );

  const getFirstName = useCallback(() => {
    if (!user || !user.name) return 'Admin';
    const parts = user.name.split(' ');
    if (['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Master'].includes(parts[0]) && parts.length > 1) {
      return parts[1];
    }
    return parts[0];
  }, [user]);

  const value = {
    user,
    // No `token` here any more - it lives in an httpOnly cookie that this
    // code cannot read. Nothing consumed it; `isAuthenticated` is what
    // callers actually used it for.
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    logout,
    hasRole,
    hasPermission,
    getFirstName,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
