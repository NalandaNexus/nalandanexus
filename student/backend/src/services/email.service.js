import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      // Nodemailer's defaults are 2 min to connect and 10 min on the socket.
      // Several request paths (registration, forgot-password, support
      // tickets) await sendEmail inline because their response text depends
      // on whether delivery actually happened - with the defaults, a host
      // that silently drops outbound SMTP (common on managed PaaS tiers)
      // turns those into two-minute hangs that every real client times out
      // on. Fail fast instead: the callers all degrade gracefully when
      // delivered is false.
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
 * request (e.g. registration should still succeed).
 */
export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    logger.info(`[Email:DEV-STUB] To: ${to} | Subject: ${subject}`);
    logger.debug(`[Email:DEV-STUB] Body: ${text || html}`);
    return { delivered: false, stub: true };
  }

  try {
    await t.sendMail({ from: env.smtp.from, to, subject, html, text });
    return { delivered: true };
  } catch (err) {
    logger.error('[Email] Failed to send email', err.message);
    return { delivered: false, error: true };
  }
}

/**
 * Fire-and-forget variant for notifications whose delivery result the
 * caller does not use.
 *
 * Awaiting sendEmail inline makes the HTTP response wait on the whole SMTP
 * conversation. That is wrong twice over: it stalls the user behind a
 * best-effort notification, and on the enumeration-safe endpoints it leaks
 * whether an account exists purely through response time. Detach those.
 * Only await sendEmail when the response body genuinely depends on whether
 * delivery succeeded (registration's verificationUrlFallback).
 */
export function sendEmailDetached(payload) {
  Promise.resolve()
    .then(() => sendEmail(payload))
    .catch(() => {
      // sendEmail already logs and never rejects; this is belt-and-braces so
      // a detached failure can never surface as an unhandled rejection.
    });
}

export function supportTicketEmail({ ticketId, studentName, studentEmail, subject, message }) {
  return {
    subject: `[Support #${ticketId}] ${subject}`,
    text: `New support request from ${studentName} <${studentEmail}>\n\nSubject: ${subject}\n\n${message}\n\nTicket ID: ${ticketId}`,
    html: `<p><strong>New support request</strong> from ${studentName} (${studentEmail})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p>${message.replace(/\n/g, '<br/>')}</p>
      <p style="color:#888">Ticket ID: ${ticketId}</p>`,
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
