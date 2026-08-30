import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as teacherBridge from '../services/teacherBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

/**
 * Admin-side batch management.
 *
 * Every route here is a thin, authenticated proxy to the teacher service, which
 * owns the batch model and enforces capacity against its own counter. Keeping a
 * copy of batches in this database would give two answers to "how many seats are
 * left", so there deliberately is none.
 *
 * `actorEmail` is attached server-side from the authenticated admin so the
 * teacher service's audit trail records who really acted - a client-supplied
 * value would be an attribution forgery.
 */

export const list = catchAsync(async (req, res) => {
  const { batches, catalogAvailable } = await teacherBridge.listBatches(req.query);
  sendSuccess(res, { data: batches, meta: { catalogAvailable } });
});

export const getById = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await teacherBridge.getBatch(req.params.id) });
});

export const create = catchAsync(async (req, res) => {
  const batch = await teacherBridge.createBatch({ ...req.body, actorEmail: req.admin?.email });
  await recordAuditLog({
    actor: req.admin,
    action: 'batch.created',
    entityType: 'Batch',
    entityId: batch?.id,
    metadata: { name: batch?.name, courseSlug: batch?.courseSlug },
    req,
  });
  sendSuccess(res, { statusCode: 201, message: 'Batch created successfully', data: batch });
});

export const update = catchAsync(async (req, res) => {
  const batch = await teacherBridge.updateBatch(req.params.id, { ...req.body, actorEmail: req.admin?.email });
  await recordAuditLog({
    actor: req.admin,
    action: 'batch.updated',
    entityType: 'Batch',
    entityId: req.params.id,
    metadata: { fields: Object.keys(req.body) },
    req,
  });
  sendSuccess(res, { message: 'Batch updated successfully', data: batch });
});

export const reassignTeacher = catchAsync(async (req, res) => {
  const batch = await teacherBridge.reassignBatchTeacher(req.params.id, {
    teacherEmail: req.body.teacherEmail,
    actorEmail: req.admin?.email,
  });
  await recordAuditLog({
    actor: req.admin,
    action: 'batch.teacherReassigned',
    entityType: 'Batch',
    entityId: req.params.id,
    metadata: { teacherEmail: req.body.teacherEmail },
    req,
  });
  sendSuccess(res, { message: 'Batch reassigned to the new teacher', data: batch });
});

export const listStudents = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await teacherBridge.listBatchStudents(req.params.id) });
});

export default { list, getById, create, update, reassignTeacher, listStudents };
