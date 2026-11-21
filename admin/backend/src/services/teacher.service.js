import crypto from 'node:crypto';
import { Teacher } from '../models/Teacher.js';
import { Course } from '../models/Course.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, parseSort } from '../utils/pagination.js';
import { generateSecureToken, hashToken } from '../utils/tokens.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { notifyAllAdmins } from './notification.service.js';
import { emitEvent } from '../sockets/index.js';
import * as emailService from './email.service.js';
import { provisionTeacherAccount, setTeacherCoursesOnPortal, setTeacherAccountStatus } from './teacherBridge.service.js';
import { generateTempPassword } from '../utils/tempPassword.js';
import { fetchStudentCourseCatalog } from './studentCourseBridge.service.js';
import { publishFacultyToStudents, retractFacultyFromStudents } from './studentFacultyBridge.service.js';
import { env } from '../config/env.js';

const SORTABLE_FIELDS = ['name', 'email', 'department', 'status', 'rating', 'createdAt', 'lastActive'];
const INVITATION_TTL_HOURS = 24;
/**
 * A second "resend" inside this window is almost certainly a double click, and
 * each one replaces the password just emailed - production saw ten resends in
 * two seconds, which leaves the teacher with ten emails of which only one works.
 */
const RESEND_COOLDOWN_MS = 30 * 1000;

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

/** A teacher as it may be broadcast: never the password hash, which a freshly created document still carries. */
function publicShape(teacher) {
  const { passwordHash, ...rest } = teacher.toObject ? teacher.toObject() : teacher;
  return rest;
}

/**
 * Puts the teacher's public profile on the student site, or takes it down.
 *
 * Called after every change that could affect what the About page shows. A
 * teacher who is suspended, deactivated or deleted is withdrawn whatever the
 * flag says - a public page must never introduce somebody who no longer teaches
 * here. Best-effort like the other bridges, with the real outcome recorded on
 * the teacher rather than assumed; the caller still has to save.
 */
async function syncFacultyProfile(teacher) {
  const shouldShow = Boolean(teacher.showOnWebsite) && teacher.status === 'ACTIVE' && !teacher.deletedAt;
  const result = shouldShow
    ? await publishFacultyToStudents(teacher)
    : await retractFacultyFromStudents(String(teacher._id));

  teacher.facultySyncedAt = new Date();
  // NOT_CONFIGURED is not a failure: this deployment simply has no student
  // portal wired up, and claiming "failed" would be a false alarm.
  teacher.facultySyncStatus = result.synced ? 'synced' : result.reason === 'NOT_CONFIGURED' ? null : 'failed';
  return result;
}

export async function listTeachers(query) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE_FIELDS);

  const filter = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = new RegExp(escapeRegex(query.department), 'i');
  if (query.subject) filter.subject = new RegExp(escapeRegex(query.subject), 'i');
  if (query.course) filter['assignedCourses.slug'] = String(query.course).toLowerCase();
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
 * Checks a set of course slugs against the live student catalogue - the one
 * place PRARAMBH, GARUD and YODDHA actually exist - and returns them with their
 * titles.
 *
 * A catalogue that cannot be reached is an error, not "no courses": a teacher
 * must never be created or assigned against courses nobody could check, and
 * accepting unverified slugs would let a typo silently grant access to nothing.
 */
async function resolveCourses(slugs) {
  const wanted = [...new Set((slugs || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
  if (!wanted.length) return [];

  const catalog = await fetchStudentCourseCatalog();
  if (!catalog.ok) {
    throw ApiError.serviceUnavailable(
      'The course catalogue could not be reached, so the courses could not be verified. Nothing was changed - please try again in a moment.',
      'COURSE_CATALOG_UNAVAILABLE'
    );
  }
  const bySlug = new Map((catalog.courses || []).map((c) => [String(c.slug).toLowerCase(), c]));
  const unknown = wanted.filter((slug) => !bySlug.has(slug));
  if (unknown.length) {
    throw ApiError.badRequest(`Unknown course: ${unknown.join(', ')}. Choose from the course list.`, 'COURSE_NOT_FOUND', { unknown });
  }
  return wanted.map((slug) => ({ slug, title: bySlug.get(slug).title, assignedAt: new Date() }));
}

/** The Teacher Portal's own address: an explicit override, else what it reported, else what we last learned. */
function portalBase(teacher, reported) {
  const known = env.teacherPortalUrl || reported || (teacher.portalLoginUrl ? teacher.portalLoginUrl.replace(/\/login$/, '') : '');
  return String(known || '').replace(/\/+$/, '');
}

/** A password hash nobody can use: this record does not authenticate anyone (the Teacher Portal does). */
async function unusablePasswordHash() {
  return Teacher.hashPassword(crypto.randomBytes(32).toString('base64url'));
}

/** Records the outcome of an email attempt on the teacher exactly as it happened. The caller saves. */
function recordEmailOutcome(teacher, result) {
  teacher.emailLastAttemptAt = new Date();
  teacher.emailAttempts = (teacher.emailAttempts || 0) + 1;
  teacher.credentialEmailSent = Boolean(result.delivered);
  if (result.delivered) {
    teacher.credentialEmailSentAt = new Date();
    teacher.emailDeliveryStatus = 'sent';
    teacher.emailDeliveryError = null;
    teacher.emailProviderMessageId = result.messageId || null;
  } else {
    teacher.emailDeliveryStatus = result.stubbed ? 'stubbed' : result.notSent ? 'not_sent' : 'failed';
    teacher.emailDeliveryError = String(result.detail || result.reason || 'The email could not be sent.').slice(0, 400);
    teacher.emailProviderMessageId = null;
  }
}

/** Pushes the teacher's assigned set to the Teacher Portal and records whether it was accepted. The caller saves. */
async function syncCoursesToPortal(teacher, warnings) {
  const result = await setTeacherCoursesOnPortal({
    email: teacher.email,
    courses: (teacher.assignedCourses || []).map((c) => ({ slug: c.slug, title: c.title })),
  });
  teacher.courseSyncedAt = new Date();
  teacher.courseSyncStatus = result.applied ? 'synced' : 'failed';
  teacher.courseSyncError = result.applied ? null : String(result.error || result.reason || 'The Teacher Portal did not accept the courses.').slice(0, 300);
  if (!result.applied) warnings.push('COURSE_SYNC_FAILED');
  return result;
}

/**
 * Issues a teacher's sign-in details and emails them - the one sequence behind
 * both creating a teacher and "Resend login details", in this order:
 *
 *   1. generate a fresh temporary password;
 *   2. have the Teacher service create the login, or re-link the one it already
 *      has for this email, store the password's hash, and read it back;
 *   3. only if that verified, email exactly that password.
 *
 * Step 3 waiting on step 2 is the fix. Before, the email went out whatever the
 * Teacher service answered, and it answered "email already taken" for every
 * teacher who had been deleted here and created again - so those teachers were
 * emailed a password their login never had, and were told "invalid email or
 * password". The plaintext exists only in this function and the email: it is
 * never stored, logged or returned.
 *
 * Mutates the teacher's provisioning state; the caller records the email
 * outcome and saves.
 */
async function issueCredentials(teacher, { isResend, warnings }) {
  const tempPassword = generateTempPassword();
  const portal = await provisionTeacherAccount({
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    title: teacher.designation,
    department: teacher.department,
    subject: teacher.subject,
    teacherId: teacher.teacherId,
    avatarUrl: teacher.avatar || undefined,
    tempPassword,
  });

  if (!portal.provisioned) {
    // A resend that cannot reach the Teacher Portal changes nothing there: the
    // last password sent still works, so the record keeps saying it has a login.
    if (!isResend) teacher.portalProvisioned = false;
    warnings.push('PORTAL_PROVISIONING_FAILED');
    return {
      portal,
      email: {
        delivered: false,
        notSent: true,
        reason: 'PORTAL_PROVISIONING_FAILED',
        detail: isResend
          ? 'The Teacher Portal could not be reached, so no new password was issued and nothing was emailed. The password sent before still works. Please try again in a moment.'
          : 'The Teacher Portal login could not be created, so no email was sent - its password would not have worked. Use "Resend login details" once the Teacher Portal is reachable.',
      },
    };
  }

  teacher.portalProvisioned = true;
  if (portal.portalUrl) teacher.portalLoginUrl = `${portal.portalUrl}/login`;

  // The Teacher ID in the email must be one the login accepts. A new login takes
  // the one asked for unless it was taken there; a re-linked one keeps its own.
  if (portal.teacherCode && portal.teacherCode !== teacher.teacherId) {
    const clash = await Teacher.exists({ teacherId: portal.teacherCode, _id: { $ne: teacher._id } });
    if (clash) warnings.push('TEACHER_ID_MISMATCH');
    else teacher.teacherId = portal.teacherCode;
  }

  // The login exists now, so the courses can follow it. A resend only re-sends
  // a set the Teacher Portal has not accepted yet.
  if ((teacher.assignedCourses || []).length && (!isResend || teacher.courseSyncStatus !== 'synced')) {
    await syncCoursesToPortal(teacher, warnings);
  }

  const base = portalBase(teacher, portal.portalUrl);
  let email;
  if (!base) {
    email = {
      delivered: false,
      notSent: true,
      reason: 'PORTAL_URL_UNKNOWN',
      detail: 'The Teacher Portal address is not known, so there is no sign-in page to send the teacher to. Set TEACHER_PORTAL_URL, then use "Resend login details".',
    };
  } else {
    const message = emailService.teacherCredentialsEmail({
      name: teacher.name,
      teacherId: teacher.teacherId,
      email: teacher.email,
      tempPassword,
      loginUrl: `${base}/login`,
      courses: teacher.assignedCourses || [],
      isResend,
    });
    email = await emailService.send({ to: teacher.email, ...message });
  }
  if (!email.delivered) warnings.push('EMAIL_DELIVERY_FAILED');
  return { portal, email };
}

/**
 * Creates a teacher: a governance record here, a real working login on
 * teacher/backend (a separate service - see teacherBridge.service.js), the
 * courses they were assigned, and an email with their sign-in details.
 *
 * An email that belongs to a teacher who was deleted brings that teacher back -
 * same record, same Teacher ID, their history intact - rather than being refused
 * or creating a second identity for one person; the Teacher service likewise
 * re-links its existing login. An email in use by a current teacher is refused.
 *
 * Every step that can fail records exactly what happened and is returned as a
 * warning, because a failure on any of them means the teacher cannot get in or
 * sees nothing yet (master doc §41) - none is best-effort-and-silent.
 *
 * `courseSlugs` are verified against the live catalogue BEFORE anything is
 * created, so a bad course leaves no half-made teacher behind.
 */
export async function createTeacher(data, actor, req) {
  const { courseSlugs, ...fields } = data;
  const email = String(fields.email).trim().toLowerCase();

  const existing = await Teacher.findOne({ email });
  if (existing && !existing.deletedAt) throw ApiError.conflict('A teacher with this email already exists', 'TEACHER_EMAIL_EXISTS');

  const courses = await resolveCourses(courseSlugs);

  let teacher;
  const restored = Boolean(existing);
  if (existing) {
    Object.assign(existing, fields, {
      email,
      deletedAt: null,
      status: 'ACTIVE',
      suspensionReason: undefined,
      assignedCourses: courses,
      passwordHash: await unusablePasswordHash(),
      portalProvisioned: false,
      credentialEmailSent: false,
      emailDeliveryStatus: null,
      emailDeliveryError: null,
      emailProviderMessageId: null,
      emailLastAttemptAt: null,
      emailAttempts: 0,
      setupLinkExpiresAt: null,
      courseSyncStatus: null,
      courseSyncError: null,
    });
    await existing.save();
    teacher = existing;
  } else {
    teacher = await Teacher.create({
      ...fields,
      email,
      teacherId: await nextTeacherId(),
      status: 'ACTIVE',
      passwordHash: await unusablePasswordHash(),
      assignedCourses: courses,
    });
  }

  const warnings = [];
  const { portal, email: emailResult } = await issueCredentials(teacher, { isResend: false, warnings });

  await recordAuditLog({
    actor,
    action: 'teacher.provisioned',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { email: teacher.email, provisioned: portal.provisioned, relinked: Boolean(portal.relinked), reason: portal.reason, status: portal.status },
    result: portal.provisioned ? 'SUCCESS' : 'FAILURE',
    req,
  });

  if (!portal.provisioned && courses.length) {
    teacher.courseSyncStatus = 'failed';
    teacher.courseSyncError = 'Not sent: the Teacher Portal login could not be created.';
  }
  recordEmailOutcome(teacher, emailResult);

  // Only if the admin asked for it - a new teacher is not public by default.
  if (teacher.showOnWebsite) {
    const facultyResult = await syncFacultyProfile(teacher);
    if (!facultyResult.synced && facultyResult.reason !== 'NOT_CONFIGURED') warnings.push('WEBSITE_PROFILE_NOT_PUBLISHED');
  }

  await teacher.save();

  await recordAuditLog({
    actor,
    action: restored ? 'teacher.restored' : 'teacher.created',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: {
      email: teacher.email,
      teacherId: teacher.teacherId,
      courses: courses.map((c) => c.slug),
      portalProvisioned: teacher.portalProvisioned,
      relinked: Boolean(portal.relinked),
      emailDeliveryStatus: teacher.emailDeliveryStatus,
      courseSyncStatus: teacher.courseSyncStatus,
    },
    req,
  });
  emitEvent.teacherCreated(publicShape(teacher));

  return { teacher, warnings, restored, relinked: Boolean(portal.relinked) };
}

/**
 * "Resend login details": a NEW temporary password, issued to the Teacher
 * Portal login and then emailed - for a teacher whose email never arrived, who
 * lost it, or who is locked out. Every earlier temporary password stops working,
 * and the teacher must choose a new one at sign-in.
 *
 * If the Teacher Portal login was never created (the original creation could not
 * reach it) this creates it; if it was deactivated, this re-links it. A burst of
 * clicks sends one email: the cooldown is claimed atomically, so concurrent
 * requests cannot all pass the check before any of them records an attempt.
 */
export async function resendCredentials(id, actor, req) {
  const current = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!current) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');
  if (current.status === 'SUSPENDED') throw ApiError.badRequest('Cannot resend credentials to a suspended teacher.', 'TEACHER_SUSPENDED');
  if (current.status === 'INACTIVE') throw ApiError.badRequest('Reactivate this teacher before sending them sign-in details.', 'TEACHER_INACTIVE');

  const now = new Date();
  const teacher = await Teacher.findOneAndUpdate(
    {
      _id: current._id,
      deletedAt: null,
      $or: [{ emailLastAttemptAt: null }, { emailLastAttemptAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } }],
    },
    { $set: { emailLastAttemptAt: now } },
    { new: true }
  );
  if (!teacher) {
    throw ApiError.tooMany('Sign-in details were only just sent. Please wait a few seconds before sending them again.', 'RESEND_TOO_SOON');
  }

  const warnings = [];
  const { portal, email: emailResult } = await issueCredentials(teacher, { isResend: true, warnings });

  await recordAuditLog({
    actor,
    action: 'teacher.provisioned',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { email: teacher.email, provisioned: portal.provisioned, relinked: Boolean(portal.relinked), reason: portal.reason, status: portal.status, resend: true },
    result: portal.provisioned ? 'SUCCESS' : 'FAILURE',
    req,
  });

  recordEmailOutcome(teacher, emailResult);
  await teacher.save();

  await recordAuditLog({
    actor,
    action: 'teacher.credentials.resent',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: { email: teacher.email, portalProvisioned: teacher.portalProvisioned, emailDeliveryStatus: teacher.emailDeliveryStatus },
    result: emailResult.delivered ? 'SUCCESS' : 'FAILURE',
    req,
  });
  emitEvent.teacherUpdated(publicShape(teacher));

  return { teacher, warnings };
}

/**
 * Delivers a teacher's self-service password-reset link on the Teacher
 * service's behalf (it has no mail sender of its own). The Teacher service has
 * already checked the account, created the link and stored its hash; this only
 * sends the fixed reset template.
 *
 * Refuses a teacher this portal knows to be deleted, suspended or inactive, and
 * a link that does not point at the Teacher Portal's own password page, so the
 * relay cannot be used to mail anything else to anyone.
 */
export async function sendTeacherPasswordResetEmail({ email, name, teacherId, resetUrl, expiresAt }) {
  const address = String(email).trim().toLowerCase();
  const record = await Teacher.findOne({ email: address }).select('status deletedAt portalLoginUrl name teacherId');
  if (record && (record.deletedAt || record.status === 'SUSPENDED' || record.status === 'INACTIVE')) {
    return { delivered: false, reason: 'TEACHER_NOT_ACTIVE' };
  }

  let url;
  try {
    url = new URL(resetUrl);
  } catch {
    return { delivered: false, reason: 'BAD_LINK' };
  }
  const expectedBase = portalBase(record || {}, null);
  const pathOk = url.pathname === '/setup-password' && /^[A-Za-z0-9_-]{32,128}$/.test(url.searchParams.get('token') || '');
  const originOk = /^https?:$/.test(url.protocol) && (!expectedBase || url.origin === new URL(expectedBase).origin);
  if (!pathOk || !originOk) return { delivered: false, reason: 'BAD_LINK' };

  const message = emailService.teacherPasswordResetEmail({
    name: record?.name || name || 'there',
    teacherId: record?.teacherId || teacherId || null,
    resetUrl: url.toString(),
    expiresAt,
  });
  const result = await emailService.send({ to: address, ...message });
  return { delivered: Boolean(result.delivered), reason: result.delivered ? null : result.reason || 'NOT_SENT' };
}

/**
 * Replaces the full set of courses assigned to a teacher.
 *
 * Several teachers may hold the same course, and a teacher may hold any number.
 * Taking a course away also takes its students out of that teacher's portal in
 * the same step. The outcome of telling the Teacher Portal is recorded and
 * returned - if it was not accepted, the teacher would see the wrong students,
 * and saying so is the whole point - and sending the same set again is always
 * safe, which is what "Retry" does.
 */
export async function setTeacherCourses(id, slugs, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');

  const courses = await resolveCourses(slugs);
  const before = new Set((teacher.assignedCourses || []).map((c) => c.slug));
  const kept = new Map((teacher.assignedCourses || []).map((c) => [c.slug, c.assignedAt]));
  teacher.assignedCourses = courses.map((c) => ({ ...c, assignedAt: kept.get(c.slug) || c.assignedAt }));

  const warnings = [];
  if (teacher.portalProvisioned) {
    await syncCoursesToPortal(teacher, warnings);
  } else {
    teacher.courseSyncedAt = new Date();
    teacher.courseSyncStatus = 'failed';
    teacher.courseSyncError = 'The Teacher Portal login has not been created yet. Use "Resend login details" first; the courses are sent with it.';
    warnings.push('COURSE_SYNC_FAILED');
  }
  await teacher.save();

  const after = new Set(courses.map((c) => c.slug));
  await recordAuditLog({
    actor,
    action: 'teacher.courses.updated',
    entityType: 'Teacher',
    entityId: teacher._id,
    metadata: {
      added: [...after].filter((s) => !before.has(s)),
      removed: [...before].filter((s) => !after.has(s)),
      courseSyncStatus: teacher.courseSyncStatus,
    },
    result: teacher.courseSyncStatus === 'synced' ? 'SUCCESS' : 'FAILURE',
    req,
  });
  emitEvent.teacherUpdated(publicShape(teacher));

  return { teacher, warnings };
}

/** Courses an administrator authored and named this teacher instructor of - separate from the catalogue courses assigned above. */
export async function getTeacherAuthoredCourses(teacherId) {
  return Course.find({ instructor: teacherId, deletedAt: null }).select('title code slug status').lean();
}

export async function updateTeacher(id, data, actor, req) {
  const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
  if (!teacher) throw ApiError.notFound('Teacher not found', 'TEACHER_NOT_FOUND');

  Object.assign(teacher, data);
  await teacher.save();

  // The public profile follows what the admin just set - including being taken
  // down when they switch it off.
  await syncFacultyProfile(teacher);
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
  await syncFacultyProfile(teacher);
  await teacher.save();
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
  await syncFacultyProfile(teacher);
  await teacher.save();
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
  await syncFacultyProfile(teacher);
  await teacher.save();
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
  getTeacherAuthoredCourses,
  createTeacher,
  resendCredentials,
  sendTeacherPasswordResetEmail,
  setTeacherCourses,
  updateTeacher,
  deleteTeacher,
  resendInvite,
  revokeInvite,
  suspendTeacher,
  reactivateTeacher,
  verifyInviteToken,
  activateTeacherAccount,
};
