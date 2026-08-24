import { isDatabaseConnected } from '../config/db.js';
import { getIO } from '../sockets/index.js';
import { env } from '../config/env.js';

const SERVICES = [
  { name: 'Student Portal API', url: `${env.studentBridge.url || 'http://localhost:5001'}/api/health` },
  { name: 'Teacher Portal API', url: `${env.teacherBridge.url || 'http://localhost:5002'}/api/health` },
];

async function pingService(service) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(service.url, { signal: controller.signal });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    return { name: service.name, url: service.url, status: res.ok ? 'HEALTHY' : 'DEGRADED', latencyMs };
  } catch {
    return { name: service.name, url: service.url, status: 'UNREACHABLE', latencyMs: null };
  }
}

/**
 * Real cross-service health monitoring — replaces the previous frontend's
 * fabricated infra list (a "PostgreSQL Core Database Cluster" and "S3
 * Transcoder" that don't exist anywhere in this stack) with an actual check
 * of the two sibling Node services this workspace really runs, plus this
 * process's own real MongoDB connection and Socket.IO state.
 */
export async function getSystemHealth() {
  const io = getIO();
  const remoteChecks = await Promise.all(SERVICES.map(pingService));

  return [
    {
      name: 'Admin API (this service)',
      status: 'HEALTHY',
      detail: `${process.env.PORT || 5003} · uptime ${Math.round(process.uptime())}s`,
    },
    {
      name: 'MongoDB (nalanda_admin)',
      status: isDatabaseConnected() ? 'HEALTHY' : 'UNREACHABLE',
      detail: isDatabaseConnected() ? 'Connected' : 'Disconnected',
    },
    {
      name: 'Socket.IO Realtime Layer',
      status: io ? 'HEALTHY' : 'UNREACHABLE',
      detail: io ? `${io.sockets.sockets.size} admin client(s) connected` : 'Not initialized',
    },
    ...remoteChecks.map((c) => ({ name: c.name, status: c.status, detail: c.latencyMs !== null ? `${c.latencyMs}ms` : 'No response' })),
  ];
}

export default { getSystemHealth };
