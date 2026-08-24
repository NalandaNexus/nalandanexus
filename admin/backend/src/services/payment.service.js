import { Payment } from '../models/Payment.js';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { notifyAllAdmins } from './notification.service.js';
import { emitEvent } from '../sockets/index.js';

export async function listPayments(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.student) filter.student = query.student;

  const [items, total, summaryRows] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('student', 'name rollNo email').lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const summary = Object.fromEntries(summaryRows.map((r) => [r._id, { total: r.total, count: r.count }]));
  return {
    items: withIds(items),
    meta: buildPaginationMeta({ page, limit, total }),
    summary: {
      totalCollected: summary.PAID?.total || 0,
      totalPending: summary.PENDING?.total || 0,
      pendingCount: summary.PENDING?.count || 0,
      totalRefunded: summary.REFUNDED?.total || 0,
    },
  };
}

export async function createPayment(data, actor, req) {
  const student = await Student.exists({ _id: data.student, deletedAt: null });
  if (!student) throw ApiError.badRequest('Invalid student reference', 'INVALID_STUDENT_REF');

  const payment = await Payment.create({ ...data, createdBy: actor._id });
  await recordAuditLog({ actor, action: 'payment.created', entityType: 'Payment', entityId: payment._id, metadata: { amount: payment.amount }, req });
  emitEvent.paymentCreated(payment);
  return payment;
}

export async function updatePaymentStatus(id, status, actor, req) {
  const payment = await Payment.findOne({ _id: id, deletedAt: null });
  if (!payment) throw ApiError.notFound('Payment record not found', 'PAYMENT_NOT_FOUND');

  payment.status = status;
  if (status === 'PAID') payment.paidAt = new Date();
  await payment.save();

  await recordAuditLog({ actor, action: `payment.status.${status.toLowerCase()}`, entityType: 'Payment', entityId: payment._id, req });
  if (status === 'PAID') {
    await notifyAllAdmins({
      excludeAdminId: actor._id,
      type: 'PAYMENT',
      title: 'Payment received',
      message: `A payment of ${payment.currency} ${payment.amount} was marked as paid.`,
      relatedEntityType: 'Payment',
      relatedEntityId: payment._id,
    });
  }
  emitEvent.paymentUpdated(payment);
  return payment;
}

/**
 * Ingests a real, signature-verified Razorpay payment event bridged in from
 * student/backend (see routes/internal.routes.js). Idempotent on
 * `sourceId` (student/backend's Order _id) - a retried webhook delivery
 * must not create a duplicate ledger row. No `actor` here (there is no
 * admin user behind this write) - `recordAuditLog` tolerates a missing
 * actor and the entry is attributed to the bridge itself in `actorName`.
 * The real-time socket emit still fires so connected admins see it land
 * live, same as any other payment.
 */
export async function ingestBridgedPayment(data) {
  const existing = await Payment.findOne({ sourceId: data.sourceId });
  if (existing) {
    const becamePaid = existing.status !== 'PAID' && data.status === 'PAID';
    existing.status = data.status;
    if (data.status === 'PAID') existing.paidAt = new Date();
    // A payment commonly pushes here twice: once on a failed verify attempt
    // (razorpayPaymentId not yet known), then again on a successful retry
    // with the same sourceId - without re-syncing these fields, the retry's
    // real payment id was silently lost forever (confirmed via live QA:
    // the order document had it, the admin ledger never did).
    if (data.razorpayPaymentId) existing.razorpayPaymentId = data.razorpayPaymentId;
    if (data.razorpayOrderId) existing.razorpayOrderId = data.razorpayOrderId;
    await existing.save();
    await recordAuditLog({
      actor: { name: 'Razorpay Bridge', role: 'SYSTEM' },
      action: 'payment.bridged',
      entityType: 'Payment',
      entityId: existing._id,
      metadata: { sourceId: data.sourceId, status: data.status, amount: existing.amount },
    });
    emitEvent.paymentUpdated(existing);
    // Mirrors the create-branch and the manual updatePaymentStatus path
    // below - a status transition into PAID via a retried/delayed webhook
    // must still surface to admins, not just the initial ingest.
    if (becamePaid) {
      await notifyAllAdmins({
        type: 'PAYMENT',
        title: 'Course payment received',
        message: `${existing.externalStudentName || 'A student'} paid ${existing.currency} ${existing.amount}${existing.courseTitle ? ` for "${existing.courseTitle}"` : ''}.`,
        relatedEntityType: 'Payment',
        relatedEntityId: existing._id,
      });
    }
    return existing;
  }

  const payment = await Payment.create({
    externalStudentName: data.studentName || null,
    externalStudentEmail: data.studentEmail || null,
    amount: data.amountInPaise / 100,
    currency: data.currency || 'INR',
    status: data.status,
    method: 'OTHER',
    courseTitle: data.courseTitle || null,
    reference: data.razorpayPaymentId || data.razorpayOrderId || null,
    description: `Razorpay course purchase${data.courseTitle ? `: ${data.courseTitle}` : ''}`,
    paidAt: data.status === 'PAID' ? new Date() : undefined,
    source: 'razorpay',
    sourceId: data.sourceId,
    razorpayOrderId: data.razorpayOrderId || null,
    razorpayPaymentId: data.razorpayPaymentId || null,
  });

  await recordAuditLog({
    actor: { name: 'Razorpay Bridge', role: 'SYSTEM' },
    action: 'payment.bridged',
    entityType: 'Payment',
    entityId: payment._id,
    metadata: { sourceId: data.sourceId, status: data.status, amount: payment.amount, courseTitle: payment.courseTitle },
  });

  emitEvent.paymentCreated(payment);
  if (payment.status === 'PAID') {
    await notifyAllAdmins({
      type: 'PAYMENT',
      title: 'Course payment received',
      message: `${payment.externalStudentName || 'A student'} paid ${payment.currency} ${payment.amount}${payment.courseTitle ? ` for "${payment.courseTitle}"` : ''}.`,
      relatedEntityType: 'Payment',
      relatedEntityId: payment._id,
    });
  }
  return payment;
}

export default { listPayments, createPayment, updatePaymentStatus, ingestBridgedPayment };
