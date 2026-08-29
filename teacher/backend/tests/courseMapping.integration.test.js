import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, createTeacherAndLogin } from './helpers/testApp.js';

/**
 * The legacy class -> student course mapping workflow, end to end.
 *
 * Every case here reproduces a state that actually occurred in production or a
 * failure mode the repair path has to survive. The headline one: eight batches
 * were created before `studentCourseSlug` existed, so `syncEnrollmentForClass`
 * returned NOT_LINKED before it ever called the student portal and their
 * rosters could never be verified — with no UI anywhere that could set the
 * field. These tests assert that such a batch is repairable, that the repair is
 * validated, and that everything around it stays honest about what happened.
 */

let ctx;
let api;
let student;
let SchoolClass;
let Student;

const COURSES = [
  { slug: 'physics-foundation', title: 'Physics Foundation', category: 'Science', isPurchasable: true, priceInPaise: 100000 },
  { slug: 'maths-advanced', title: 'Maths Advanced', category: 'Science', isPurchasable: true, priceInPaise: 150000 },
  // Reserved for the teacher-for-course test: that assertion depends on NO class
  // anywhere linking to the slug beforehand, and the suite shares one database.
  { slug: 'chemistry-basics', title: 'Chemistry Basics', category: 'Science', isPurchasable: false, priceInPaise: 0 },
];

before(async () => {
  ctx = await bootTestApp();
  api = ctx.api;
  student = ctx.student;
  ({ SchoolClass } = await import('../src/models/SchoolClass.js'));
  ({ Student } = await import('../src/models/Student.js'));
});

after(async () => {
  await ctx.teardown();
});

beforeEach(() => {
  student.reset();
  student.state.courses = COURSES;
});

async function signIn(label) {
  const email = `${label}.${Math.random().toString(36).slice(2, 8)}@nalanda.test`;
  return createTeacherAndLogin(api, { name: `Teacher ${label}`, email });
}

/** Creates a batch the way the 2026-08-18 seed did: no studentCourseSlug field at all. */
async function createLegacyBatch(teacherId, name = 'Class 10A') {
  const cls = await SchoolClass.collection.insertOne({
    code: `LEGACY-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
    name,
    teacher: teacherId,
    status: 'active',
    capacity: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return String(cls.insertedId);
}

// --- Acceptance 1 & 4: a legacy batch is repairable and the mapping persists ---

test('a legacy batch with no studentCourseSlug field can be mapped, and the value persists', async () => {
  const { teacher, cookie } = await signIn('legacy');
  const classId = await createLegacyBatch(teacher._id);

  const before = await SchoolClass.findById(classId).lean();
  assert.equal(before.studentCourseSlug, undefined, 'precondition: the field is absent, not merely null');

  const res = await api('PATCH', `/api/teacher/classes/${classId}`, {
    cookie,
    body: { studentCourseSlug: 'physics-foundation' },
  });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.studentCourseSlug, 'physics-foundation');
  assert.equal(res.body.data.courseTitle, 'Physics Foundation');

  const persisted = await SchoolClass.findById(classId).lean();
  assert.equal(persisted.studentCourseSlug, 'physics-foundation', 'the mapping must survive in the database');

  // And it is still there on a fresh read through the API, not just in the
  // response the write returned.
  const reread = await api('GET', `/api/teacher/classes/${classId}`, { cookie });
  assert.equal(reread.body.data.studentCourseSlug, 'physics-foundation');
});

// --- Acceptance 3 & 11: the backend validates the course, never the client ---

test('an unknown course slug is rejected with 422 and nothing is written', async () => {
  const { teacher, cookie } = await signIn('fakeslug');
  const classId = await createLegacyBatch(teacher._id);

  const res = await api('PATCH', `/api/teacher/classes/${classId}`, {
    cookie,
    body: { studentCourseSlug: 'fake-course' },
  });

  assert.equal(res.status, 422, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'COURSE_SLUG_UNKNOWN');

  const after = await SchoolClass.findById(classId).lean();
  assert.ok(!after.studentCourseSlug, 'a rejected link must leave the batch untouched');
});

test('malformed slug values are all rejected and none reach the database', async () => {
  const { teacher, cookie } = await signIn('malformed');
  const classId = await createLegacyBatch(teacher._id);

  const cases = [
    ['empty string', ''],
    ['whitespace only', '   '],
    ['html', '<b>physics-foundation</b>'],
    ['script tag', '<script>alert(1)</script>'],
    ['path traversal', '../../etc/passwd'],
    ['special characters', 'physics foundation!'],
    ['very long', 'a'.repeat(500)],
    ['wrong type - number', 12345],
    ['wrong type - array', ['physics-foundation']],
    ['mongo operator object', { $ne: null }],
    ['mongo regex object', { $regex: '.*' }],
  ];

  for (const [label, value] of cases) {
    const res = await api('PATCH', `/api/teacher/classes/${classId}`, {
      cookie,
      body: { studentCourseSlug: value },
    });
    assert.ok(
      res.status === 422 || res.status === 400,
      `${label}: expected a 4xx rejection, got ${res.status} ${JSON.stringify(res.body)}`
    );
  }

  const after = await SchoolClass.findById(classId).lean();
  assert.ok(!after.studentCourseSlug, 'no malformed value may be stored');
});

test('the course catalogue being unreachable fails closed instead of accepting any slug', async () => {
  const { teacher, cookie } = await signIn('outage');
  const classId = await createLegacyBatch(teacher._id);

  student.state.down = true;

  const res = await api('PATCH', `/api/teacher/classes/${classId}`, {
    cookie,
    body: { studentCourseSlug: 'anything-at-all' },
  });

  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'COURSE_CATALOG_UNAVAILABLE');

  const after = await SchoolClass.findById(classId).lean();
  assert.ok(!after.studentCourseSlug, 'an unverifiable link must not be written');
});

test('a catalogue error response is also treated as unavailable, not as an empty catalogue', async () => {
  const { teacher, cookie } = await signIn('catalog500');
  const classId = await createLegacyBatch(teacher._id);

  student.state.catalogStatus = 500;

  const res = await api('PATCH', `/api/teacher/classes/${classId}`, {
    cookie,
    body: { studentCourseSlug: 'physics-foundation' },
  });

  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'COURSE_CATALOG_UNAVAILABLE');
});

// --- Acceptance 5, 6, 7: real enrollment is found and linked ---

test('mapping a batch lets sync find and link the real existing enrollment', async () => {
  const { teacher, cookie } = await signIn('enroll');
  const classId = await createLegacyBatch(teacher._id);

  student.state.enrolledBySlug['physics-foundation'] = [
    { userId: '650000000000000000000001', name: 'Real Student', email: 'Real.Student@example.com', avatar: null },
  ];

  // Before mapping: sync short-circuits and reports it plainly.
  const notLinked = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });
  assert.equal(notLinked.status, 200);
  assert.equal(notLinked.body.data.outcome, 'NOT_LINKED');
  assert.equal(notLinked.body.data.totalEnrolled, 0);
  assert.match(notLinked.body.message, /not linked to a course/i);

  await api('PATCH', `/api/teacher/classes/${classId}`, { cookie, body: { studentCourseSlug: 'physics-foundation' } });

  const synced = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });
  assert.equal(synced.status, 200, JSON.stringify(synced.body));
  assert.equal(synced.body.data.outcome, 'SYNCED');
  assert.equal(synced.body.data.created, 1);
  assert.equal(synced.body.data.totalEnrolled, 1);

  // The teacher can now actually see the student.
  const roster = await api('GET', `/api/teacher/classes/${classId}/students`, { cookie });
  assert.equal(roster.body.data.length, 1);
  assert.equal(roster.body.data[0].email, 'real.student@example.com');
  assert.equal(roster.body.data[0].verified, true, 'the row must be verified against the real enrollment');
});

// --- Acceptance 9: repeated sync is idempotent ---

test('running sync repeatedly does not duplicate roster rows', async () => {
  const { teacher, cookie } = await signIn('idempotent');
  const classId = await createLegacyBatch(teacher._id);

  student.state.enrolledBySlug['maths-advanced'] = [
    { userId: '650000000000000000000002', name: 'Repeat Student', email: 'repeat@example.com', avatar: null },
  ];

  await api('PATCH', `/api/teacher/classes/${classId}`, { cookie, body: { studentCourseSlug: 'maths-advanced' } });

  const first = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });
  const second = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });
  const third = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });

  assert.equal(first.body.data.created, 1);
  assert.equal(second.body.data.created, 0, 'a second sync must not re-create the student');
  assert.equal(second.body.data.linked, 0);
  assert.equal(third.body.data.created, 0);

  const rows = await Student.countDocuments({ class: classId });
  assert.equal(rows, 1, 'exactly one roster row after three syncs');
});

test('concurrent syncs do not race into duplicate roster rows', async () => {
  const { teacher, cookie } = await signIn('concurrent');
  const classId = await createLegacyBatch(teacher._id);

  student.state.enrolledBySlug['maths-advanced'] = [
    { userId: '650000000000000000000003', name: 'Race Student', email: 'race@example.com', avatar: null },
  ];
  await api('PATCH', `/api/teacher/classes/${classId}`, { cookie, body: { studentCourseSlug: 'maths-advanced' } });

  await Promise.all([
    api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie }),
    api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie }),
    api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie }),
  ]);

  const rows = await Student.countDocuments({ class: classId });
  assert.equal(rows, 1, 'three simultaneous syncs must still produce one row');
});

// --- Acceptance 10 / Phase 10: mapping success is not enrollment success ---

test('a correctly mapped course with no enrollments reports that honestly', async () => {
  const { teacher, cookie } = await signIn('noenroll');
  const classId = await createLegacyBatch(teacher._id);

  await api('PATCH', `/api/teacher/classes/${classId}`, { cookie, body: { studentCourseSlug: 'physics-foundation' } });

  const res = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });
  assert.equal(res.body.data.outcome, 'NO_ENROLLMENTS');
  assert.equal(res.body.data.totalEnrolled, 0);
  assert.match(res.body.message, /no active enrollments/i);
  assert.doesNotMatch(res.body.message, /^Enrollment synced/, 'must not claim students were imported');
});

// --- Phase 18: an unreachable student portal must never de-verify a roster ---

test('a sync during a student-portal outage errors instead of unlinking verified students', async () => {
  const { teacher, cookie } = await signIn('outagesync');
  const classId = await createLegacyBatch(teacher._id);

  student.state.enrolledBySlug['physics-foundation'] = [
    { userId: '650000000000000000000004', name: 'Verified Student', email: 'verified@example.com', avatar: null },
  ];
  await api('PATCH', `/api/teacher/classes/${classId}`, { cookie, body: { studentCourseSlug: 'physics-foundation' } });
  await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });

  const linkedBefore = await Student.countDocuments({ class: classId, linkedUserId: { $ne: null } });
  assert.equal(linkedBefore, 1);

  // The student portal goes down; the roster must be left exactly as it was.
  student.state.enrolledStatus = 500;
  const res = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });

  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'ENROLLMENT_SOURCE_UNAVAILABLE');

  const linkedAfter = await Student.countDocuments({ class: classId, linkedUserId: { $ne: null } });
  assert.equal(linkedAfter, 1, 'an outage must not clear verification');
});

test('a genuinely revoked enrollment still unlinks the roster row without deleting it', async () => {
  const { teacher, cookie } = await signIn('revoked');
  const classId = await createLegacyBatch(teacher._id);

  student.state.enrolledBySlug['physics-foundation'] = [
    { userId: '650000000000000000000005', name: 'Refunded Student', email: 'refunded@example.com', avatar: null },
  ];
  await api('PATCH', `/api/teacher/classes/${classId}`, { cookie, body: { studentCourseSlug: 'physics-foundation' } });
  await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });

  // A real answer that no longer contains them - a refund, not an outage.
  student.state.enrolledBySlug['physics-foundation'] = [];
  const res = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.unlinked, 1);
  assert.equal(await Student.countDocuments({ class: classId }), 1, 'the row is kept, only its verification is cleared');
  assert.equal(await Student.countDocuments({ class: classId, linkedUserId: { $ne: null } }), 0);
});

// --- Acceptance 10 (authorization) / Phase 12 ---

test('a teacher cannot map, read, or sync another teacher batch', async () => {
  const owner = await signIn('owner');
  const attacker = await signIn('attacker');
  const classId = await createLegacyBatch(owner.teacher._id);

  const mapped = await api('PATCH', `/api/teacher/classes/${classId}`, {
    cookie: attacker.cookie,
    body: { studentCourseSlug: 'physics-foundation' },
  });
  assert.equal(mapped.status, 404, 'another teacher batch must be indistinguishable from a missing one');

  const read = await api('GET', `/api/teacher/classes/${classId}`, { cookie: attacker.cookie });
  assert.equal(read.status, 404);

  const synced = await api('POST', `/api/teacher/classes/${classId}/sync-enrollment`, { cookie: attacker.cookie });
  assert.equal(synced.status, 404);

  const after = await SchoolClass.findById(classId).lean();
  assert.ok(!after.studentCourseSlug, 'the batch must be untouched');
});

test('an unauthenticated request cannot map a batch', async () => {
  const { teacher } = await signIn('anon');
  const classId = await createLegacyBatch(teacher._id);

  const res = await api('PATCH', `/api/teacher/classes/${classId}`, {
    body: { studentCourseSlug: 'physics-foundation' },
  });
  assert.equal(res.status, 401);

  const after = await SchoolClass.findById(classId).lean();
  assert.ok(!after.studentCourseSlug);
});

// --- Phase 7: the edit must not overwrite anything it was not asked to ---

test('a mapping PATCH cannot reassign ownership or overwrite unrelated fields', async () => {
  const owner = await signIn('massassign');
  const other = await signIn('victim');
  const classId = await createLegacyBatch(owner.teacher._id);

  await SchoolClass.updateOne({ _id: classId }, { room: 'Lab 1', schedule: 'Mon 3PM', academicSession: '2025-2026' });
  const before = await SchoolClass.findById(classId).lean();

  const res = await api('PATCH', `/api/teacher/classes/${classId}`, {
    cookie: owner.cookie,
    body: {
      studentCourseSlug: 'physics-foundation',
      teacher: String(other.teacher._id),
      code: 'HIJACKED',
      academicSession: '1999-2000',
      createdAt: '1999-01-01T00:00:00.000Z',
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const after = await SchoolClass.findById(classId).lean();
  assert.equal(after.studentCourseSlug, 'physics-foundation', 'the intended change applies');
  assert.equal(String(after.teacher), String(owner.teacher._id), 'ownership must not move');
  assert.equal(after.code, before.code, 'code must not change');
  assert.equal(after.academicSession, before.academicSession, 'unlisted fields must not change');
  assert.equal(after.room, 'Lab 1', 'unrelated fields are preserved');
  assert.equal(after.schedule, 'Mon 3PM');
});

test('a roster PATCH cannot forge the verified-enrollment link', async () => {
  const { teacher, cookie } = await signIn('forge');
  const classId = await createLegacyBatch(teacher._id);

  const created = await api('POST', '/api/teacher/students', {
    cookie,
    body: { name: 'Unverified Person', email: 'unverified@example.com', classId },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const studentId = created.body.data.id;

  const res = await api('PATCH', `/api/teacher/students/${studentId}`, {
    cookie,
    body: { name: 'Renamed Person', linkedUserId: '650000000000000000000099' },
  });
  assert.ok(res.status < 400, JSON.stringify(res.body));

  const row = await Student.findById(studentId).lean();
  assert.equal(row.name, 'Renamed Person', 'the legitimate edit applies');
  assert.equal(row.linkedUserId, null, 'verification cannot be set by the client');
});

// --- Phase 14: existing valid classes keep working; nothing is auto-mapped ---

test('a batch created through the normal flow keeps working and is never auto-mapped', async () => {
  const { cookie } = await signIn('regression');

  const created = await api('POST', '/api/teacher/classes', {
    cookie,
    body: { name: 'Morning Batch A', studentCourseSlug: 'maths-advanced', room: 'Room 2', capacity: 40 },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.studentCourseSlug, 'maths-advanced');
  assert.equal(created.body.data.linkState, 'LINKED_NO_ENROLLMENT');

  // An unrelated edit must not disturb the existing mapping.
  const renamed = await api('PATCH', `/api/teacher/classes/${created.body.data.id}`, {
    cookie,
    body: { name: 'Morning Batch A (renamed)' },
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.studentCourseSlug, 'maths-advanced', 'the mapping survives an unrelated edit');
  assert.equal(renamed.body.data.name, 'Morning Batch A (renamed)');
});

test('creating a batch against a nonexistent course is rejected', async () => {
  const { cookie } = await signIn('badcreate');
  const res = await api('POST', '/api/teacher/classes', {
    cookie,
    body: { name: 'Orphan Batch', studentCourseSlug: 'does-not-exist' },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'COURSE_SLUG_UNKNOWN');
});

// --- Phase 17: the list must report the real state, never a flattering one ---

test('listClasses reports each batch real link state', async () => {
  const { teacher, cookie } = await signIn('states');

  const unlinkedId = await createLegacyBatch(teacher._id, 'Unlinked Batch');

  const brokenId = await createLegacyBatch(teacher._id, 'Broken Batch');
  await SchoolClass.updateOne({ _id: brokenId }, { studentCourseSlug: 'course-that-was-removed' });

  const mappedId = await createLegacyBatch(teacher._id, 'Mapped Batch');
  await SchoolClass.updateOne({ _id: mappedId }, { studentCourseSlug: 'physics-foundation' });

  const verifiedId = await createLegacyBatch(teacher._id, 'Verified Batch');
  await SchoolClass.updateOne({ _id: verifiedId }, { studentCourseSlug: 'maths-advanced' });
  student.state.enrolledBySlug['maths-advanced'] = [
    { userId: '650000000000000000000006', name: 'Enrolled One', email: 'enrolled.one@example.com', avatar: null },
  ];
  await api('POST', `/api/teacher/classes/${verifiedId}/sync-enrollment`, { cookie });

  const res = await api('GET', '/api/teacher/classes', { cookie });
  const byName = Object.fromEntries(res.body.data.map((c) => [c.name, c]));

  assert.equal(byName['Unlinked Batch'].linkState, 'UNLINKED');
  assert.equal(byName['Broken Batch'].linkState, 'LINK_BROKEN');
  assert.equal(byName['Mapped Batch'].linkState, 'LINKED_NO_ENROLLMENT');
  assert.equal(byName['Verified Batch'].linkState, 'LINKED_VERIFIED');
});

test('a catalogue outage does not falsely brand every linked batch as broken', async () => {
  const { teacher, cookie } = await signIn('outagestate');
  const classId = await createLegacyBatch(teacher._id, 'Linked During Outage');
  await SchoolClass.updateOne({ _id: classId }, { studentCourseSlug: 'physics-foundation' });

  student.state.down = true;
  const res = await api('GET', '/api/teacher/classes', { cookie });

  const cls = res.body.data.find((c) => c.name === 'Linked During Outage');
  assert.notEqual(cls.linkState, 'LINK_BROKEN', 'an unreachable catalogue is not evidence the link is broken');
  assert.equal(cls.linkState, 'LINKED_NO_ENROLLMENT');
});

// --- Phase 5: the picker reports catalogue availability honestly ---

test('course options say whether the catalogue was actually reachable', async () => {
  const { cookie } = await signIn('options');

  const ok = await api('GET', '/api/teacher/classes/course-options', { cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.meta.catalogAvailable, true);
  assert.equal(ok.body.data.length, 3);
  assert.equal(ok.body.data[0].slug, 'physics-foundation');
  assert.equal(ok.body.data[0].isPurchasable, true);

  student.state.down = true;
  const down = await api('GET', '/api/teacher/classes/course-options', { cookie });
  assert.equal(down.status, 200, 'the page still loads');
  assert.equal(down.body.meta.catalogAvailable, false, 'but it must not pass an outage off as an empty catalogue');
  assert.deepEqual(down.body.data, []);
});

// --- Phase 11: assignedTeacher resolution follows from the mapping ---

test('mapping a batch is what makes teacher-for-course resolve', async () => {
  const { teacher, cookie } = await signIn('resolve');
  const classId = await createLegacyBatch(teacher._id);

  const key = { 'X-Internal-Service-Key': 'test_service_key' };

  const before = await api('GET', '/api/internal/teacher-for-course/chemistry-basics', { headers: key });
  const beforeResolved = before.status === 200 ? before.body.data : null;
  assert.equal(beforeResolved, null, 'with no linked class there is no teacher to resolve');

  await api('PATCH', `/api/teacher/classes/${classId}`, { cookie, body: { studentCourseSlug: 'chemistry-basics' } });

  const after = await api('GET', '/api/internal/teacher-for-course/chemistry-basics', { headers: key });
  assert.equal(after.status, 200, JSON.stringify(after.body));
  assert.equal(String(after.body.data.teacherId), String(teacher._id), 'the mapping alone resolves the teacher');
});
