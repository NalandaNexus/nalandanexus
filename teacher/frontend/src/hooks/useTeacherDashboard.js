import { useState, useEffect, useCallback, useMemo } from 'react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

const EMPTY_OVERVIEW = {
  classes: [],
  coreStats: null,
  avgScoreBreakdown: null,
  atRiskStudents: { all: [], actNow: [], watch: [], totalCount: 0 },
  recommendedActions: [],
  pendingTasks: [],
  workloadSummary: null,
  classHealth: [],
  todaysSchedule: [],
  liveClassState: { isActive: false },
  conceptPerformance: [],
};

/**
 * Real data, one round trip: `GET /api/teacher/dashboard` already returns
 * every field this hook exposes, pre-aggregated from live MongoDB queries
 * (see backend/src/services/dashboard.service.js's own doc-comment — the
 * two were built to match exactly). No mock data, no fabricated fallback
 * numbers; an empty institution genuinely shows zeros/empty states.
 */
export function useTeacherDashboard() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isStudentDrawerOpen, setIsStudentDrawerOpen] = useState(false);
  const [isAvgScoreModalOpen, setIsAvgScoreModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const [timeFilter, setTimeFilter] = useState('thisWeek');
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const data = await teacherApiService.getDashboardOverview();
      setOverview({ ...EMPTY_OVERVIEW, ...data });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    teacherApiService.getUnreadNotificationCount().then((c) => setUnreadNotificationsCount(c ?? 0)).catch(() => {});
  }, []);

  const openStudentDrillDown = useCallback((student) => {
    if (!student) return;
    const found = typeof student === 'string'
      ? overview.atRiskStudents.all.find((s) => s.id === student) || { id: student }
      : student;
    setSelectedStudent(found);
    setIsStudentDrawerOpen(true);
  }, [overview.atRiskStudents]);

  const closeStudentDrillDown = useCallback(() => {
    setIsStudentDrawerOpen(false);
    setSelectedStudent(null);
  }, []);

  // Real-time: score updates, class lifecycle changes, and new notifications
  // all refresh the aggregate overview live rather than needing a manual
  // page reload. Refetching the whole payload (instead of patching pieces
  // client-side) keeps every derived number honest and in sync.
  useEffect(() => {
    socketService.connect();

    const unbindScore = socketService.on('score:update', fetchOverview);
    const unbindClassEvents = ['class.rescheduled', 'class.started', 'class.completed', 'class.cancelled', 'class.updated'].map((ev) =>
      socketService.on(ev, fetchOverview)
    );
    const unbindNotification = socketService.on('notification.created', () => {
      setUnreadNotificationsCount((c) => c + 1);
    });
    const unbindStatus = socketService.on('connection:status', ({ status }) => {
      setConnectionStatus(status);
    });

    return () => {
      unbindScore();
      unbindClassEvents.forEach((unbind) => unbind());
      unbindNotification();
      unbindStatus();
    };
  }, [fetchOverview]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();

    const studentResults = overview.atRiskStudents.all
      .filter((s) => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({ id: s.id, type: 'student', title: s.name, subtitle: `${s.className || ''} • ${s.score ?? 0}% Score`, data: s }));

    const classResults = overview.classes
      .filter((c) => c.name?.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({ id: c.id, type: 'class', title: c.name, subtitle: `${c.subject || ''} (${c.studentCount} students)`, data: c }));

    return [...studentResults, ...classResults];
  }, [searchQuery, overview]);

  return {
    isLoading,
    error,
    refetch: fetchOverview,
    ...overview,

    selectedStudent,
    isStudentDrawerOpen,
    openStudentDrillDown,
    closeStudentDrillDown,

    isAvgScoreModalOpen,
    setIsAvgScoreModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    unreadNotificationsCount,
    setUnreadNotificationsCount,

    timeFilter,
    setTimeFilter,

    isLive: connectionStatus === 'connected',
    connectionStatus,
  };
}

export default useTeacherDashboard;
