import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, parseSort } from '../utils/pagination.js';
import { generateSecureToken, hashToken } from '../utils/tokens.js';
import { generateTempPassword } from '../utils/tempPassword.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { notifyAllAdmins } from './notification.service.js';
import { emitEvent } from '../sockets/index.js';
import * as emailService from './email.service.js';
import { provisionTeacherAccount, resetTeacherCredentials, setTeacherAccountStatus } from './teacherBridge.service.js';
import { env } from '../config/env.js';

const SORTABLE_FIELDS = ['name', 'email', 'department', 'status', 'rating', 'createdAt', 'lastActive'];
const INVITATION_TTL_HOURS = 24;

function teacherIdFor(sequence) {
  return `TCH-${String(sequence).padStart(4, '0')}`;
}

async function nextTeacherId() {
  const count = await Teacher.countDocuments();
  let id = teacherIdFor(count + 1);
  // Guard against a rare id collision (e.g. after a deletion) by probing forward.
  // eslint-disable-next-line no-await-in-loop
  while (await Teacher.exists({ teacherId: id })) {
    id = teacherIdFor(parseInt(id.split('-')[1], 10) + 1);
  }
  return id;
}

export async function listTeachers(query) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE_FIELDS);

  const filter = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = new RegExp(escapeRegex(query.department), 'i');
  if (query.subject) filter.subject = new RegExp(escapeRegex(query.subject), 'i');
  if (query.search) filter.$text = { $search: query.search };

  const [items, total] = await Promise.all([
    Teacher.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Teacher.countDocuments(filter),
  ]);

  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }) };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getTeacherById(id) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');
  return teacher;
}

/**
 * Creates a teacher: a real random temp password (never a predictable
 * string), a governance record here, a real working login provisioned on
 * teacher/backend (a separate service — see teacherBridge.service.js), and
 * a credentials email. Neither the portal login nor the email is
 * best-effort-and-silent here — both outcomes are recorded on the teacher
 * record and surfaced to the caller as `warnings`, because a failure on
 * either means the teacher genuinely cannot get in yet (master doc §41).
 */
export async function createTeacher(data, actor, req) {
  const existing = await Teacher.findOne({ email: data.email.toLowerCase() });
  if (existing) throw ApiError.conflict('A teacher with this email already exists', 'TEACHER_EMAIL_EXISTS');

  const teacherId = await nextTeacherId();
  const tempPassword = generateTempPassword();

  const teacher = await Teacher.create({
    ...data,
    email: data.email.toLowerCase(),
    teacherId,
    status: 'ACTIVE',
    passwordHash: await Teacher.hashPassword(tempPassword),
  });

  const warnings = [];

  const provisionResult = await provisionTeacherAccount({
    teacherId: teacher.teacherId,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    tempPassword,
    title: data.title,
    department: teacher.department,
    subject: teacher.subject,
  });
  teacher.portalProvisioned = provisionResult.provisioned;
  if (!provisionResult.provisioned) warnings.push('PORTAL_PROVISIONING_FAILED');

  await recordAuditLog({
    actor,
    action: 'teacher.provisioned',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { email: teacher.email, provisioned: provisionResult.provisioned, reason: provisionResult.reason },
    result: provisionResult.provisioned ? 'SUCCESS' : 'FAILURE',
    req,
  });

  const loginUrl = `${(env.teacherBridge.url || '').replace(/\/$/, '')}/login`;
  const { subject, text, html } = emailService.teacherCredentialsEmail({ name: teacher.name, email: teacher.email, tempPassword, loginUrl });
  const emailResult = await emailService.send({ to: teacher.email, subject, text, html });
  teacher.credentialEmailSent = Boolean(emailResult.delivered);
  teacher.credentialEmailSentAt = new Date();
  teacher.emailDeliveryStatus = emailResult.delivered ? 'sent' : emailResult.stubbed ? 'stubbed' : 'failed';
  if (!emailResult.delivered) warnings.push('EMAIL_DELIVERY_FAILED');

  await teacher.save();

  await recordAuditLog({
    actor,
    action: 'teacher.created',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { email: teacher.email, portalProvisioned: teacher.portalProvisioned, emailDeliveryStatus: teacher.emailDeliveryStatus },
    req,
  });
  emitEvent.teacherCreated(teacher);

  // The plaintext temp password is returned to the admin ONLY when it
  // couldn't be emailed - otherwise it's discarded here and exists only in
  // the (already-sent) email, per the "don't return sensitive credentials
  // over the wire when unnecessary" rule.
  const tempPasswordFallback = emailResult.delivered ? undefined : tempPassword;

  return { teacher, warnings, tempPasswordFallback };
}

/**
 * Resends real, working credentials to an already-created teacher whose
 * original credential email failed to deliver (or who simply needs a fresh
 * temp password issued). Generates a genuinely NEW random temp password —
 * never reuses or reveals the old one — resets it on the real teacher/backend
 * login (invalidating any existing session there), and re-sends the same
 * credentials email template used at creation time. Same honesty contract
 * as createTeacher: both outcomes are tracked and surfaced as warnings,
 * never silently assumed.
 */
export async function resendCredentials(id, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');
  if (teacher.status === 'SUSPENDED') throw ApiError.badRequest('Cannot resend credentials to a suspended teacher.', 'TEACHER_SUSPENDED');

  const tempPassword = generateTempPassword();
  teacher.passwordHash = await Teacher.hashPassword(tempPassword);

  const warnings = [];

  const resetResult = await resetTeacherCredentials({ email: teacher.email, newPassword: tempPassword });
  teacher.portalProvisioned = resetResult.reset;
  if (!resetResult.reset) warnings.push('PORTAL_PROVISIONING_FAILED');

  await recordAuditLog({
    actor,
    action: 'teacher.provisioned',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { email: teacher.email, provisioned: resetResult.reset, reason: resetResult.reason, resend: true },
    result: resetResult.reset ? 'SUCCESS' : 'FAILURE',
    req,
  });

  const loginUrl = `${(env.teacherBridge.url || '').replace(/\/$/, '')}/login`;
  const { subject, text, html } = emailService.teacherCredentialsEmail({ name: teacher.name, email: teacher.email, tempPassword, loginUrl });
  const emailResult = await emailService.send({ to: teacher.email, subject, text, html });
  teacher.credentialEmailSent = Boolean(emailResult.delivered);
  teacher.credentialEmailSentAt = new Date();
  teacher.emailDeliveryStatus = emailResult.delivered ? 'sent' : emailResult.stubbed ? 'stubbed' : 'failed';
  if (!emailResult.delivered) warnings.push('EMAIL_DELIVERY_FAILED');

  await teacher.save();

  await recordAuditLog({
    actor,
    action: 'teacher.credentials.resent',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { email: teacher.email, portalProvisioned: teacher.portalProvisioned, emailDeliveryStatus: teacher.emailDeliveryStatus },
    req,
  });
  emitEvent.teacherUpdated(teacher);

  const tempPasswordFallback = emailResult.delivered ? undefined : tempPassword;

  return { teacher, warnings, tempPasswordFallback };
}

export async function updateTeacher(id, data, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');

  Object.assign(teacher, data);
  await teacher.save();

  await recordAuditLog({ actor, action: 'teacher.updated', entityType: 'Teacher', entityId: teacher._id, metadata: { fields: Object.keys(data) }, req });
  emitEvent.teacherUpdated(teacher);
  return teacher;
}

export async function deleteTeacher(id, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');

  // Soft delete — preserves historical class/course/audit references instead
  // of orphaning them, per the "preserve academic history" requirement.
  teacher.deletedAt = new Date();
  teacher.status = 'INACTIVE';
  await teacher.save();

  // Deleting the governance record must also lock the REAL Teacher Portal
  // login - confirmed live via a QA pass that without this, a "deleted"
  // teacher could still log in and use the app indefinitely.
  const portalSync = await setTeacherAccountStatus({ email: teacher.email, status: 'inactive' });
  await recordAuditLog({
    actor,
    action: 'teacher.deleted',
    entityType: 'Teacher',
    entityId: teacher._id,
    result: portalSync.updated ? 'SUCCESS' : 'FAILURE',
    req,
  });
  emitEvent.teacherDeleted(teacher._id);
  return teacher;
}

export async function resendInvite(id, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');
  if (teacher.status !== 'INVITED') throw ApiError.badRequest('Teacher has already activated their account', 'ALREADY_ACTIVE');

  const rawToken = generateSecureToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
  teacher.invitation = { tokenHash: hashToken(rawToken), createdAt: now, expiresAt, isUsed: false };
  await teacher.save();

  const activationUrl = `${env.clientUrl}/activate?token=${rawToken}`;
  const { subject, text } = emailService.teacherInvitationEmail({ name: teacher.name, activationUrl, expiresAt });
  await emailService.send({ to: teacher.email, subject, text });

  await recordAuditLog({ actor, action: 'teacher.invite.resent', entityType: 'Teacher', entityId: teacher._id, req });
  return teacher;
}

export async function revokeInvite(id, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');
  if (teacher.status !== 'INVITED') throw ApiError.badRequest('Only pending invitations can be revoked', 'NOT_INVITED');

  teacher.deletedAt = new Date();
  teacher.status = 'INACTIVE';
  await teacher.save();

  await recordAuditLog({ actor, action: 'teacher.invite.revoked', entityType: 'Teacher', entityId: teacher._id, req });
  emitEvent.teacherDeleted(teacher._id);
  return teacher;
}

export async function suspendTeacher(id, reason, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');

  teacher.status = 'SUSPENDED';
  teacher.suspensionReason = reason;
  await teacher.save();

  // Locks the REAL Teacher Portal login too, not just admin's own
  // governance record - see teacherBridge.service.js#setTeacherAccountStatus.
  const portalSync = await setTeacherAccountStatus({ email: teacher.email, status: 'suspended' });
  await recordAuditLog({
    actor,
    action: 'teacher.suspended',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { reason },
    result: portalSync.updated ? 'SUCCESS' : 'FAILURE',
    req,
  });
  await notifyAllAdmins({
    excludeAdminId: actor._id,
    type: 'TEACHER_STATUS',
    title: 'Teacher account suspended',
    message: `${teacher.name} (${teacher.teacherId}) was suspended: ${reason}`,
    relatedEntityType: 'Teacher',
    relatedEntityId: teacher._id,
  });
  emitEvent.teacherStatusChanged(teacher);
  return teacher;
}

export async function reactivateTeacher(id, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');

  teacher.status = 'ACTIVE';
  teacher.suspensionReason = undefined;
  await teacher.save();

  const portalSync = await setTeacherAccountStatus({ email: teacher.email, status: 'active' });
  await recordAuditLog({
    actor,
    action: 'teacher.reactivated',
    entityType: 'Teacher',
    entityId: teacher._id,
    result: portalSync.updated ? 'SUCCESS' : 'FAILURE',
    req,
  });
  emitEvent.teacherStatusChanged(teacher);
  return teacher;
}

export async function requestPasswordReset(id, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');

  const rawToken = generateSecureToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  teacher.resetTokenHash = hashToken(rawToken);
  teacher.resetTokenExpiresAt = expiresAt;
  await teacher.save();

  const resetUrl = `${env.clientUrl}/activate?resetToken=${rawToken}`;
  const { subject, text } = emailService.passwordResetEmail({ name: teacher.name, resetUrl, expiresAt });
  await emailService.send({ to: teacher.email, subject, text });

  await recordAuditLog({ actor, action: 'teacher.password.reset_requested', entityType: 'Teacher', entityId: teacher._id, req });
  return { expiresAt };
}

export async function verifyInviteToken(token) {
  const tokenHash = hashToken(token);
  const teacher = await Teacher.findOne({ 'invitation.tokenHash': tokenHash, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Invitation not found', 'INVITE_NOT_FOUND');
  if (teacher.invitation.isUsed) throw ApiError.conflict('This invitation has already been used', 'INVITE_ALREADY_USED');
  if (teacher.invitation.expiresAt < new Date()) throw ApiError.badRequest('This invitation has expired', 'INVITE_EXPIRED');

  return { name: teacher.name, email: teacher.email, department: teacher.department };
}

export async function activateTeacherAccount({ token, password }) {
  const tokenHash = hashToken(token);
  const teacher = await Teacher.findOne({ 'invitation.tokenHash': tokenHash, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Invitation not found', 'INVITE_NOT_FOUND');
  if (teacher.invitation.isUsed) throw ApiError.conflict('This invitation has already been used', 'INVITE_ALREADY_USED');
  if (teacher.invitation.expiresAt < new Date()) throw ApiError.badRequest('This invitation has expired', 'INVITE_EXPIRED');

  teacher.passwordHash = await Teacher.hashPassword(password);
  teacher.status = 'ACTIVE';
  teacher.invitation.isUsed = true;
  teacher.invitation.usedAt = new Date();
  await teacher.save();

  emitEvent.teacherStatusChanged(teacher);
  return { email: teacher.email, name: teacher.name };
}

export default {
  listTeachers,
  getTeacherById,
  createTeacher,
  resendCredentials,
  updateTeacher,
  deleteTeacher,
  resendInvite,
  revokeInvite,
  suspendTeacher,
  reactivateTeacher,
  requestPasswordReset,
  verifyInviteToken,
  activateTeacherAccount,
};
