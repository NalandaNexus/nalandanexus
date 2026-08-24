import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';

const ENTITY_LINKS = {
  Teacher: '/teachers',
  Student: '/students',
  Course: '/courses',
  Payment: '/payments',
  Announcement: '/announcements',
};

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsDrawer({ isOpen, onClose, onRead }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { items } = await adminApi.getNotifications({ limit: 20 });
      setNotifications(items);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  useRealtimeEvents(['notification.created'], () => {
    if (isOpen) load();
  });

  const handleAction = async (item) => {
    if (!item.isRead) {
      try {
        await adminApi.markNotificationRead(item._id);
        onRead?.();
      } catch {
        // Non-fatal — navigation still proceeds.
      }
    }
    const link = ENTITY_LINKS[item.relatedEntityType] || '/logs';
    navigate(link);
    onClose();
  };

  const handleMarkAllRead = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      onRead?.();
      load();
    } catch {
      // Non-fatal.
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex justify-end">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border-l border-[#DFDACB] w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#EDEAE0] bg-[#F7F5EE] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#22355E]">Notifications & Triage</h2>
            <p className="text-xs text-[#9B9690]">Real-time operational alerts requiring attention</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9B9690] hover:text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto divide-y divide-[#EDEAE0]">
          {isLoading && (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#22355E] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && error && (
            <p className="text-xs text-[#C1352B] text-center py-6">{error}</p>
          )}

          {!isLoading && !error && notifications.length === 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-[#5C7A5E] py-6 justify-center">
              <CheckCircle2 className="w-4 h-4" />
              <span>No notifications — all operational checks nominal.</span>
            </div>
          )}

          {!isLoading &&
            !error &&
            notifications.map((item) => {
              const isAttention = ['TEACHER_STATUS', 'COURSE_SUBMITTED'].includes(item.type);
              const isBlocked = item.type === 'STUDENT_STATUS';

              return (
                <div key={item._id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        !item.isRead
                          ? isBlocked
                            ? 'bg-[#C1352B]/15 text-[#C1352B]'
                            : isAttention
                            ? 'bg-[#C99A2E]/15 text-[#C99A2E]'
                            : 'bg-[#22355E]/15 text-[#22355E]'
                          : 'bg-[#5C7A5E]/10 text-[#5C7A5E]'
                      }`}
                    >
                      {isBlocked ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : isAttention ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-xs truncate ${item.isRead ? 'text-[#2B2B28]' : 'font-bold text-[#22355E]'}`}>
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-[#9B9690] font-mono whitespace-nowrap">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[#2B2B28]/80 mt-1 leading-relaxed">{item.message}</p>
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors"
                      >
                        <span>{item.isRead ? 'View' : 'Mark read & view'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-[#F7F5EE] border-t border-[#EDEAE0] flex items-center justify-between">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-[#22355E] hover:underline"
          >
            Mark all as read
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] text-xs font-medium text-[#2B2B28]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
