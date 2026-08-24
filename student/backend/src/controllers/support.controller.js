import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { sendEmail, supportTicketEmail } from '../services/email.service.js';
import { env } from '../config/env.js';

export const listMyTickets = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ createdAt: -1 });
  return sendSuccess(res, { data: tickets });
});

/**
 * Persists the ticket first (the database write is the source of truth),
 * then emails the support team - best-effort, never blocks or fails the
 * request if SMTP is unreachable/unconfigured (email.service.js#sendEmail
 * already logs to console instead of sending when unconfigured).
 */
export const createTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.create({
    userId: req.user._id,
    subject: req.body.subject,
    message: req.body.message,
  });

  if (env.support.notifyEmail) {
    const { subject, html, text } = supportTicketEmail({
      ticketId: String(ticket._id).slice(-8).toUpperCase(),
      studentName: req.user.name,
      studentEmail: req.user.email,
      subject: ticket.subject,
      message: ticket.message,
    });
    await sendEmail({ to: env.support.notifyEmail, subject, html, text });
  }

  return sendSuccess(res, {
    status: 201,
    message: "Support request submitted. We'll get back to you soon.",
    data: ticket,
  });
});
