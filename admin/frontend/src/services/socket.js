import { io } from 'socket.io-client';
import { SOCKET_URL } from './adminApi';

let socket = null;

/**
 * One shared Socket.IO connection for the whole admin app, authenticated by
 * the same httpOnly session cookie the REST API uses - sockets/index.js on
 * the backend already reads it off the handshake headers. `withCredentials`
 * is what makes the browser attach that cookie to a cross-origin handshake;
 * without it the socket would connect unauthenticated.
 *
 * There is no token to inspect up front any more, so an unauthenticated
 * caller is rejected by the server's handshake rather than short-circuited
 * here. Lazily created on first use and torn down on logout via
 * disconnectSocket(), so a stale socket never lingers after sign-out.
 */
export function getSocket() {
  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
    });
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default { getSocket, disconnectSocket };
