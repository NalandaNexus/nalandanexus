import { env } from '../config/env.js';

const SEND_TIMEOUT_MS = 15000;

/** Splits "Name <email@x.com>" into its parts; falls back to treating the whole string as the address. */
function parseFrom(from) {
  const match = from.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  return { email: from.trim() };
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** What SendGrid said was wrong, in a line - its error body is JSON with an `errors` array. */
function describeProviderError(status, body) {
  try {
    const parsed = JSON.parse(body);
    const first = parsed?.errors?.[0];
    if (first?.message) return `HTTP ${status}: ${first.message}`.slice(0, 380);
  } catch {
    // Not JSON - fall through to the raw text.
  }
  return `HTTP ${status}: ${String(body || '').replace(/\s+/g, ' ').slice(0, 300)}`;
}

/**
 * Sends an email via SendGrid's HTTPS API if configured; otherwise logs it
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
 * Uses SendGrid's plain HTTPS API (not SMTP) because Render blocks outbound
 * SMTP ports (25/465/587) on free-tier web services - confirmed live via a
 * "Connection timeout" on every SMTP send attempt regardless of credentials.
 * HTTPS (443) is never blocked, and Node's built-in fetch avoids adding a
 * new dependency for this.
 */
export async function send({ to, subject, text, html }) {
  if (!env.email.sendgridApiKey) {
    // eslint-disable-next-line no-console
    console.log(`[email:stub] To: ${to} | Subject: ${subject}`);
    return { delivered: false, stubbed: true, reason: 'NOT_CONFIGURED', detail: 'No email provider is configured on this server (SENDGRID_API_KEY).' };
  }

  const content = [{ type: 'text/plain', value: text || ' ' }];
  if (html) content.push({ type: 'text/html', value: html });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(env.email.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.email.sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: parseFrom(env.email.from),
        subject,
        content,
        // A one-time credential link should not be rewritten through a tracking
        // redirect: it breaks the link and tells a third party where it points.
        tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
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

    return { delivered: true, messageId: res.headers.get('x-message-id') || null };
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

const istTime = (date) => new Date(date).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

/**
 * The login details for a teacher: Teacher ID, login email, a temporary
 * password, and where to sign in.
 *
 * Sent only after the Teacher service has confirmed that its login accepts
 * exactly this password (teacher.service.js#issueCredentials), so what this
 * email says is what the Teacher Portal checks. The password must be changed at
 * first sign-in, and stops working the moment it is.
 *
 * Every value is escaped for the HTML part. The password is set apart in a
 * monospace block so it is copied whole and without surrounding text.
 * `isResend` only changes the wording ("earlier passwords no longer work").
 */
export function teacherCredentialsEmail({ name, teacherId, email, tempPassword, loginUrl, courses = [], isResend = false }) {
  const courseLine = courses.length ? courses.map((c) => c.title || String(c.slug).toUpperCase()).join(', ') : null;
  const e = escapeHtml;

  const intro = isResend
    ? 'Here are new sign-in details for your Nalanda Nexus Teacher Portal account. Any password sent to you before this one no longer works.'
    : 'An administrator has created a Teacher Portal account for you on Nalanda Nexus.';

  const text = [
    `Hi ${name},`,
    '',
    intro,
    '',
    `Sign in at: ${loginUrl}`,
    `Email: ${email}`,
    `Teacher ID: ${teacherId}`,
    `Temporary password: ${tempPassword}`,
    courseLine ? `Assigned course(s): ${courseLine}` : null,
    '',
    'You can sign in with either your email address or your Teacher ID. Type or paste the temporary password exactly as shown - it is case-sensitive.',
    '',
    'For your security you will be asked to choose a new password as soon as you sign in. The temporary password stops working once you do.',
    '',
    'Forgot your password later? Use "Forgot password?" on the sign-in page. If you were not expecting this message, you can ignore it.',
    '',
    '— Nalanda Nexus',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:560px">
      <p>Hi ${e(name)},</p>
      <p>${e(intro)}</p>
      <table style="border-collapse:collapse;margin:8px 0 16px">
        <tr><td style="padding:4px 12px 4px 0;color:#555">Email</td><td style="padding:4px 0"><strong>${e(email)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555">Teacher ID</td><td style="padding:4px 0"><strong>${e(teacherId)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555">Temporary password</td><td style="padding:4px 0"><code style="font-family:Consolas,Menlo,monospace;font-size:16px;background:#f1f3f7;padding:4px 8px;border-radius:4px;letter-spacing:1px">${e(tempPassword)}</code></td></tr>
        ${courseLine ? `<tr><td style="padding:4px 12px 4px 0;color:#555">Assigned course(s)</td><td style="padding:4px 0">${e(courseLine)}</td></tr>` : ''}
      </table>
      <p><a href="${e(loginUrl)}" style="display:inline-block;background:#22355E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Sign in to the Teacher Portal</a></p>
      <p style="font-size:13px;color:#555">Sign in with your email address or Teacher ID. The temporary password is case-sensitive. If the button does not work, open <span style="word-break:break-all">${e(loginUrl)}</span>.</p>
      <p style="font-size:13px;color:#555">For your security you will be asked to choose a new password as soon as you sign in; the temporary password stops working once you do. Forgot your password later? Use "Forgot password?" on the sign-in page. If you were not expecting this message, you can ignore it.</p>
      <p>— Nalanda Nexus</p>
    </div>`;

  return {
    subject: isResend ? 'Your new Nalanda Nexus Teacher Portal sign-in details' : 'Your Nalanda Nexus Teacher Portal account is ready',
    text,
    html,
  };
}

/** A teacher's self-service "forgot password" link, requested from the Teacher Portal's sign-in page. */
export function teacherPasswordResetEmail({ name, teacherId, resetUrl, expiresAt }) {
  const e = escapeHtml;
  const until = istTime(expiresAt);
  const text = [
    `Hi ${name},`,
    '',
    `Someone asked to reset the password for your Nalanda Nexus Teacher Portal account${teacherId ? ` (${teacherId})` : ''}.`,
    '',
    'Choose a new password here (this link works once):',
    resetUrl,
    `It expires on ${until} IST.`,
    '',
    'Your current password keeps working until you use the link. Using it signs you out everywhere else.',
    'If you did not ask for this, ignore this email - nothing changes.',
    '',
    '— Nalanda Nexus',
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:560px">
      <p>Hi ${e(name)},</p>
      <p>Someone asked to reset the password for your Nalanda Nexus Teacher Portal account${teacherId ? ` (<strong>${e(teacherId)}</strong>)` : ''}.</p>
      <p><a href="${e(resetUrl)}" style="display:inline-block;background:#22355E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>
      <p style="font-size:13px;color:#555">This link works once and expires on ${e(until)} IST. If the button does not work, copy this address into your browser:<br/><span style="word-break:break-all">${e(resetUrl)}</span></p>
      <p style="font-size:13px;color:#555">Your current password keeps working until you use the link. Using it signs you out everywhere else. If you did not ask for this, ignore this email - nothing changes.</p>
      <p>— Nalanda Nexus</p>
    </div>`;
  return { subject: 'Reset your Nalanda Nexus Teacher Portal password', text, html };
}

export function passwordResetEmail({ name, resetUrl, expiresAt }) {
  return {
    subject: 'Reset your Nalanda Nexus password',
    text: `Hi ${name},\n\nA password reset was requested for your account.\nReset it here: ${resetUrl}\nThis link expires at ${expiresAt.toISOString()}.\nIf you didn't request this, you can ignore this email.\n\n— Nalanda Nexus`,
  };
}

export default { send, teacherInvitationEmail, teacherCredentialsEmail, teacherPasswordResetEmail, passwordResetEmail };
