import { io } from 'socket.io-client';
import { getAccessToken } from './apiClient';

/**
 * Thin singleton wrapper around the backend's authenticated Socket.IO server
 * (backend/src/sockets/index.js). One connection per logged-in session,
 * joined server-side to a private `user:<id>` room - never a global stream
 * of other students' activity (master doc section 13/44).
 */
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

let socket = null;

export function connectSocket() {
  const token = getAccessToken();
  if (!token) return null;

  if (socket && socket.connected && socket.auth?.token === token) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

/**
 * Separate, unauthenticated connection to the backend's public `/public`
 * namespace (backend/src/sockets/index.js#emitToPublic) - used by the
 * anonymous Landing Page (Resources, Announcements) to get live updates
 * without a session. Deliberately NOT the connectSocket() singleton above,
 * since that one returns null with no token; an anonymous visitor never has
 * one and should still see live updates.
 */
let publicSocket = null;

export function connectPublicSocket() {
  if (publicSocket && publicSocket.connected) return publicSocket;
  if (publicSocket) publicSocket.disconnect();

  publicSocket = io(`${SOCKET_URL}/public`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  return publicSocket;
}

export function disconnectPublicSocket() {
  if (publicSocket) {
    publicSocket.disconnect();
    publicSocket = null;
  }
}
