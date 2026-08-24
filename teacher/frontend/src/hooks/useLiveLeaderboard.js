import { useState, useEffect, useMemo, useCallback } from 'react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

const FILTER_MAP = {
  below75: 'below_75',
  below_75: 'below_75',
  lowAttendance: 'low_attendance',
  low_attendance: 'low_attendance',
  missingTasks: 'low_submission',
  low_submission: 'low_submission',
  declining: 'declining',
  all: 'all',
};

const SORT_MAP = {
  score: 'score',
  improvement: 'improvement',
  attendance: 'attendance',
  submissions: 'submissionRate',
  submissionRate: 'submissionRate',
};

/**
 * Real class-scoped leaderboard sourced from GET /classes/:id/leaderboard
 * (server-side sorted/filtered off live Student.metrics — see
 * leaderboard.service.js). Refetches on grade/attendance/submission
 * events so the ranking stays current without a manual reload.
 */
export function useLiveLeaderboard(classIdOrClasses, options = {}) {
  const [selectedClassId, setSelectedClassId] = useState(() => {
    if (typeof classIdOrClasses === 'string') return classIdOrClasses;
    if (Array.isArray(classIdOrClasses) && classIdOrClasses.length > 0) return classIdOrClasses[0].id || classIdOrClasses[0];
    return null;
  });

  const [sortBy, setSortBy] = useState(options.sortBy || 'score');
  const [filterBy, setFilterBy] = useState(options.filterBy || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof classIdOrClasses === 'string' && classIdOrClasses) {
      setSelectedClassId(classIdOrClasses);
    } else if (Array.isArray(classIdOrClasses) && classIdOrClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(classIdOrClasses[0].id || classIdOrClasses[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classIdOrClasses]);

  const fetchLeaderboard = useCallback(async () => {
    if (!selectedClassId) {
      setLeaderboard([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherApiService.getClassLeaderboard(selectedClassId, {
        sortBy: SORT_MAP[sortBy] || 'score',
        filterBy: FILTER_MAP[filterBy] || 'all',
        search: searchQuery || undefined,
      });
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load leaderboard.');
      setLeaderboard([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId, sortBy, filterBy, searchQuery]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!selectedClassId) return undefined;
    socketService.subscribeToClass(selectedClassId);
    return () => socketService.unsubscribeFromClass(selectedClassId);
  }, [selectedClassId]);

  useEffect(() => {
    const refetch = () => fetchLeaderboard();
    socketService.on('score:update', refetch);
    socketService.on('submission.received', refetch);
    return () => {
      socketService.off('score:update', refetch);
      socketService.off('submission.received', refetch);
    };
  }, [fetchLeaderboard]);

  const filtered = useMemo(() => leaderboard, [leaderboard]);

  return {
    leaderboard: filtered,
    students: filtered,
    selectedClassId,
    setSelectedClassId,
    sortBy,
    setSortBy,
    filterBy,
    setFilterBy,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
  };
}

export default useLiveLeaderboard;
