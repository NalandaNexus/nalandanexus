import { Student } from '../models/Student.js';
import { recordAuditLog } from './auditLog.service.js';
import { emitEvent } from '../sockets/index.js';

/**
 * Students who enrolled through the student portal, as this portal's Students
 * list shows them.
 *
 * The student portal owns their identity; it sends each student's current
 * record here whenever something that list shows changes (see
 * student/backend/src/services/portalSync.service.js). Before that existed this
 * database never heard about a portal student at all - the payment ledger got a
 * row, the Students list got nothing - so an admin could not see who had enrolled.
 *
 * Keyed on the student portal's user id, which never changes. Repeating the
 * same record (a retried payment, a replayed webhook, the retry sweep) updates
 * the one record it already made. A record older than the one already applied
 * is ignored, so two deliveries crossing in flight cannot put an old name back.
 *
 * Only the shared fields are written. Status, soft deletion, batch, department,
 * semester, GPA and attendance belong to this portal and are never touched.
 */

const SYSTEM_ACTOR = { name: 'Student Portal Sync', role: 'SYSTEM' };

// The fields a sync may change, compared to decide whether anything did.
const COMPARED = ['name', 'email', 'phone', 'avatar', 'guardianName', 'grade', 'enrollmentNumber', 'profileComplete', 'portalEnrollments', 'portalUserId', 'rollNo'];

function sharedFields(record) {
  const fields = {
    name: record.fullName,
    guardianName: record.guardianName || null,
    grade: record.grade || null,
    profileComplete: Boolean(record.profileComplete),
    profileCompletedAt: record.profileCompletedAt || null,
    portalEnrollments: (record.enrollments || []).map((e) => ({
      enrollmentId: e.enrollmentId || null,
      courseSlug: e.courseSlug || null,
      courseTitle: e.courseTitle || null,
      status: e.status,
      enrolledAt: e.enrolledAt || null,
      endsAt: e.endsAt || null,
      batchCode: e.batchCode || null,
    })),
    portalSyncedAt: new Date(record.sourceUpdatedAt),
  };
  // Present values only: an empty one on the portal must not wipe what an admin
  // recorded on a record that predates the sync.
  if (record.enrollmentNumber) fields.enrollmentNumber = record.enrollmentNumber;
  if (record.phone) fields.phone = record.phone;
  if (record.avatar) fields.avatar = record.avatar;
  return fields;
}

const changedFields = (before, after) =>
  COMPARED.filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));

const duplicateKey = (err) => (err?.code === 11000 ? Object.keys(err.keyPattern || err.keyValue || {})[0] || 'unknown' : null);

function log(entry) {
  console.log('[portalStudentSync]', JSON.stringify({ source: 'student-portal', destination: 'admin', at: new Date().toISOString(), ...entry }));
}

async function announce(outcome, doc, changed, extra = {}) {
  const studentId = String(doc._id);
  await recordAuditLog({
    actor: SYSTEM_ACTOR,
    action: outcome === 'created' ? 'student.portal_synced.created' : 'student.portal_synced.updated',
    entityType: 'Student',
    entityId: doc._id,
    metadata: { portalUserId: doc.portalUserId, enrollmentNumber: doc.enrollmentNumber || null, changed, ...extra },
  });
  // Ids only. The Students page refetches through its permission-checked API on
  // these events, so nothing about the student rides the broadcast itself.
  const payload = { id: studentId, source: 'student-portal' };
  if (outcome === 'created') emitEvent.studentCreated(payload);
  else emitEvent.studentUpdated(payload);
}

/**
 * Creates or updates the record for one portal student.
 *
 * Returns { outcome: 'created' | 'updated' | 'unchanged' | 'stale', studentId, changed }.
 */
export async function upsertPortalStudent(record, { attempt = 1 } = {}) {
  const userId = String(record.userId);
  const email = String(record.email).toLowerCase();
  const syncedAt = new Date(record.sourceUpdatedAt);

  // The portal user id first. Failing that, the email: an admin may already have
  // entered this student by hand, and a deleted-and-recreated portal account
  // keeps its verified address - either way it is the same person, and a second
  // record would split them in two.
  let before = await Student.findOne({ portalUserId: userId }).lean();
  let linkedBy = null;
  if (!before) {
    before = await Student.findOne({ email }).lean();
    if (before) linkedBy = before.portalUserId ? 'email-relinked' : 'email';
  }

  if (!before) {
    const rollNos = [...new Set([record.enrollmentNumber, `PORTAL-${userId}`].filter(Boolean))];
    for (const rollNo of rollNos) {
      try {
        const created = await Student.create({
          ...sharedFields(record),
          email,
          // The enrollment number is the roll number a portal student has.
          rollNo,
          source: 'student-portal',
          portalUserId: userId,
          status: 'ACTIVE',
        });
        log({ event: 'student.portal_sync', status: 'created', userId, studentId: String(created._id), enrollmentNumber: created.enrollmentNumber || null });
        await announce('created', created, ['created']);
        return { outcome: 'created', studentId: String(created._id), changed: ['created'] };
      } catch (err) {
        const key = duplicateKey(err);
        if (key === 'rollNo') {
          // Either a simultaneous delivery for this same student created it first -
          // the database may report the roll number before the user id or email -
          // or an admin-entered record already uses the enrollment number. Only the
          // second is a reason to try another roll number; the first must update,
          // or a new student would be listed twice. Checked by query rather than
          // left to the portalUserId index, which production does not build
          // automatically.
          if (attempt === 1 && (await Student.exists({ $or: [{ portalUserId: userId }, { email }] }))) {
            return upsertPortalStudent(record, { attempt: 2 });
          }
          continue;
        }
        // A delivery of the same student created it a moment ago; update that one.
        if ((key === 'portalUserId' || key === 'email') && attempt === 1) return upsertPortalStudent(record, { attempt: 2 });
        throw err;
      }
    }
    throw new Error(`No roll number is free for portal student ${userId}.`);
  }

  const set = { ...sharedFields(record), portalUserId: userId };
  if (email !== before.email) set.email = email;
  // A record created before its enrollment number existed gets it as the roll number.
  if (before.source === 'student-portal' && record.enrollmentNumber && String(before.rollNo).startsWith('PORTAL-')) {
    set.rollNo = record.enrollmentNumber;
  }

  // Conditional on age, in the same operation as the write, so an older record
  // can never land after a newer one.
  const filter = { _id: before._id, $or: [{ portalSyncedAt: null }, { portalSyncedAt: { $lte: syncedAt } }] };
  let after = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      after = await Student.findOneAndUpdate(filter, { $set: set }, { new: true, runValidators: true }).lean();
      break;
    } catch (err) {
      const key = duplicateKey(err);
      if (key === 'email' && set.email) {
        log({ event: 'student.portal_sync', status: 'email_conflict', userId, studentId: String(before._id), error: 'Another student record holds the new email; the previous email was kept.' });
        delete set.email;
        continue;
      }
      if (key === 'rollNo' && set.rollNo) {
        delete set.rollNo;
        continue;
      }
      throw err;
    }
  }

  if (!after) {
    log({ event: 'student.portal_sync', status: 'stale', userId, studentId: String(before._id) });
    return { outcome: 'stale', studentId: String(before._id), changed: [] };
  }

  const changed = changedFields(before, after);
  if (!changed.length) return { outcome: 'unchanged', studentId: String(after._id), changed };

  log({ event: 'student.portal_sync', status: 'updated', userId, studentId: String(after._id), enrollmentNumber: after.enrollmentNumber || null, changed, linkedBy });
  await announce('updated', after, changed, linkedBy ? { linkedBy } : {});
  return { outcome: 'updated', studentId: String(after._id), changed };
}

export default { upsertPortalStudent };
