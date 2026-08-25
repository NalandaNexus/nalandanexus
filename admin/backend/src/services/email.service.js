import { env } from '../config/env.js';

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';

/** Splits "Name <email@x.com>" into its parts; falls back to treating the whole string as the address. */
function parseFrom(from) {
  const match = from.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  return { email: from.trim() };
}

/**
 * Sends an email via SendGrid's HTTPS API if configured; otherwise logs it
 * (dev/demo mode). Never throws - a failed notification email should not
 * break the calling request. Returns a real, honest delivery status either
 * way (never `{delivered: true}` unless SendGrid actually accepted the
 * send) so callers like teacher.service.js#createTeacher can surface a
 * genuine warning instead of pretending credentials were received.
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
    console.log(`[email:stub] To: ${to} | Subject: ${subject}\n${text}`);
    return { delivered: false, stubbed: true };
  }

  const content = [{ type: 'text/plain', value: text || ' ' }];
  if (html) content.push({ type: 'text/html', value: html });

  try {
    const res = await fetch(SENDGRID_ENDPOINT, {
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
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error('[email] SendGrid rejected the send:', res.status, body);
      return { delivered: false, error: true };
    }

    return { delivered: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send email:', err.message);
    return { delivered: false, error: true };
  }
}

export function teacherInvitationEmail({ name, activationUrl, expiresAt }) {
  return {
    subject: 'You have been invited to join Nalanda Nexus as faculty',
    text: `Hi ${name},\n\nAn administrator has created a faculty account for you on Nalanda Nexus.\nActivate it here: ${activationUrl}\nThis link expires at ${expiresAt.toISOString()}.\n\n— Nalanda Nexus`,
  };
}

export function teacherCredentialsEmail({ name, email, tempPassword, loginUrl }) {
  return {
    subject: 'Your Nalanda Nexus Teacher Portal account is ready',
    text: `Hi ${name},\n\nAn administrator created a Teacher Portal account for you on Nalanda Nexus.\n\nLogin email: ${email}\nTemporary password: ${tempPassword}\n\nSign in at: ${loginUrl}\n\nFor security, you'll be asked to set a new password the first time you sign in — the temporary one above stops working immediately after that.\n\n— Nalanda Nexus`,
    html: `<p>Hi ${name},</p>
      <p>An administrator created a Teacher Portal account for you on Nalanda Nexus.</p>
      <p><strong>Login email:</strong> ${email}<br/><strong>Temporary password:</strong> ${tempPassword}</p>
      <p><a href="${loginUrl}">Sign in to the Teacher Portal</a></p>
      <p>For security, you'll be asked to set a new password the first time you sign in — the temporary one above stops working immediately after that.</p>
      <p>— Nalanda Nexus</p>`,
  };
}

export function passwordResetEmail({ name, resetUrl, expiresAt }) {
  return {
    subject: 'Reset your Nalanda Nexus password',
    text: `Hi ${name},\n\nA password reset was requested for your account.\nReset it here: ${resetUrl}\nThis link expires at ${expiresAt.toISOString()}.\nIf you didn't request this, you can ignore this email.\n\n— Nalanda Nexus`,
  };
}

export default { send, teacherInvitationEmail, teacherCredentialsEmail, passwordResetEmail };
