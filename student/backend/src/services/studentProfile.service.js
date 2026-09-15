import { StudentProfile } from '../models/StudentProfile.js';
import { Enrollment } from '../models/Enrollment.js';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { Order } from '../models/Order.js';
import { Coupon } from '../models/Coupon.js';
import { Counter } from '../models/Counter.js';
import { AppError } from '../utils/AppError.js';

/**
 * The student profile a course requires, and the enrollment number that
 * belongs to it.
 *
 * Course access - bought, or given by a coupon - is what makes a profile
 * compulsory. A student holding any active enrolment must have a full name, a
 * parent or guardian, a class, a phone number and an enrollment number before
 * course content is served to them. Whether they paid is irrelevant: a free
 * seat is still a student somebody has to be able to reach.
 *
 * Nothing here is a second copy of something the account already owns. The
 * full name is User.name and the phone User.phone, because every other portal
 * already reads them from there; the class is the profile's existing `grade`.
 * Only the guardian and the enrollment number are new.
 *
 * Completion is worked out from those fields every time rather than stored as a
 * flag. A stored flag is a second opinion that can disagree with the data it
 * describes - a student who later cleared their phone number would still read
 * as complete.
 */

/** The classes the platform teaches (see StudentProfile.grade). */
export const CLASS_OPTIONS = Object.freeze(Array.from({ length: 10 }, (_, i) => `Class ${i + 3}`));

const NAME_MAX = 120;

// --- field rules -------------------------------------------------------------

/** Removes markup and collapses whitespace, so what is checked is exactly what is stored. */
export function cleanPersonName(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Letters (in any script), spaces, dots, apostrophes and hyphens.
 *
 * Digits are refused: a phone number typed into a name field is the mistake this
 * catches most often, and no student's or parent's name contains one.
 */
export function isValidPersonName(value) {
  const name = cleanPersonName(value);
  return name.length >= 2 && name.length <= NAME_MAX && /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u.test(name);
}

/**
 * A phone number in one stored form, or null when it is not one.
 *
 * Students and parents type Indian mobile numbers every way there is - with or
 * without +91, a leading 0, spaces and dashes - and all of those are the same
 * number, stored as +91XXXXXXXXXX. A number from anywhere else must say which
 * country it belongs to by starting with +, because without the country code the
 * digits are ambiguous.
 */
export function normalizePhone(raw) {
  const text = String(raw ?? '').trim();
  if (!text || !/^\+?[\d\s\-().]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  const indianMobile = (national) => (/^[6-9]\d{9}$/.test(national) ? `+91${national}` : null);

  if (text.startsWith('+')) {
    if (digits.startsWith('91')) return indianMobile(digits.slice(2));
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10) return indianMobile(digits);
  if (digits.length === 11 && digits.startsWith('0')) return indianMobile(digits.slice(1));
  if (digits.length === 12 && digits.startsWith('91')) return indianMobile(digits.slice(2));
  return null;
}

/**
 * Every problem with a set of profile values, in the words the student sees.
 *
 * The request validator and the service both use this, so the message on the
 * form and the rule the server enforces cannot drift apart.
 */
export function profileFieldErrors({ fullName, guardianName, grade, phone } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ path: `body.${field}`, message });

  if (!cleanPersonName(fullName)) add('fullName', 'Full name is required.');
  else if (!isValidPersonName(fullName)) add('fullName', 'Please enter a valid full name.');

  if (!cleanPersonName(guardianName)) add('guardianName', 'Parent/Guardian name is required.');
  else if (!isValidPersonName(guardianName)) add('guardianName', 'Please enter a valid parent/guardian name.');

  if (!CLASS_OPTIONS.includes(String(grade ?? '').trim())) add('grade', 'Please select your class.');

  if (!normalizePhone(phone)) add('phone', 'Please enter a valid phone number.');

  return errors;
}

// --- enrollment numbers ------------------------------------------------------

/**
 * Reduces whatever somebody typed to the one form a lookup can use.
 *
 * Read off a screen or over the phone, a number arrives in lower case, with
 * spaces, or with the dash missing or doubled. Returns null for anything that is
 * not an enrollment number at all, so a search for rubbish never reaches the
 * database.
 */
export function normalizeEnrollmentNumber(raw) {
  const compact = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const match = /^NN(\d{2})(\d{6,9})$/.exec(compact);
  return match ? `NN${match[1]}-${match[2]}` : null;
}

/**
 * The next enrollment number, e.g. NN26-000124.
 *
 * Year-scoped like enrollment IDs (see enrollment.service.js#nextEnrollmentId),
 * and drawn from the same atomic counter, so two students enrolling at the same
 * moment are always handed different numbers. The year is the year the student
 * was first given course access.
 */
export async function nextEnrollmentNumber(now = new Date()) {
  const year = now.getUTCFullYear();
  const seq = await Counter.next(`student-enrollment-number:${year}`);
  return `NN${String(year % 100).padStart(2, '0')}-${String(seq).padStart(6, '0')}`;
}

const UNNUMBERED = { $or: [{ enrollmentNumber: { $exists: false } }, { enrollmentNumber: null }] };

/**
 * The student's enrollment number, issuing one if they have none yet.
 *
 * Idempotent, and safe against itself. A student has one number for life - a
 * second course never produces a second number - so the write only lands on a
 * profile that is still unnumbered. Two requests racing (a payment callback and
 * its webhook, a double click) both draw a candidate; the conditional write lets
 * exactly one of them through, and the other reads back and returns the winner's
 * number. The losing candidate is simply never used, which leaves a gap in the
 * sequence and never a duplicate - the unique index is the final guarantee.
 *
 * Upserts, so a student whose profile record never existed still gets one.
 */
export async function ensureEnrollmentNumber(userId, { now = new Date() } = {}) {
  const current = await StudentProfile.findOne({ userId }).select('enrollmentNumber').lean();
  if (current?.enrollmentNumber) return current.enrollmentNumber;

  const candidate = await nextEnrollmentNumber(now);
  try {
    const updated = await StudentProfile.findOneAndUpdate(
      { userId, ...UNNUMBERED },
      { $set: { enrollmentNumber: candidate } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
      .select('enrollmentNumber')
      .lean();
    return updated.enrollmentNumber;
  } catch (err) {
    // A duplicate key on userId: the profile was numbered between the read above
    // and this write, so the upsert found nothing to update and tried to insert.
    if (err?.code !== 11000) throw err;
  }

  const winner = await StudentProfile.findOne({ userId }).select('enrollmentNumber').lean();
  if (winner?.enrollmentNumber) return winner.enrollmentNumber;
  throw new Error(`Could not issue an enrollment number for student ${userId}.`);
}

// --- completion ----------------------------------------------------------------

export async function hasActiveEnrollment(userId) {
  return Boolean(await Enrollment.exists({ userId, status: 'active' }));
}

/** Whether a profile is complete, and which fields are not. Pure: reads nothing. */
export function evaluateProfile(user, profile) {
  const fields = {
    fullName: user?.name || '',
    guardianName: profile?.guardianName || '',
    grade: profile?.grade || '',
    phone: user?.phone || '',
    email: user?.email || '',
    enrollmentNumber: profile?.enrollmentNumber || null,
  };
  const missing = profileFieldErrors(fields).map((e) => e.path.replace(/^body\./, ''));
  if (!fields.enrollmentNumber) missing.push('enrollmentNumber');
  return { complete: missing.length === 0, missing, fields };
}

function shapeCompletion(user, profile, enrolled) {
  const { complete, missing, fields } = evaluateProfile(user, profile);
  return {
    complete,
    // Only course access makes the profile compulsory. An account that holds no
    // course is never stopped by it.
    requiresCompletion: enrolled && !complete,
    missing,
    enrollmentNumber: fields.enrollmentNumber,
    profileCompletedAt: profile?.profileCompletedAt || null,
    fields,
    classOptions: CLASS_OPTIONS,
  };
}

/**
 * The profile form's contents.
 *
 * The enrollment number is shown on the form itself, so an enrolled student is
 * issued theirs the first time the form is opened - which also covers a student
 * who enrolled before enrollment numbers existed.
 */
export async function getProfileCompletion(user) {
  const enrolled = await hasActiveEnrollment(user._id);
  if (enrolled) await ensureEnrollmentNumber(user._id);
  const profile = await StudentProfile.findOne({ userId: user._id }).lean();
  return shapeCompletion(user, profile, enrolled);
}

/**
 * The short form returned beside a new enrolment and with the dashboard, so the
 * client knows where to send the student next.
 *
 * A student who enrolled before enrollment numbers existed is issued theirs
 * here, rather than being sent to a form only to be given a number.
 */
export async function summarizeProfileCompletion(user) {
  const enrolled = await hasActiveEnrollment(user._id);
  if (enrolled) await ensureEnrollmentNumber(user._id);
  const profile = await StudentProfile.findOne({ userId: user._id })
    .select('guardianName grade enrollmentNumber profileCompletedAt')
    .lean();
  const { complete, requiresCompletion, missing, enrollmentNumber } = shapeCompletion(user, profile, enrolled);
  return { complete, requiresCompletion, missing, enrollmentNumber };
}

/**
 * Saves the four fields a student may set on their profile.
 *
 * Validated here as well as in the request schema: this service is the
 * definition of a complete profile, and a future caller that skips the route's
 * validator must still not be able to store a profile that only looks complete.
 *
 * Nothing else is accepted - not the enrollment number, not the email, not any
 * identifier. Repeating the same request (a refresh mid-submit) stores the same
 * values and changes nothing else.
 */
export async function completeProfile(user, input) {
  const errors = profileFieldErrors(input);
  if (errors.length) {
    // The messages themselves rather than a generic line, so the response is
    // useful even to a client that does not read the per-field details.
    throw AppError.unprocessable(errors.map((e) => e.message).join(' '), 'PROFILE_INVALID', errors);
  }

  if (await hasActiveEnrollment(user._id)) await ensureEnrollmentNumber(user._id);

  user.name = cleanPersonName(input.fullName);
  user.phone = normalizePhone(input.phone);
  await user.save();

  const profile = await StudentProfile.findOneAndUpdate(
    { userId: user._id },
    { $set: { guardianName: cleanPersonName(input.guardianName), grade: String(input.grade).trim() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  // Recorded once, the first time the profile is complete. Conditional, so a
  // repeated submission cannot move it.
  if (evaluateProfile(user, profile).complete && !profile.profileCompletedAt) {
    await StudentProfile.updateOne(
      { _id: profile._id, profileCompletedAt: null },
      { $set: { profileCompletedAt: new Date() } }
    );
  }

  return getProfileCompletion(user);
}

/**
 * Refuses course content to a student whose profile is incomplete.
 *
 * `onlyIfEnrolled` is for routes that list content across every course a
 * student holds: a student with no enrolment is let through there, because the
 * lists are empty for them and the requirement is owed by course access, not by
 * having an account.
 */
export async function assertProfileComplete(user, { onlyIfEnrolled = false } = {}) {
  if (!user || user.role !== 'student') return;
  const profile = await StudentProfile.findOne({ userId: user._id }).select('guardianName grade enrollmentNumber').lean();
  const { complete, missing } = evaluateProfile(user, profile);
  if (complete) return;

  const enrolled = await hasActiveEnrollment(user._id);
  if (onlyIfEnrolled && !enrolled) return;

  // Everything filled in except a number the student cannot supply themselves:
  // an enrolment from before numbers existed. Issue it and let them through.
  if (enrolled && missing.length === 1 && missing[0] === 'enrollmentNumber') {
    await ensureEnrollmentNumber(user._id);
    return;
  }
  throw AppError.forbidden('Complete your student profile to continue to your course.', 'PROFILE_INCOMPLETE');
}

// --- lookup, for the teacher and admin portals -----------------------------------

/**
 * One student, by enrollment number.
 *
 * `scope` is how the teacher portal asks: the linked user ids, enrollment ids
 * and course slugs on the requesting teacher's own roster. A student outside it
 * comes back exactly as a number that does not exist - null - and of a student
 * inside it, only the enrolments that scope covers are returned. The teacher
 * portal re-checks the answer against its roster; this is data minimisation, so
 * another portal's student is never sent across at all.
 *
 * Unscoped (the admin portal) returns every enrolment, and `includePayments`
 * adds orders and coupon redemptions - which the admin portal only asks for when
 * the admin holds payments.view.
 */
export async function findStudentByEnrollmentNumber(raw, { scope = null, includePayments = false } = {}) {
  const enrollmentNumber = normalizeEnrollmentNumber(raw);
  if (!enrollmentNumber) return null;

  const profile = await StudentProfile.findOne({ enrollmentNumber }).lean();
  if (!profile) return null;

  const user = await User.findById(profile.userId).lean();
  if (!user || user.role !== 'student') return null;

  const enrollments = await Enrollment.find({ userId: user._id }).sort({ enrolledAt: 1 }).lean();
  const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.courseId) } }).select('slug title').lean();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  let visible = enrollments;
  if (scope) {
    const enrollmentIds = new Set((scope.enrollmentIds || []).map((id) => String(id).toUpperCase()));
    const userInScope = (scope.userIds || []).map(String).includes(String(user._id));
    const courseSlugs = new Set(scope.courseSlugs || []);
    visible = enrollments.filter((e) =>
      e.enrollmentId
        ? enrollmentIds.has(e.enrollmentId)
        : // Enrolments predating enrollment IDs can only be matched by the
          // teacher having this student linked on a batch of that course.
          userInScope && courseSlugs.has(courseById.get(String(e.courseId))?.slug)
    );
    if (!visible.length && !userInScope) return null;
  }

  const { complete } = evaluateProfile(user, profile);
  const student = {
    userId: String(user._id),
    enrollmentNumber,
    fullName: user.name,
    guardianName: profile.guardianName || null,
    grade: profile.grade || null,
    phone: user.phone || null,
    email: user.email,
    avatar: user.avatar || null,
    profileComplete: complete,
    profileCompletedAt: profile.profileCompletedAt || null,
    enrollments: visible.map((e) => ({
      enrollmentId: e.enrollmentId || null,
      courseSlug: courseById.get(String(e.courseId))?.slug || null,
      courseTitle: courseById.get(String(e.courseId))?.title || null,
      status: e.status,
      enrolledAt: e.enrolledAt,
      endsAt: e.endsAt || null,
      batchCode: e.batchCode || null,
    })),
  };

  if (!scope && includePayments) {
    const [orders, coupons] = await Promise.all([
      Order.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Coupon.find({ 'usedBy.userId': user._id }).select('code courseId discountType usedBy').lean(),
    ]);
    const redemptions = coupons.flatMap((c) =>
      (c.usedBy || [])
        .filter((u) => String(u.userId) === String(user._id))
        .map((u) => ({
          code: c.code,
          discountType: c.discountType,
          courseTitle: courseById.get(String(c.courseId))?.title || null,
          enrollmentId: u.enrollmentId || null,
          amountDiscountedInPaise: u.amountDiscountedInPaise ?? null,
          usedAt: u.usedAt,
        }))
    );
    const paidOrderIds = new Set(orders.filter((o) => o.status === 'paid').map((o) => String(o._id)));
    const couponEnrollmentIds = new Set(redemptions.map((r) => r.enrollmentId).filter(Boolean));

    student.enrollments = student.enrollments.map((e, i) => {
      const source = visible[i];
      let purchaseMethod = 'FREE';
      if (source.orderId && paidOrderIds.has(String(source.orderId))) purchaseMethod = 'RAZORPAY';
      else if (source.enrollmentId && couponEnrollmentIds.has(source.enrollmentId)) purchaseMethod = 'COUPON';
      return { ...e, purchaseMethod, orderId: source.orderId ? String(source.orderId) : null };
    });
    student.payments = orders.map((o) => ({
      orderId: String(o._id),
      courseTitle: courseById.get(String(o.courseId))?.title || null,
      status: o.status,
      amountInPaise: o.amountInPaise,
      currency: o.currency,
      razorpayOrderId: o.razorpayOrderId,
      razorpayPaymentId: o.razorpayPaymentId || null,
      createdAt: o.createdAt,
    }));
    student.couponRedemptions = redemptions;
  }

  return student;
}

// --- backfill ------------------------------------------------------------------

/**
 * Numbers every student who already holds course access but has no number.
 *
 * Deterministic: students are taken in the order they were first given access
 * (earliest active enrolment, then user id), and each number's year is the year
 * of that first enrolment - so a re-run against the same data proposes the same
 * order, and a student who enrolled in 2025 is not numbered as a 2026 student.
 *
 * Dry unless `apply`. Never touches a student who already has a number, never
 * touches anything but the number, and issues through ensureEnrollmentNumber, so
 * a backfill running beside live traffic cannot hand out a number twice.
 */
export async function backfillEnrollmentNumbers({ apply = false } = {}) {
  const firsts = await Enrollment.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$userId', firstEnrolledAt: { $min: { $ifNull: ['$enrolledAt', '$createdAt'] } } } },
    { $sort: { firstEnrolledAt: 1, _id: 1 } },
  ]);
  const userIds = firsts.map((f) => f._id);

  const [numbered, students] = await Promise.all([
    StudentProfile.find({ userId: { $in: userIds }, enrollmentNumber: { $exists: true, $ne: null } }).select('userId').lean(),
    User.find({ _id: { $in: userIds }, role: 'student' }).select('_id').lean(),
  ]);
  const numberedIds = new Set(numbered.map((p) => String(p.userId)));
  const studentIds = new Set(students.map((u) => String(u._id)));

  // A user deleted after enrolling, or a staff account, is not a student to number.
  const pending = firsts.filter((f) => studentIds.has(String(f._id)) && !numberedIds.has(String(f._id)));

  const report = {
    applied: apply,
    studentsWithCourseAccess: firsts.length,
    alreadyNumbered: numberedIds.size,
    pending: pending.length,
    plan: pending.map((p) => ({ userId: String(p._id), firstEnrolledAt: p.firstEnrolledAt })),
    assigned: [],
  };
  if (!apply) return report;

  for (const p of pending) {
    const enrollmentNumber = await ensureEnrollmentNumber(p._id, { now: p.firstEnrolledAt || new Date() });
    report.assigned.push({ userId: String(p._id), enrollmentNumber });
  }
  return report;
}

/**
 * Undoes a backfill, from the record it wrote.
 *
 * Removes a number only while the same student still holds exactly that number,
 * so reverting a stale record can never take a number off somebody else.
 */
export async function revertEnrollmentNumbers(assigned) {
  let reverted = 0;
  for (const { userId, enrollmentNumber } of assigned || []) {
    const result = await StudentProfile.updateOne({ userId, enrollmentNumber }, { $unset: { enrollmentNumber: 1 } });
    reverted += result.modifiedCount;
  }
  return { reverted };
}

export default {
  CLASS_OPTIONS,
  normalizePhone,
  normalizeEnrollmentNumber,
  ensureEnrollmentNumber,
  evaluateProfile,
  getProfileCompletion,
  summarizeProfileCompletion,
  completeProfile,
  assertProfileComplete,
  findStudentByEnrollmentNumber,
  backfillEnrollmentNumbers,
  revertEnrollmentNumbers,
};
