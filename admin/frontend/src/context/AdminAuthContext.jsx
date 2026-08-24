import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { adminApi, getToken, setToken as persistToken } from '../services/adminApi';
import { disconnectSocket } from '../services/socket';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  // No default-authenticated fallback user — session state starts unknown
  // (isLoading=true) and is only ever set from a real backend response.
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // On mount (and after any refresh), if a token exists, verify it against
  // the backend via /auth/me rather than trusting whatever was cached in
  // localStorage — a suspended/deleted account is rejected immediately.
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      const existingToken = getToken();
      if (!existingToken) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await adminApi.getMe();
        if (!cancelled) {
          setUser(me);
          setTokenState(existingToken);
        }
      } catch {
        if (!cancelled) {
          persistToken(null);
          setUser(null);
          setTokenState(null);
        }
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
      persistToken(null);
      disconnectSocket();
      setUser(null);
      setTokenState(null);
    };
    window.addEventListener('nalanda-admin-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nalanda-admin-unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async ({ email, password, rememberMe }) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await adminApi.login({ email, password });
      setUser(result.admin);
      setTokenState(result.token);
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
    adminApi.logout().catch(() => {});
    disconnectSocket();
    setUser(null);
    setTokenState(null);
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
    token,
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
