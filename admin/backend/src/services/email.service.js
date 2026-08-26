import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      // Nodemailer defaults to 2 minutes to connect and 10 on the socket.
      // Teacher creation awaits this send inline (it records whether the
      // credentials actually reached the teacher), so on a host that drops
      // outbound SMTP - the norm on managed PaaS tiers - creating a teacher
      // becomes a two-minute hang that the admin UI times out on, even
      // though the teacher record itself saved fine. Fail fast and let the
      // caller fall back to showing the credentials in-app.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });
  }
  return transporter;
}

/**
 * Sends an email if SMTP is configured; otherwise logs it (dev/demo mode).
 * Never throws - a failed notification email should not break the calling
 * request. Returns a real, honest delivery status either way (never
 * `{delivered: true}` unless nodemailer actually accepted the send) so
 * callers like teacher.service.js#createTeacher can surface a genuine
 * warning instead of pretending credentials were received.
 */
export async function send({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.log(`[email:stub] To: ${to} | Subject: ${subject}\n${text}`);
    return { delivered: false, stubbed: true };
  }

  try {
    await t.sendMail({ from: env.smtp.from, to, subject, text, html });
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
