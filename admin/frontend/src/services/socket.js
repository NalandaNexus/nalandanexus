import { io } from 'socket.io-client';
import { SOCKET_URL } from './adminApi';

let socket = null;

/**
 * One shared Socket.IO connection for the whole admin app, authenticated by the
 * same httpOnly session cookie the REST API uses.
 *
 * It used to read the JWT out of localStorage and pass it in the handshake.
 * That token is no longer reachable from JavaScript by design, so the handshake
 * now carries the cookie instead - which the server already preferred (see
 * sockets/index.js, cookie first, handshake token second). Lazily created and
 * torn down on logout so a stale socket never lingers after sign-out.
 */
export function getSocket() {
  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      // Sends the session cookie on the handshake; the API is a different
      // origin, so without this the connection is unauthenticated and rejected.
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
