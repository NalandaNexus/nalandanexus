import { Resource } from '../models/Resource.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, parseSort } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { recordAuditLog } from './auditLog.service.js';
import { emitEvent } from '../sockets/index.js';
import { publishResourceToStudents, retractResourceFromStudents } from './studentResourceBridge.service.js';

const SORTABLE_FIELDS = ['title', 'type', 'createdAt'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pushes the current resource to the Landing Page — never gated behind an approval workflow, unlike Course; admin uploads go live immediately. */
async function syncToStudentCatalog(resource) {
  const result = await publishResourceToStudents(resource);
  resource.catalogSyncedAt = new Date();
  resource.catalogSyncStatus = result.synced ? 'synced' : 'failed';
  await resource.save();
  return result;
}

export async function listResources(query) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE_FIELDS);

  const filter = { deletedAt: null };
  if (query.type) filter.type = query.type;
  if (query.search) filter.$text = { $search: query.search };

  const [items, total] = await Promise.all([
    Resource.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Resource.countDocuments(filter),
  ]);

  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }) };
}

export async function getResourceById(id) {
  const resource = await Resource.findOne({ _id: id, deletedAt: null });
  if (!resource) throw ApiError.notFound('Resource not found', 'RESOURCE_NOT_FOUND');
  return resource;
}

export async function createResource(data, actor, req) {
  const resource = await Resource.create({ ...data, createdBy: actor._id });

  await recordAuditLog({ actor, action: 'resource.created', entityType: 'Resource', entityId: resource._id, metadata: { type: resource.type }, req });
  emitEvent.resourceCreated(resource);

  const catalogSync = await syncToStudentCatalog(resource);
  await recordAuditLog({
    actor,
    action: 'resource.published',
    entityType: 'Resource',
    entityId: resource._id,
    result: catalogSync.synced ? 'SUCCESS' : 'FAILURE',
    metadata: catalogSync.synced ? undefined : { reason: catalogSync.reason },
    req,
  });

  return { resource, catalogSync };
}

export async function updateResource(id, data, actor, req) {
  const resource = await Resource.findOne({ _id: id, deletedAt: null });
  if (!resource) throw ApiError.notFound('Resource not found', 'RESOURCE_NOT_FOUND');

  Object.assign(resource, data);
  await resource.save();

  await recordAuditLog({ actor, action: 'resource.updated', entityType: 'Resource', entityId: resource._id, metadata: { fields: Object.keys(data) }, req });
  emitEvent.resourceUpdated(resource);

  const catalogSync = await syncToStudentCatalog(resource);
  return { resource, catalogSync };
}

export async function deleteResource(id, actor, req) {
  const resource = await Resource.findOne({ _id: id, deletedAt: null });
  if (!resource) throw ApiError.notFound('Resource not found', 'RESOURCE_NOT_FOUND');

  resource.deletedAt = new Date();
  await resource.save();

  await recordAuditLog({ actor, action: 'resource.deleted', entityType: 'Resource', entityId: resource._id, req });
  emitEvent.resourceDeleted(resource._id);

  await retractResourceFromStudents(String(resource._id));

  return resource;
}

export default { listResources, getResourceById, createResource, updateResource, deleteResource };
