import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentBridge from '../services/studentCourseBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';
import { toCsv } from '../services/report.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Coupon administration.
 *
 * Coupons live in the student service's database, beside the Course they
 * discount and the Enrollment they produce, so these routes proxy to it rather
 * than keeping a second copy here - the same arrangement batch management uses.
 * A local mirror would mean two answers to "has this code been used", and that
 * question has to have exactly one.
 *
 * Every action is audit-logged with the acting admin, because a coupon is worth
 * a paid course and "who created these 25 free places" is a question somebody
 * will eventually ask.
 */

export const list = catchAsync(async (req, res) => {
  const { coupons, summary } = await studentBridge.listCoupons(req.query);
  sendSuccess(res, { data: coupons, meta: { summary } });
});

export const createCampaign = catchAsync(async (req, res) => {
  // The acting admin is taken from the session, never from the request body -
  // otherwise the record of who authorised a giveaway is whatever the caller
  // typed. The student service stores what we send it.
  const { campaign, coupons } = await studentBridge.createCampaign({
    ...req.body,
    createdByEmail: req.admin?.email || null,
    createdByName: req.admin?.name || null,
  });

  await recordAuditLog({
    actor: req.admin,
    action: 'coupon.campaign.created',
    entityType: 'CouponCampaign',
    entityId: campaign?.id || null,
    metadata: {
      name: campaign?.name || req.body.name,
      count: coupons.length,
      courseSlug: req.body.courseSlug,
      discountType: req.body.discountType || 'FULL',
      maxUsesPerCoupon: req.body.maxUses ?? 1,
      // The codes themselves are deliberately NOT logged - the audit trail is
      // read by more people than should be able to redeem a free course.
    },
    req,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: `${coupons.length} coupon(s) generated`,
    data: { campaign, coupons },
  });
});

export const listCampaigns = catchAsync(async (req, res) => {
  const campaigns = await studentBridge.listCampaigns(req.query);
  sendSuccess(res, { data: campaigns });
});

/**
 * Downloads one campaign's codes as CSV.
 *
 * Reuses the reporting module's escaping rather than joining strings here: a
 * course title with a comma in it would otherwise shift every later column, and
 * a spreadsheet that silently misaligns is worse than no export.
 *
 * Logged like any other exposure of the codes - this is the one action that puts
 * the whole list on somebody's disk.
 */
export const exportCampaign = catchAsync(async (req, res) => {
  const { campaign, coupons } = await studentBridge.exportCampaign(req.params.id);
  if (!campaign) throw ApiError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');

  await recordAuditLog({
    actor: req.admin,
    action: 'coupon.campaign.exported',
    entityType: 'CouponCampaign',
    entityId: campaign.id,
    metadata: { name: campaign.name, count: coupons.length },
    req,
  });

  const csv = toCsv(coupons, [
    { label: 'Code', value: (c) => c.code },
    { label: 'Campaign', value: () => campaign.name },
    { label: 'Course', value: (c) => c.courseTitle || '' },
    { label: 'Status', value: (c) => c.status },
    { label: 'Uses', value: (c) => `${c.usedCount}/${c.maxUses}` },
    { label: 'Redeemed By', value: (c) => c.usedBy?.[0]?.name || '' },
    { label: 'Redeemed Email', value: (c) => c.usedBy?.[0]?.email || '' },
    { label: 'Enrollment ID', value: (c) => c.usedBy?.[0]?.enrollmentId || '' },
    { label: 'Redeemed At', value: (c) => (c.usedBy?.[0]?.usedAt ? new Date(c.usedBy[0].usedAt).toISOString() : '') },
    { label: 'Expires At', value: (c) => (c.expiresAt ? new Date(c.expiresAt).toISOString() : '') },
    { label: 'Created At', value: (c) => new Date(c.createdAt).toISOString() },
  ]);

  const safeName = String(campaign.name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="nalanda-coupons-${safeName || campaign.id}.csv"`);
  return res.status(200).send(csv);
});

export const update = catchAsync(async (req, res) => {
  const coupon = await studentBridge.updateCoupon(req.params.id, req.body);
  await recordAuditLog({
    actor: req.admin,
    action: req.body.isActive === false ? 'coupon.deactivated' : 'coupon.updated',
    entityType: 'Coupon',
    entityId: req.params.id,
    metadata: { fields: Object.keys(req.body) },
    req,
  });
  sendSuccess(res, { message: 'Coupon updated successfully', data: coupon });
});

export const remove = catchAsync(async (req, res) => {
  await studentBridge.deleteCoupon(req.params.id);
  await recordAuditLog({
    actor: req.admin,
    action: 'coupon.deleted',
    entityType: 'Coupon',
    entityId: req.params.id,
    req,
  });
  sendSuccess(res, { message: 'Coupon removed successfully' });
});

export default { list, createCampaign, listCampaigns, exportCampaign, update, remove };
