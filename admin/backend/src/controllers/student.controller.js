import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentService from '../services/student.service.js';
import { ApiError } from '../utils/ApiError.js';
import { lookupStudentByEnrollmentNumber, resyncPortalStudents } from '../services/studentCourseBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await studentService.listStudents(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const getById = catchAsync(async (req, res) => {
  const student = await studentService.getStudentById(req.params.id);
  return sendSuccess(res, { data: student });
});

export const create = catchAsync(async (req, res) => {
  const student = await studentService.createStudent(req.body, req.admin, req);
  return sendSuccess(res, { statusCode: 201, data: student, message: 'Student created successfully' });
});

export const update = catchAsync(async (req, res) => {
  const student = await studentService.updateStudent(req.params.id, req.body, req.admin, req);
  return sendSuccess(res, { data: student, message: 'Student updated successfully' });
});

export const remove = catchAsync(async (req, res) => {
  await studentService.deleteStudent(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Student removed successfully' });
});

/**
 * GET /api/admin/students/enrollment-number/:enrollmentNumber
 *
 * Any student, by enrollment number, from the student service. students.read
 * lets an admin search; payment status, purchase method, coupons and Razorpay
 * references are included only for an admin who also holds payments.view -
 * decided here, from the session, and passed on as a request for less data
 * rather than filtered out afterwards.
 */
export const findByEnrollmentNumber = catchAsync(async (req, res) => {
  const paymentsVisible = req.admin.hasPermission('payments.view');
  const student = await lookupStudentByEnrollmentNumber(req.params.enrollmentNumber, { includePayments: paymentsVisible });
  if (!student) throw ApiError.notFound('No student has that enrollment number.', 'STUDENT_NOT_FOUND');

  if (!paymentsVisible) {
    delete student.payments;
    delete student.couponRedemptions;
  }
  return sendSuccess(res, { data: { ...student, paymentsVisible } });
});

/**
 * POST /api/admin/students/portal-sync
 *
 * Resends portal students' records from the student service to this portal and
 * the teacher portal, for when a delivery failed. Needs students.update. A dry
 * run - counting, sending nothing - unless the body says `apply: true`, and an
 * applied run is audited against the admin who asked for it.
 */
export const syncPortalStudents = catchAsync(async (req, res) => {
  const { mode, enrollmentNumber, cursor, limit, apply } = req.body;
  const payload = { mode, limit, apply };
  if (enrollmentNumber) payload.enrollmentNumber = enrollmentNumber;
  if (cursor) payload.cursor = cursor;

  const result = await resyncPortalStudents(payload);

  if (apply) {
    await recordAuditLog({
      actor: req.admin,
      action: 'student.portal_resync',
      entityType: 'Student',
      entityRef: mode === 'one' ? enrollmentNumber : `portal-sync:${mode}`,
      metadata: {
        mode,
        cursor: cursor || null,
        outcome: {
          found: result?.found,
          status: result?.status,
          processed: result?.processed ?? result?.considered,
          synced: result?.synced,
          failed: result?.failed,
          skipped: result?.skipped,
        },
      },
      req,
    });
  }

  return sendSuccess(res, {
    data: result,
    message: apply ? 'Student records were resent to the admin and teacher portals.' : 'Dry run - nothing was sent.',
  });
});

export default { list, getById, create, update, remove, findByEnrollmentNumber, syncPortalStudents };
