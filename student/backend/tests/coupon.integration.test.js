import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * Coupon redemption.
 *
 * A coupon here is a bearer token for a paid course, so the tests are written
 * around the ways someone would try to get more than one course out of one code:
 * using it twice, having a friend use it, pointing it at a different course,
 * racing themselves, and racing somebody else. The last one is the reason the
 * claim is a single conditional update rather than a check followed by a write.
 *
 * The Razorpay path is exercised too, because the whole point is that it did not
 * change.
 */

let ctx;
let request;
let Course;
let Coupon;
let CouponCampaign;
let Enrollment;
let couponService;

let paidCourse;
let otherCourse;

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;
  ({ Course } = await import('../src/models/Course.js'));
  ({ Coupon } = await import('../src/models/Coupon.js'));
  ({ CouponCampaign } = await import('../src/models/CouponCampaign.js'));
  ({ Enrollment } = await import('../src/models/Enrollment.js'));
  couponService = await import('../src/services/coupon.service.js');

  paidCourse = await makeCourse('coupon-paid-course', 99900);
  otherCourse = await makeCourse('coupon-other-course', 49900);
});

after(async () => {
  await ctx.teardown();
});

beforeEach(async () => {
  await Coupon.deleteMany({});
  await CouponCampaign.deleteMany({});
});

async function makeCourse(slug, priceInPaise = 99900) {
  return Course.create({
    slug,
    title: `Course ${slug}`,
    description: 'Foundation of future ready skills',
    priceInPaise,
    isPublished: true,
    isPurchasable: true,
  });
}

async function newStudent(label) {
  return registerAndLogin(request, { name: `Coupon ${label}`, email: `coupon.${label}.${Math.random().toString(36).slice(2, 7)}@example.com` });
}

let campaignSeq = 0;

/** Mints coupons under a throwaway campaign, since every coupon must belong to one. */
async function mint({ courseId = paidCourse._id, count = 1, ...rest } = {}) {
  campaignSeq += 1;
  const { coupons } = await couponService.createCampaign({
    courseId,
    name: `test-campaign-${campaignSeq}-${Math.random().toString(36).slice(2, 8)}`,
    count,
    ...rest,
  });
  return coupons;
}

async function makeCoupon(overrides = {}) {
  const { patch, ...rest } = overrides;
  const [coupon] = await mint({ count: 1, ...rest });
  if (patch) await Coupon.updateOne({ _id: coupon._id }, patch);
  return Coupon.findById(coupon._id);
}

const validate = (student, code, slug = 'coupon-paid-course') =>
  request.post('/api/coupons/validate').set(bearer(student.accessToken)).send({ code, courseSlug: slug });

const redeem = (student, code, slug = 'coupon-paid-course') =>
  request.post('/api/coupons/redeem').set(bearer(student.accessToken)).send({ code, courseSlug: slug });

// --- Test 1: a valid coupon is worth the whole price -----------------------

test('a valid coupon reports a full discount and enrolls without Razorpay', async () => {
  const student = await newStudent('valid');
  const coupon = await makeCoupon();

  const preview = await validate(student, coupon.code);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.data.valid, true);
  assert.equal(preview.body.data.originalAmountInPaise, 99900);
  assert.equal(preview.body.data.discountAmountInPaise, 99900);
  assert.equal(preview.body.data.finalAmountInPaise, 0);
  assert.equal(preview.body.data.isFree, true);

  // Preview must not consume anything.
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 0, 'validate is a preview, not a claim');

  const res = await redeem(student, coupon.code);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.paymentMethod, 'COUPON');
  assert.equal(res.body.data.amountPaidInPaise, 0);
  assert.equal(res.body.data.couponCode, coupon.code);
  assert.match(res.body.data.enrollment.enrollmentId, /^ENR-\d{4}-\d{6}$/, 'a real enrollment identity is issued');

  const after = await Coupon.findById(coupon._id);
  assert.equal(after.usedCount, 1);
  assert.equal(after.usedBy.length, 1);
  assert.equal(after.usedBy[0].amountDiscountedInPaise, 99900);
  assert.equal(after.usedBy[0].enrollmentId, res.body.data.enrollment.enrollmentId, 'the claim records where it went');

  const enrollment = await Enrollment.findOne({ userId: after.usedBy[0].userId, courseId: paidCourse._id });
  assert.ok(enrollment, 'a real enrollment exists');
  assert.equal(enrollment.status, 'active');
});

// --- Test 2 & 3: one use means one use -------------------------------------

test('the same student cannot use a coupon twice', async () => {
  const student = await newStudent('twice');
  const coupon = await makeCoupon();

  assert.equal((await redeem(student, coupon.code)).status, 201);
  const second = await redeem(student, coupon.code);

  assert.ok(second.status >= 400, 'a second redemption must be refused');
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1, 'and must not consume another use');
  assert.equal(await Enrollment.countDocuments({ courseId: paidCourse._id, userId: coupon.usedBy?.[0]?.userId }), 0);
});

test('a different student cannot use an already-used coupon', async () => {
  const first = await newStudent('firstuser');
  const second = await newStudent('seconduser');
  const coupon = await makeCoupon();

  assert.equal((await redeem(first, coupon.code)).status, 201);

  const res = await redeem(second, coupon.code);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'COUPON_EXHAUSTED');
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
});

// --- Test 4: a coupon is bound to its course -------------------------------

test('a coupon for one course does not work on another', async () => {
  const student = await newStudent('wrongcourse');
  const coupon = await makeCoupon();

  const res = await redeem(student, coupon.code, 'coupon-other-course');
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'COUPON_INVALID');
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 0);
  assert.equal(await Enrollment.countDocuments({ courseId: otherCourse._id }), 0);
});

// --- Tests 5 & 6: expiry and deactivation ----------------------------------

test('an expired coupon is refused', async () => {
  const student = await newStudent('expired');
  const coupon = await makeCoupon({ patch: { expiresAt: new Date(Date.now() - 60_000) } });

  const res = await redeem(student, coupon.code);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'COUPON_EXPIRED');
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 0);
});

test('a deactivated coupon is refused, and indistinguishably from an unknown one', async () => {
  const student = await newStudent('inactive');
  const coupon = await makeCoupon({ patch: { isActive: false } });

  const res = await redeem(student, coupon.code);
  assert.equal(res.status, 400);
  // Same answer as a code that does not exist - otherwise the endpoint confirms
  // which codes are real, which is exactly what a guesser wants.
  assert.equal(res.body.error.code, 'COUPON_INVALID');

  const unknown = await redeem(student, 'NNZZZZZZZZ');
  assert.equal(unknown.body.error.code, 'COUPON_INVALID');
  assert.equal(unknown.body.message, res.body.message, 'the two must be indistinguishable');
});

// --- Test 7: already enrolled ----------------------------------------------

test('an already-enrolled student cannot spend a coupon on that course', async () => {
  const student = await newStudent('enrolled');
  const first = await makeCoupon();
  assert.equal((await redeem(student, first.code)).status, 201);

  const second = await makeCoupon();
  const res = await redeem(student, second.code);

  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'ALREADY_ENROLLED');
  assert.equal((await Coupon.findById(second._id)).usedCount, 0, 'the second coupon must not be burned');
});

// --- Test 9: the race ------------------------------------------------------

/**
 * Two students, one single-use coupon, at the same instant. Exactly one may win,
 * and usedCount must never reach 2.
 */
test('two students redeeming the same coupon simultaneously - exactly one succeeds', async () => {
  const a = await newStudent('racea');
  const b = await newStudent('raceb');
  const coupon = await makeCoupon();

  const [resA, resB] = await Promise.all([redeem(a, coupon.code), redeem(b, coupon.code)]);
  const statuses = [resA.status, resB.status].sort();

  assert.deepEqual(statuses, [201, 400], `expected one success and one refusal, got ${statuses.join(',')}`);

  const after = await Coupon.findById(coupon._id);
  assert.equal(after.usedCount, 1, 'a one-use coupon must never record two uses');
  assert.equal(after.usedBy.length, 1);

  // Scoped to THESE two students - the suite shares one database and earlier
  // tests have enrolled other people in the same course.
  const ids = [a.user.id || a.user._id, b.user.id || b.user._id];
  const enrolled = await Enrollment.countDocuments({ courseId: paidCourse._id, userId: { $in: ids } });
  assert.equal(enrolled, 1, 'exactly one of the two racers may end up enrolled');
});

test('one student double-clicking redeem only ever gets one enrollment', async () => {
  const student = await newStudent('doubleclick');
  const coupon = await makeCoupon();

  const results = await Promise.all([redeem(student, coupon.code), redeem(student, coupon.code), redeem(student, coupon.code)]);
  const created = results.filter((r) => r.status === 201).length;

  assert.equal(created, 1, `only one redemption may succeed, ${created} did`);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
});

test('a ten-way race on one coupon yields exactly one enrollment', async () => {
  const students = await Promise.all(Array.from({ length: 10 }, (_, i) => newStudent(`swarm${i}`)));
  const coupon = await makeCoupon();

  const results = await Promise.all(students.map((s) => redeem(s, coupon.code)));
  const wins = results.filter((r) => r.status === 201).length;

  assert.equal(wins, 1, `exactly one of ten may win, ${wins} did`);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
});

// --- Security: the client never gets to name a price -----------------------

test('an amount sent by the client is ignored entirely', async () => {
  const student = await newStudent('priceinject');
  const coupon = await makeCoupon();

  const res = await request
    .post('/api/coupons/validate')
    .set(bearer(student.accessToken))
    .send({ code: coupon.code, courseSlug: 'coupon-paid-course', amount: 1, finalAmountInPaise: 1, priceInPaise: 1 });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.originalAmountInPaise, 99900, 'the price comes from the course, never the request');
  assert.equal(res.body.data.finalAmountInPaise, 0);
});

test('a partial-discount coupon cannot be redeemed for free', async () => {
  const student = await newStudent('partial');
  const coupon = await makeCoupon({ discountType: 'PERCENT', discountValue: 50 });

  const preview = await validate(student, coupon.code);
  assert.equal(preview.body.data.finalAmountInPaise, 49950, 'half of 99900');
  assert.equal(preview.body.data.isFree, false);

  const res = await redeem(student, coupon.code);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'COUPON_NOT_FULL_DISCOUNT');
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 0, 'a refused redemption must not consume a use');
});

test('coupon endpoints reject an unauthenticated caller', async () => {
  const coupon = await makeCoupon();
  assert.equal((await request.post('/api/coupons/validate').send({ code: coupon.code, courseSlug: 'coupon-paid-course' })).status, 401);
  assert.equal((await request.post('/api/coupons/redeem').send({ code: coupon.code, courseSlug: 'coupon-paid-course' })).status, 401);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 0);
});

test('malformed codes are refused without touching anything', async () => {
  const student = await newStudent('malformed');
  for (const bad of ['', '  ', 'a', '<script>alert(1)</script>', 'A'.repeat(64), { $ne: null }]) {
    const res = await request
      .post('/api/coupons/redeem')
      .set(bearer(student.accessToken))
      .send({ code: bad, courseSlug: 'coupon-paid-course' });
    assert.ok(res.status >= 400, `"${String(bad).slice(0, 16)}" should be refused, got ${res.status}`);
  }
});

test('a code is matched case-insensitively and ignoring stray whitespace', async () => {
  const student = await newStudent('casing');
  const coupon = await makeCoupon();

  const res = await validate(student, `  ${coupon.code.toLowerCase()}  `);
  assert.equal(res.status, 200, 'a code typed in lowercase with spaces is the same code');
  assert.equal(res.body.data.code, coupon.code);
});

// --- Generation ------------------------------------------------------------

test('generated codes are unique, unpredictable in shape, and bound to one course', async () => {
  const created = await mint({ count: 25 });

  assert.equal(created.length, 25);
  const codes = created.map((c) => c.code);
  assert.equal(new Set(codes).size, 25, 'no duplicates');

  for (const code of codes) {
    // NNX7-K4P9-X2: grouped for reading aloud, eight random characters.
    assert.match(code, /^NN[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}$/, `unexpected shape: ${code}`);
    // The obvious sequential scheme the brief called out as unacceptable.
    assert.doesNotMatch(code, /^NNFREE\d+$/);
    assert.doesNotMatch(code, /[OIL01]/, 'ambiguous characters are excluded so codes can be read aloud');
  }

  // Every coupon carries the terms it was minted with, and the campaign it
  // belongs to - 25 separate single-use codes, not one code worth 25 seats.
  for (const c of created) {
    assert.equal(String(c.courseId), String(paidCourse._id));
    assert.ok(c.campaignId, 'every coupon belongs to a campaign');
    assert.equal(String(c.campaignId), String(created[0].campaignId), 'all from the one campaign');
    assert.equal(c.maxUses, 1);
    assert.equal(c.discountType, 'FULL');
    assert.equal(c.usedCount, 0);
    assert.equal(c.isActive, true);
    assert.ok(c.createdAt instanceof Date);
    assert.ok(c.updatedAt instanceof Date);
  }

  // 25 coupons of one use each caps free enrollments at 25 - which is not the
  // same object as one coupon with maxUses 25, and the difference is the point.
  const totalFreeSeats = created.reduce((sum, c) => sum + c.maxUses, 0);
  assert.equal(totalFreeSeats, 25);
});

// --- Test 8: the paid path is untouched ------------------------------------

test('a student without a coupon still gets a real Razorpay order', async () => {
  const student = await newStudent('paidpath');

  const res = await request
    .post('/api/payments/orders')
    .set(bearer(student.accessToken))
    .send({ courseSlug: 'coupon-paid-course' });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.free, false, 'a paid course must still go through the gateway');
  assert.ok(res.body.data.razorpayOrderId, 'an order id is issued');
  assert.equal(res.body.data.amountInPaise, 99900, 'for the full course price');
});

// --- Admin listing: the tiles must describe the giveaway, not the filter -----

const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || 'test_internal_key';

const adminList = (query = '') =>
  request.get(`/api/internal/coupons${query}`).set('x-internal-service-key', INTERNAL_KEY);

test('the admin summary counts the whole population, not the filtered rows', async () => {
  await mint({ courseId: paidCourse._id, count: 6 });
  const all = await Coupon.find({}).sort({ createdAt: 1 });

  // Two used, one deactivated, one expired, two left.
  await Coupon.updateOne({ _id: all[0]._id }, { usedCount: 1 });
  await Coupon.updateOne({ _id: all[1]._id }, { usedCount: 1 });
  await Coupon.updateOne({ _id: all[2]._id }, { isActive: false });
  await Coupon.updateOne({ _id: all[3]._id }, { expiresAt: new Date(Date.now() - 60_000) });

  const unfiltered = await adminList();
  assert.equal(unfiltered.status, 200, JSON.stringify(unfiltered.body));
  const expected = { AVAILABLE: 2, USED: 2, EXPIRED: 1, INACTIVE: 1 };
  assert.deepEqual(unfiltered.body.meta.summary, expected);

  // Narrowing the table must not change what the tiles report. Searching a
  // single code used to show AVAILABLE 0, which reads as "nothing left" rather
  // than "you filtered it out".
  const searched = await adminList(`?search=${all[0].code}`);
  assert.equal(searched.body.data.length, 1, 'the table narrows to the one match');
  assert.deepEqual(searched.body.meta.summary, expected, 'the tiles do not narrow with it');

  const byStatus = await adminList('?status=USED');
  assert.equal(byStatus.body.data.length, 2);
  assert.deepEqual(byStatus.body.meta.summary, expected, 'nor with a status filter');
});

test('the summary is not capped by the row page limit', async () => {
  // The listing returns at most 500 rows. Counting the returned rows therefore
  // went wrong at exactly the scale where an operator starts trusting the number.
  await mint({ courseId: paidCourse._id, count: 520 });

  const res = await adminList();
  assert.equal(res.body.data.length, 500, 'the table is still paged');
  assert.equal(res.body.meta.summary.AVAILABLE, 520, 'the tile counts every coupon');
});

test('a course filter does scope the summary, because that is a real question', async () => {
  await mint({ courseId: paidCourse._id, count: 3 });
  await mint({ courseId: otherCourse._id, count: 5 });

  const scoped = await adminList(`?courseSlug=${otherCourse.slug}`);
  assert.equal(scoped.body.meta.summary.AVAILABLE, 5, 'only the selected course is counted');

  const everything = await adminList();
  assert.equal(everything.body.meta.summary.AVAILABLE, 8);
});

test('the USED filter never returns a row the table would label EXPIRED', async () => {
  await mint({ courseId: paidCourse._id, count: 2 });
  const [spent, spentThenExpired] = await Coupon.find({}).sort({ createdAt: 1 });
  await Coupon.updateOne({ _id: spent._id }, { usedCount: 1 });
  await Coupon.updateOne({ _id: spentThenExpired._id }, { usedCount: 1, expiresAt: new Date(Date.now() - 60_000) });

  const res = await adminList('?status=USED');
  const statuses = res.body.data.map((c) => c.status);
  assert.deepEqual(statuses, ['USED'], 'every row carries the badge that was asked for');
});

test('the coupon listing is unreachable without the exact service key', async () => {
  await mint({ courseId: paidCourse._id, count: 2 });

  const attempts = [
    { label: 'no key at all', headers: {} },
    { label: 'an empty key', headers: { 'x-internal-service-key': '' } },
    { label: 'a wrong key of the same length', headers: { 'x-internal-service-key': 'test_internal_KEYX'.slice(0, INTERNAL_KEY.length) } },
    { label: 'a shorter key', headers: { 'x-internal-service-key': INTERNAL_KEY.slice(0, -1) } },
    { label: 'a longer key', headers: { 'x-internal-service-key': `${INTERNAL_KEY}x` } },
    { label: 'a correct prefix', headers: { 'x-internal-service-key': INTERNAL_KEY.slice(0, 4) } },
  ];

  for (const { label, headers } of attempts) {
    const res = await request.get('/api/internal/coupons').set(headers);
    assert.ok(res.status === 401 || res.status === 403, `${label} must be refused (got ${res.status})`);
    // A length mismatch takes a different branch of the compare; it must still
    // be an ordinary refusal, not a 500 from timingSafeEqual throwing.
    assert.notEqual(res.status, 500, `${label} must not crash the handler`);
    assert.doesNotMatch(JSON.stringify(res.body ?? {}), /NN[A-Z0-9]{8}/, `${label} must not leak a code`);
  }

  const ok = await adminList();
  assert.equal(ok.status, 200, 'the correct key still works');
  assert.equal(ok.body.data.length, 2);
});

// --- The admin portal addresses courses by slug, never by _id ---------------

test('the admin portal creates and filters coupons by slug, not by _id', async () => {
  // The admin portal stores its own course documents in its own database, so
  // the _id it holds for "prarambh" is not the _id this backend holds. Sending
  // one used to fail closed but quietly: an empty coupon table, and a
  // COURSE_NOT_FOUND on create that read like "there are no coupons".
  const foreignId = '0123456789abcdef01234567';
  assert.notEqual(String(paidCourse._id), foreignId);

  const created = await request
    .post('/api/internal/coupon-campaigns')
    .set('x-internal-service-key', INTERNAL_KEY)
    .send({ courseSlug: paidCourse.slug, name: 'Slug batch', count: 4 });

  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.coupons.length, 4);
  // Bound to THIS database's course document, whatever the caller knew it as.
  assert.equal(created.body.data.coupons[0].courseId, String(paidCourse._id));

  const filtered = await adminList(`?courseSlug=${paidCourse.slug}`);
  assert.equal(filtered.body.data.length, 4, 'the slug filter finds them');
  assert.equal(filtered.body.meta.summary.AVAILABLE, 4);
});

test('an unknown course slug is refused on create and empty on list', async () => {
  await mint({ courseId: paidCourse._id, count: 2 });

  const created = await request
    .post('/api/internal/coupon-campaigns')
    .set('x-internal-service-key', INTERNAL_KEY)
    .send({ courseSlug: 'no-such-course-anywhere', name: 'Nowhere', count: 3 });
  assert.equal(created.status, 404);
  assert.equal(created.body.error.code, 'COURSE_NOT_FOUND');
  assert.equal(await Coupon.countDocuments({}), 2, 'nothing was minted');

  // Listing is a view, so an unknown slug shows nothing rather than erroring -
  // but it must not silently fall back to showing every course's coupons.
  const listed = await adminList('?courseSlug=no-such-course-anywhere');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 0);
  assert.deepEqual(listed.body.meta.summary, { AVAILABLE: 0, USED: 0, EXPIRED: 0, INACTIVE: 0 });
});

test('a raw ObjectId is rejected where a slug is expected', async () => {
  // Guards the regression directly: the admin portal used to send this shape.
  const res = await request
    .post('/api/internal/coupon-campaigns')
    .set('x-internal-service-key', INTERNAL_KEY)
    .send({ courseId: String(paidCourse._id), name: 'Raw id', count: 3 });

  assert.equal(res.status, 422, 'courseSlug is required, courseId is not accepted');
  assert.equal(await Coupon.countDocuments({}), 0, 'nothing was minted');
});

// --- Campaigns --------------------------------------------------------------

const campaignList = (query = '') =>
  request.get(`/api/internal/coupon-campaigns${query}`).set('x-internal-service-key', INTERNAL_KEY);

const createCampaignVia = (body) =>
  request.post('/api/internal/coupon-campaigns').set('x-internal-service-key', INTERNAL_KEY).send(body);

test('a campaign mints 25 single-use codes and reports its own statistics', async () => {
  const res = await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Launch 25', count: 25 });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  const { campaign, coupons } = res.body.data;
  assert.equal(coupons.length, 25);
  assert.equal(campaign.total, 25);
  assert.equal(campaign.available, 25);
  assert.equal(campaign.used, 0);

  // Every coupon carries the campaign, and every code is different.
  assert.equal(new Set(coupons.map((c) => c.code)).size, 25);
  assert.ok(coupons.every((c) => c.campaignId === campaign.id));
  assert.ok(coupons.every((c) => c.maxUses === 1));

  const listed = await campaignList();
  const mine = listed.body.data.find((c) => c.id === campaign.id);
  assert.deepEqual(
    { total: mine.total, available: mine.available, used: mine.used, expired: mine.expired, inactive: mine.inactive },
    { total: 25, available: 25, used: 0, expired: 0, inactive: 0 }
  );
});

test('redeeming one coupon moves that campaign from 25 available to 24', async () => {
  const created = await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Stats run', count: 25 });
  const { campaign, coupons } = created.body.data;

  const student = await newStudent('campaign-stats');
  const redeemed = await redeem(student, coupons[0].code);
  assert.equal(redeemed.status, 201, JSON.stringify(redeemed.body));

  const listed = await campaignList();
  const mine = listed.body.data.find((c) => c.id === campaign.id);

  // The exact shape the brief asks the dashboard to show.
  assert.deepEqual(
    { total: mine.total, available: mine.available, used: mine.used, expired: mine.expired, inactive: mine.inactive },
    { total: 25, available: 24, used: 1, expired: 0, inactive: 0 }
  );
});

test('a second campaign of the same name on the same course is refused', async () => {
  const first = await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Diwali giveaway', count: 25 });
  assert.equal(first.status, 201);

  // Re-running the generation command, or double-clicking Generate, must not
  // quietly mint a second 25 free courses.
  const second = await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Diwali giveaway', count: 25 });
  assert.equal(second.status, 409, JSON.stringify(second.body));
  assert.equal(second.body.error.code, 'CAMPAIGN_EXISTS');
  assert.equal(await Coupon.countDocuments({}), 25, 'still exactly one batch');

  // The same name on a DIFFERENT course is a different giveaway, and allowed.
  const elsewhere = await createCampaignVia({ courseSlug: otherCourse.slug, name: 'Diwali giveaway', count: 3 });
  assert.equal(elsewhere.status, 201, JSON.stringify(elsewhere.body));
});

test('concurrent identical campaign requests create exactly one campaign', async () => {
  // The pre-check is a courtesy; the unique index is what actually decides when
  // two operators click Generate at the same moment.
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      createCampaignVia({ courseSlug: paidCourse.slug, name: 'Race campaign', count: 25 })
    )
  );

  const created = results.filter((r) => r.status === 201);
  assert.equal(created.length, 1, `expected one winner, got ${results.map((r) => r.status).join(',')}`);
  assert.equal(await CouponCampaign.countDocuments({ name: 'Race campaign' }), 1);
  assert.equal(await Coupon.countDocuments({}), 25, 'exactly 25 free seats exist, not 100');
});

test('a campaign is never left holding a partial batch', async () => {
  // If minting cannot finish, the campaign must not survive claiming a count it
  // does not have - an operator would hand out codes that were never created.
  const original = crypto.randomInt;
  const campaignsBefore = await CouponCampaign.countDocuments({});
  try {
    let calls = 0;
    crypto.randomInt = (...args) => {
      calls += 1;
      if (calls > 40) throw new Error('entropy source failed');
      return original(...args);
    };
    await assert.rejects(() =>
      couponService.createCampaign({ courseId: paidCourse._id, name: 'Doomed batch', count: 25 })
    );
  } finally {
    crypto.randomInt = original;
  }

  assert.equal(await CouponCampaign.countDocuments({}), campaignsBefore, 'the campaign was rolled back');
  assert.equal(await Coupon.countDocuments({}), 0, 'and so were its coupons');

  // And the name is free again, so the operator can simply retry.
  const retry = await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Doomed batch', count: 2 });
  assert.equal(retry.status, 201, JSON.stringify(retry.body));
});

test('the export returns every code in the campaign, not a page of them', async () => {
  const created = await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Export me', count: 25 });
  const { campaign } = created.body.data;

  const res = await request
    .get(`/api/internal/coupon-campaigns/${campaign.id}/export`)
    .set('x-internal-service-key', INTERNAL_KEY);

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.coupons.length, 25);
  assert.equal(res.body.data.campaign.name, 'Export me');
});

test('campaign routes are unreachable without the service key', async () => {
  await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Guarded', count: 2 });
  const campaign = await CouponCampaign.findOne({ name: 'Guarded' });

  for (const [method, path] of [
    ['get', '/api/internal/coupon-campaigns'],
    ['post', '/api/internal/coupon-campaigns'],
    ['get', `/api/internal/coupon-campaigns/${campaign._id}/export`],
  ]) {
    const res = await request[method](path).send({});
    assert.ok(res.status === 401 || res.status === 403, `${method} ${path} must be refused`);
    assert.doesNotMatch(JSON.stringify(res.body ?? {}), /NN[A-Z0-9]{2}-/, 'no code may leak in a denial');
  }
});

test('booting the app creates no coupons of its own', async () => {
  // Coupons are free seats in a paid course. If a startup path ever minted them,
  // every deploy would quietly hand out another batch - so the app must be able
  // to start beside an empty collection and leave it empty.
  assert.equal(await Coupon.countDocuments({}), 0);
  assert.equal(await CouponCampaign.countDocuments({}), 0);

  const { createApp } = await import('../src/app.js');
  createApp();
  // A tick for anything the app might have scheduled on boot.
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(await Coupon.countDocuments({}), 0, 'starting the app minted coupons');
  assert.equal(await CouponCampaign.countDocuments({}), 0, 'starting the app created a campaign');
});

test('no student-facing response ever carries a coupon code', async () => {
  const created = await createCampaignVia({ courseSlug: paidCourse.slug, name: 'Leak check', count: 5 });
  const { coupons } = created.body.data;
  const student = await newStudent('leak-check');

  const CODE_SHAPE = /NN[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}/;

  // Everything a logged-in student can ask for, before redeeming anything.
  for (const path of ['/api/public/courses', `/api/public/courses/${paidCourse.slug}`, '/api/student/courses', '/api/student/dashboard']) {
    const res = await request.get(path).set(bearer(student.accessToken));
    assert.doesNotMatch(JSON.stringify(res.body ?? {}), CODE_SHAPE, `${path} exposed a coupon code`);
  }

  // A wrong guess must not confirm anything about the real codes either.
  const guess = await validate(student, 'NNAA-AAAA-AA');
  assert.doesNotMatch(JSON.stringify(guess.body ?? {}), CODE_SHAPE);

  // And after redeeming, the student sees their enrollment - not the code list.
  const redeemed = await redeem(student, coupons[0].code);
  assert.equal(redeemed.status, 201);
  const mine = await request.get('/api/student/courses').set(bearer(student.accessToken));
  const body = JSON.stringify(mine.body ?? {});
  for (const c of coupons.slice(1)) {
    assert.ok(!body.includes(c.code), 'an unredeemed code reached a student response');
  }
});

test('a grouped code is accepted however the separators survived the trip', async () => {
  const coupon = await makeCoupon();
  const bare = coupon.code.replace(/-/g, '');

  // Every one of these is the same code as far as a person is concerned.
  const spellings = [
    coupon.code,
    coupon.code.toLowerCase(),
    bare,
    bare.toLowerCase(),
    coupon.code.replace(/-/g, ' '),
    coupon.code.replace(/-/g, '–'), // en dash, from a phone keyboard
    `  ${coupon.code}  `,
    coupon.code.replace(/-/g, '--'),
  ];

  for (const spelling of spellings) {
    const student = await newStudent(`spelling-${Math.random().toString(36).slice(2, 7)}`);
    const res = await validate(student, spelling);
    assert.equal(res.status, 200, `"${spelling}" should be accepted, got ${res.status}`);
    assert.equal(res.body.data.code, coupon.code, 'and resolves to the canonical code');
  }
});

test('input that is not a code is still refused', async () => {
  const student = await newStudent('not-a-code');
  for (const junk of ['', '   ', '--', 'NN', '<script>alert(1)</script>', 'NN!!@@##$$', 'x'.repeat(200)]) {
    const res = await validate(student, junk);
    assert.ok(res.status >= 400, `"${junk.slice(0, 20)}" must be refused`);
    assert.notEqual(res.status, 500, 'and refused cleanly, not by crashing');
  }
});
