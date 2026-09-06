import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
let Enrollment;
let couponService;

let paidCourse;
let otherCourse;

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;
  ({ Course } = await import('../src/models/Course.js'));
  ({ Coupon } = await import('../src/models/Coupon.js'));
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

async function makeCoupon(overrides = {}) {
  const [coupon] = await couponService.generateCoupons({
    courseId: paidCourse._id,
    count: 1,
    ...overrides,
  });
  if (overrides.patch) await Coupon.updateOne({ _id: coupon._id }, overrides.patch);
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
  const created = await couponService.generateCoupons({ courseId: paidCourse._id, count: 25, batchLabel: 'launch' });

  assert.equal(created.length, 25);
  const codes = created.map((c) => c.code);
  assert.equal(new Set(codes).size, 25, 'no duplicates');

  for (const code of codes) {
    assert.match(code, /^NN[A-Z0-9]{8}$/, `unexpected shape: ${code}`);
    // The obvious sequential scheme the brief called out as unacceptable.
    assert.doesNotMatch(code, /^NNFREE\d+$/);
    assert.doesNotMatch(code, /[OIL01]/, 'ambiguous characters are excluded so codes can be read aloud');
  }
  for (const c of created) {
    assert.equal(String(c.courseId), String(paidCourse._id));
    assert.equal(c.maxUses, 1);
    assert.equal(c.discountType, 'FULL');
    assert.equal(c.usedCount, 0);
    assert.equal(c.isActive, true);
  }
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
  await couponService.generateCoupons({ courseId: paidCourse._id, count: 6 });
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
  await couponService.generateCoupons({ courseId: paidCourse._id, count: 520 });

  const res = await adminList();
  assert.equal(res.body.data.length, 500, 'the table is still paged');
  assert.equal(res.body.meta.summary.AVAILABLE, 520, 'the tile counts every coupon');
});

test('a course filter does scope the summary, because that is a real question', async () => {
  await couponService.generateCoupons({ courseId: paidCourse._id, count: 3 });
  await couponService.generateCoupons({ courseId: otherCourse._id, count: 5 });

  const scoped = await adminList(`?courseSlug=${otherCourse.slug}`);
  assert.equal(scoped.body.meta.summary.AVAILABLE, 5, 'only the selected course is counted');

  const everything = await adminList();
  assert.equal(everything.body.meta.summary.AVAILABLE, 8);
});

test('the USED filter never returns a row the table would label EXPIRED', async () => {
  await couponService.generateCoupons({ courseId: paidCourse._id, count: 2 });
  const [spent, spentThenExpired] = await Coupon.find({}).sort({ createdAt: 1 });
  await Coupon.updateOne({ _id: spent._id }, { usedCount: 1 });
  await Coupon.updateOne({ _id: spentThenExpired._id }, { usedCount: 1, expiresAt: new Date(Date.now() - 60_000) });

  const res = await adminList('?status=USED');
  const statuses = res.body.data.map((c) => c.status);
  assert.deepEqual(statuses, ['USED'], 'every row carries the badge that was asked for');
});

test('the coupon listing is unreachable without the exact service key', async () => {
  await couponService.generateCoupons({ courseId: paidCourse._id, count: 2 });

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
    .post('/api/internal/coupons')
    .set('x-internal-service-key', INTERNAL_KEY)
    .send({ courseSlug: paidCourse.slug, count: 4, batchLabel: 'Slug batch' });

  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.length, 4);
  // Bound to THIS database's course document, whatever the caller knew it as.
  assert.equal(created.body.data[0].courseId, String(paidCourse._id));

  const filtered = await adminList(`?courseSlug=${paidCourse.slug}`);
  assert.equal(filtered.body.data.length, 4, 'the slug filter finds them');
  assert.equal(filtered.body.meta.summary.AVAILABLE, 4);
});

test('an unknown course slug is refused on create and empty on list', async () => {
  await couponService.generateCoupons({ courseId: paidCourse._id, count: 2 });

  const created = await request
    .post('/api/internal/coupons')
    .set('x-internal-service-key', INTERNAL_KEY)
    .send({ courseSlug: 'no-such-course-anywhere', count: 3 });
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
    .post('/api/internal/coupons')
    .set('x-internal-service-key', INTERNAL_KEY)
    .send({ courseId: String(paidCourse._id), count: 3 });

  assert.equal(res.status, 422, 'courseSlug is required, courseId is not accepted');
  assert.equal(await Coupon.countDocuments({}), 0, 'nothing was minted');
});
