import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import AdminFooter from './AdminFooter';
import QuickSearchModal from '../common/QuickSearchModal';
import NotificationsDrawer from './NotificationsDrawer';
import { adminApi } from '../../services/adminApi';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';

export default function AdminLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [telemetryStatus, setTelemetryStatus] = useState('LIVE');
  const [liveData, setLiveData] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to real-time live telemetry stream via SSE
  useEffect(() => {
    const unsubscribe = adminApi.subscribeLiveTelemetry(
      (data) => {
        setLiveData(data);
      },
      () => {
        // SSE error handled by status change
      },
      (status) => {
        setTelemetryStatus(status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { meta } = await adminApi.getNotifications({ limit: 1 });
      setUnreadCount(meta?.unreadCount || 0);
    } catch {
      // Non-fatal — bell just won't show a badge until the next tick.
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // Real-time push: another admin action (or this one, elsewhere) creates a
  // notification for this account — bump the bell without waiting for a
  // manual refresh.
  useRealtimeEvents(['notification.created'], refreshUnreadCount);

  // Global Cmd+K / Ctrl+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#EDEAE0] text-[#2B2B28] flex flex-col md:flex-row antialiased">
      {/* Sidebar Navigation */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <AdminHeader
          onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          telemetryStatus={telemetryStatus}
          unreadNotificationsCount={unreadCount}
        />

        {/* Dynamic Page Content View */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          <Outlet context={{ liveData, telemetryStatus }} />
        </main>

        {/* Dynamic Institutional Footer */}
        <AdminFooter />
      </div>

      {/* Quick Search Spotlight Modal */}
      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Notifications & Triage Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onRead={refreshUnreadCount}
      />
    </div>
  );
}
