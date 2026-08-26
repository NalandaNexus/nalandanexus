import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { sendEmailDetached, supportTicketEmail } from '../services/email.service.js';
import { env } from '../config/env.js';

export const listMyTickets = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ createdAt: -1 });
  return sendSuccess(res, { data: tickets });
});

/**
 * Persists the ticket first (the database write is the source of truth),
 * then emails the support team - best-effort and genuinely non-blocking
 * (sendEmailDetached), so an unreachable SMTP host delays the student's
 * confirmation by exactly nothing. email.service.js#sendEmail logs to
 * console instead of sending when SMTP is unconfigured.
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
    sendEmailDetached({ to: env.support.notifyEmail, subject, html, text });
  }

  return sendSuccess(res, {
    status: 201,
    message: "Support request submitted. We'll get back to you soon.",
    data: ticket,
  });
});
