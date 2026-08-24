import { io } from 'socket.io-client';
import { SOCKET_URL, getToken } from './adminApi';

let socket = null;

/**
 * One shared Socket.IO connection for the whole admin app, authenticated
 * with the same JWT the REST API uses. Lazily created on first use and torn
 * down on logout via disconnectSocket() so a stale/unauthenticated socket
 * never lingers after sign-out.
 */
export function getSocket() {
  const token = getToken();
  if (!token) return null;

  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
    });
  } else {
    socket.auth = { token };
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
