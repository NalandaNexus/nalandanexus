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
