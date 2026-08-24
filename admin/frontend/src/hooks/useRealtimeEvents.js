import { useEffect } from 'react';
import { getSocket } from '../services/socket';

/**
 * Subscribes to one or more Socket.IO events for the lifetime of a
 * component and calls `onEvent` whenever any of them fire — used across
 * list pages to refetch data the moment another admin (or this one, from a
 * different tab) creates/updates/deletes a record, instead of requiring a
 * manual page refresh.
 */
export function useRealtimeEvents(events, onEvent) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handler = (payload) => onEvent(payload);
    events.forEach((event) => socket.on(event, handler));

    return () => {
      events.forEach((event) => socket.off(event, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.join(',')]);
}

export default useRealtimeEvents;
