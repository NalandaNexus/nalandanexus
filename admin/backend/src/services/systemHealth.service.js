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
    emailProviderCheck(),
  ];
}

/**
 * Whether outbound email is set up at all - the first thing to rule out when
 * teachers say a setup email never arrived. Reports configuration only; it
 * sends nothing and cannot tell whether the provider will accept the sender
 * address (that is answered per email, and recorded on each teacher). Never
 * includes the key.
 */
// Domains nobody but their owner can verify, so Resend refuses them as a sender.
const PUBLIC_MAILBOX_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'rediffmail.com']);

function senderDomain(from) {
  const address = (String(from).match(/<([^>]+)>/)?.[1] || String(from)).trim();
  return address.split('@')[1]?.toLowerCase() || '';
}

function emailProviderCheck() {
  const name = 'Email provider (Resend)';
  if (!env.email.resendApiKey) {
    return { name, status: 'DEGRADED', detail: 'RESEND_API_KEY is not set - no email can be sent (teacher setup emails are logged, not delivered)' };
  }
  const domain = senderDomain(env.email.from);
  if (PUBLIC_MAILBOX_DOMAINS.has(domain)) {
    return { name, status: 'DEGRADED', detail: `EMAIL_FROM is a @${domain} address, which Resend refuses as a sender. Use an address on a domain verified in Resend, and put the ${domain} address in EMAIL_REPLY_TO.` };
  }
  if (domain === 'resend.dev') {
    return { name, status: 'DEGRADED', detail: `Sending as ${env.email.from} (Resend's test sender) - it only delivers to the Resend account owner's own inbox. Verify a domain in Resend and set EMAIL_FROM to an address on it.` };
  }
  return { name, status: 'HEALTHY', detail: `Key configured · sending as ${env.email.from}${env.email.replyTo ? ` · replies to ${env.email.replyTo}` : ''}` };
}

export default { getSystemHealth };
