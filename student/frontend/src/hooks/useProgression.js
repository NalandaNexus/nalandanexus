import { useCallback, useEffect, useState } from 'react';
import { studentApiService } from '../services/studentApiService';
import { getSocket } from '../services/socket';

/**
 * The learner's progression, kept current.
 *
 * Refetches when the server says something happened rather than polling or
 * guessing locally. The backend already emits `notification.created` from the
 * single place XP is awarded, so that event is a reliable signal that a score
 * somewhere has moved - and refetching is what makes the card show the value
 * the server actually computed, instead of a number this side incremented and
 * hoped was right.
 */
export function useProgression() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await studentApiService.getProgression());
    } catch (err) {
      setError(err?.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onNotification = (notification) => {
      // Points and achievements are the notifications that follow a
      // progression change. Others (a message, an announcement) cannot move
      // these numbers, so they do not justify a refetch.
      if (['points', 'achievement'].includes(notification?.type)) load();
    };

    socket.on('notification.created', onNotification);
    return () => socket.off('notification.created', onNotification);
  }, [load]);

  return { progression: data, isLoading: loading, error, refresh: load };
}

export default useProgression;
