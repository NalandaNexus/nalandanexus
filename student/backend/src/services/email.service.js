import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/sanitize.js';

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
 * break the calling request (e.g. registration should still succeed).
 *
 * Uses SendGrid's plain HTTPS API (not SMTP) because Render blocks outbound
 * SMTP ports (25/465/587) on free-tier web services - confirmed live via a
 * "Connection timeout" on every SMTP send attempt regardless of credentials.
 * HTTPS (443) is never blocked, and Node's built-in fetch avoids adding a
 * new dependency for this.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!env.email.sendgridApiKey) {
    logger.info(`[Email:DEV-STUB] To: ${to} | Subject: ${subject}`);
    logger.debug(`[Email:DEV-STUB] Body: ${text || html}`);
    return { delivered: false, stub: true };
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
      logger.error('[Email] SendGrid rejected the send', { status: res.status, body });
      return { delivered: false, error: true };
    }

    return { delivered: true };
  } catch (err) {
    logger.error('[Email] Failed to send email', err.message);
    return { delivered: false, error: true };
  }
}

export function supportTicketEmail({ ticketId, studentName, studentEmail, subject, message }) {
  // Every interpolated value here is student-controlled and lands in an HTML
  // body we build ourselves, so it is escaped at the sink. Input is also
  // stripped of markup on write (utils/sanitize.js) - this is the second,
  // independent layer, because an email client is exactly the kind of
  // consumer that does NOT escape for us the way React does.
  const e = escapeHtml;
  return {
    subject: `[Support #${ticketId}] ${subject}`,
    text: `New support request from ${studentName} <${studentEmail}>\n\nSubject: ${subject}\n\n${message}\n\nTicket ID: ${ticketId}`,
    html: `<p><strong>New support request</strong> from ${e(studentName)} (${e(studentEmail)})</p>
      <p><strong>Subject:</strong> ${e(subject)}</p>
      <p>${e(message).replace(/\n/g, '<br/>')}</p>
      <p style="color:#888">Ticket ID: ${e(String(ticketId))}</p>`,
  };
}

export function emailVerificationEmail(verifyUrl) {
  return {
    subject: 'Verify your Nalanda Nexus email',
    text: `Welcome to Nalanda Nexus! Verify your email to activate your account: ${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can safely ignore this email.`,
    html: `<p>Welcome to Nalanda Nexus!</p>
      <p><a href="${verifyUrl}">Click here to verify your email</a> and activate your account (this link expires in 24 hours).</p>
      <p>If you didn't create this account, you can safely ignore this email.</p>`,
  };
}

export function passwordResetEmail(resetUrl) {
  return {
    subject: 'Reset your Nalanda Nexus password',
    text: `You requested a password reset. Open this link to set a new password (valid for a limited time): ${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>You requested a password reset for your Nalanda Nexus account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> (this link expires soon).</p>
      <p>If you did not request this, you can safely ignore this email.</p>`,
  };
}
