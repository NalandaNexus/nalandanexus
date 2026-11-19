import { env } from '../config/env.js';

const SEND_TIMEOUT_MS = 15000;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** What Resend said was wrong, in a line - its error body is JSON: { statusCode, name, message }. */
function describeProviderError(status, body) {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.message) return `HTTP ${status}: ${parsed.message}`.slice(0, 380);
  } catch {
    // Not JSON - fall through to the raw text.
  }
  return `HTTP ${status}: ${String(body || '').replace(/\s+/g, ' ').slice(0, 300)}`;
}

/**
 * Sends an email via Resend's HTTPS API if configured; otherwise logs it
 * (dev/demo mode). Never throws - a failed notification email should not
 * break the calling request. Returns a real, honest outcome either way, so a
 * caller can record WHY a message did not go (a bad key, an unverified sender
 * address, a timeout) instead of only that it did not:
 *
 *   { delivered: true, messageId }
 *   { delivered: false, stubbed: true, reason: 'NOT_CONFIGURED' }
 *   { delivered: false, reason: 'PROVIDER_REJECTED', status, detail }
 *   { delivered: false, reason: 'NETWORK_ERROR' | 'TIMEOUT', detail }
 *
 * `delivered` means the provider ACCEPTED the message. Whether it then reaches an
 * inbox is not something this call can know.
 *
 * Uses Resend's plain HTTPS API (not SMTP) because Render blocks outbound
 * SMTP ports (25/465/587) on free-tier web services - confirmed live via a
 * "Connection timeout" on every SMTP send attempt regardless of credentials.
 * HTTPS (443) is never blocked, and Node's built-in fetch avoids adding a
 * new dependency for this.
 *
 * Click and open tracking are off unless turned on for the domain in Resend -
 * leave them off: a one-time credential link must not be rewritten through a
 * tracking redirect (it breaks the link and tells a third party where it points).
 */
export async function send({ to, subject, text, html }) {
  if (!env.email.resendApiKey) {
    // eslint-disable-next-line no-console
    console.log(`[email:stub] To: ${to} | Subject: ${subject}`);
    return { delivered: false, stubbed: true, reason: 'NOT_CONFIGURED', detail: 'No email provider is configured on this server (RESEND_API_KEY).' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(env.email.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.email.resendApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'nalanda-nexus-admin',
      },
      body: JSON.stringify({
        from: env.email.from,
        to: [to],
        ...(env.email.replyTo ? { reply_to: env.email.replyTo } : {}),
        subject,
        text: text || ' ',
        ...(html ? { html } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = describeProviderError(res.status, body);
      // eslint-disable-next-line no-console
      console.error('[email] Provider rejected the send:', detail);
      return { delivered: false, error: true, reason: 'PROVIDER_REJECTED', status: res.status, detail };
    }

    const accepted = await res.json().catch(() => null);
    return { delivered: true, messageId: accepted?.id || null };
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send email:', timedOut ? 'timed out' : err.message);
    return {
      delivered: false,
      error: true,
      reason: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      detail: timedOut ? `The email provider did not answer within ${SEND_TIMEOUT_MS / 1000}s.` : `Could not reach the email provider: ${err.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function teacherInvitationEmail({ name, activationUrl, expiresAt }) {
  return {
    subject: 'You have been invited to join Nalanda Nexus as faculty',
    text: `Hi ${name},\n\nAn administrator has created a faculty account for you on Nalanda Nexus.\nActivate it here: ${activationUrl}\nThis link expires at ${expiresAt.toISOString()}.\n\n— Nalanda Nexus`,
  };
}

/**
 * The onboarding email for a new teacher: who they are, what they were assigned,
 * and a single-use link to choose their own password.
 *
 * There is no password in it, and none exists to send - the account is created
 * with one nobody knows, and this link is the only way to set the real one. The
 * link is the only secret, it works once, and it stops working at `expiresAt`.
 *
 * `isResend` only changes the wording ("a new link; earlier ones no longer work").
 */
export function teacherOnboardingEmail({ name, teacherId, loginUrl, setupUrl, expiresAt, courses = [], isResend = false }) {
  const when = expiresAt.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  const courseLine = courses.length ? courses.map((c) => c.title || String(c.slug).toUpperCase()).join(', ') : null;
  const e = escapeHtml;

  const intro = isResend
    ? 'Here is a new link to set up your Nalanda Nexus Teacher Portal account. Any earlier link no longer works.'
    : 'An administrator has created a Teacher Portal account for you on Nalanda Nexus.';

  const text = [
    `Hi ${name},`,
    '',
    intro,
    '',
    `Teacher ID: ${teacherId}`,
    courseLine ? `Assigned course(s): ${courseLine}` : null,
    '',
    'Set your password (this link works once):',
    setupUrl,
    `It expires on ${when} IST.`,
    '',
    'First sign-in:',
    '  1. Open the link above and choose a password.',
    `  2. Go to ${loginUrl}`,
    '  3. Sign in with your email address or Teacher ID, and the password you chose.',
    '',
    'For your security we never send passwords by email. If the link has expired, ask your administrator to send a new one. If you were not expecting this message, you can ignore it.',
    '',
    '— Nalanda Nexus',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:560px">
      <p>Hi ${e(name)},</p>
      <p>${e(intro)}</p>
      <p><strong>Teacher ID:</strong> ${e(teacherId)}${courseLine ? `<br/><strong>Assigned course(s):</strong> ${e(courseLine)}` : ''}</p>
      <p><a href="${e(setupUrl)}" style="display:inline-block;background:#22355E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Set your password</a></p>
      <p style="font-size:13px;color:#555">This link works once and expires on ${e(when)} IST. If the button does not work, copy this address into your browser:<br/><span style="word-break:break-all">${e(setupUrl)}</span></p>
      <p><strong>First sign-in</strong></p>
      <ol style="padding-left:18px">
        <li>Open the link above and choose a password.</li>
        <li>Go to <a href="${e(loginUrl)}">${e(loginUrl)}</a></li>
        <li>Sign in with your email address or Teacher ID, and the password you chose.</li>
      </ol>
      <p style="font-size:13px;color:#555">For your security we never send passwords by email. If the link has expired, ask your administrator to send a new one. If you were not expecting this message, you can ignore it.</p>
      <p>— Nalanda Nexus</p>
    </div>`;

  return { subject: isResend ? 'Your new Nalanda Nexus Teacher Portal setup link' : 'Set up your Nalanda Nexus Teacher Portal account', text, html };
}

export function passwordResetEmail({ name, resetUrl, expiresAt }) {
  return {
    subject: 'Reset your Nalanda Nexus password',
    text: `Hi ${name},\n\nA password reset was requested for your account.\nReset it here: ${resetUrl}\nThis link expires at ${expiresAt.toISOString()}.\nIf you didn't request this, you can ignore this email.\n\n— Nalanda Nexus`,
  };
}

export default { send, teacherInvitationEmail, teacherOnboardingEmail, passwordResetEmail };
