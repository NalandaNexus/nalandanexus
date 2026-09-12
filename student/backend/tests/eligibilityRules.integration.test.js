import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * Admin-configurable stage eligibility.
 *
 * Three properties matter more than the arithmetic:
 *
 *   a draft decides nothing,
 *   an unconfigured transition is shut rather than open,
 *   and evaluating eligibility changes nothing about the student.
 *
 * The last one is easy to lose: the evaluator sits inside the snapshot rebuild,
 * which does award XP and unlock achievements, so a careless change there could
 * make merely looking at a student alter them.
 */

let ctx;
let request;
let Course;
let Stage;
let Subject;
let Achievement;
let StudentProfile;
let StageEligibilityRule;
let Enrollment;
let LessonProgress;
let engine;
let course;

const KEY = 'test_internal_key';
const asService = (req) => req.set('x-internal-service-key', process.env.INTERNAL_SERVICE_KEY || KEY);

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;

  ({ Course } = await import('../src/models/Course.js'));
  ({ Stage } = await import('../src/models/Stage.js'));
  ({ Subject } = await import('../src/models/Subject.js'));
  ({ Achievement } = await import('../src/models/Achievement.js'));
  ({ StudentProfile } = await import('../src/models/StudentProfile.js'));
  ({ StageEligibilityRule } = await import('../src/models/StageEligibilityRule.js'));
  ({ Enrollment } = await import('../src/models/Enrollment.js'));
  ({ LessonProgress } = await import('../src/models/LessonProgress.js'));
  engine = await import('../src/services/progression/engine.service.js');

  const { DEFAULT_SUBJECTS } = await import('../src/models/Subject.js');
  const { DEFAULT_STAGES } = await import('../src/models/Stage.js');
  const { DEFAULT_ACHIEVEMENTS } = await import('../src/models/Achievement.js');
  await Subject.insertMany(DEFAULT_SUBJECTS.map((s) => ({ ...s })));
  await Achievement.insertMany(DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })));
  await Stage.insertMany(DEFAULT_STAGES.map((s) => ({ ...s })));

  course = await Course.create({
    slug: 'prarambh', title: 'PRARAMBH', description: 'x', priceInPaise: 0,
    isPublished: true, isPurchasable: true, pillar: 'communicate',
    durationValue: 9, durationUnit: 'MONTHS',
    modules: [
      {
        moduleId: 'm1', title: 'M1', order: 1,
        lessons: [
          { lessonId: 'l-e1', title: 'English one', order: 1, subject: 'ENGLISH' },
          { lessonId: 'l-e2', title: 'English two', order: 2, subject: 'ENGLISH' },
        ],
      },
    ],
  });
  await Stage.updateOne({ code: 'PRARAMBH' }, { $set: { courseSlug: 'prarambh' } });
});

after(async () => {
  await ctx.teardown();
});

beforeEach(async () => {
  await StageEligibilityRule.deleteMany({});
});

async function newLearner(label, name) {
  const student = await registerAndLogin(request, {
    name: name || `Elig ${label}`,
    email: `elig.${label}.${Math.random().toString(36).slice(2, 7)}@example.com`,
  });
  // registerAndLogin returns the verified user, so there is no lookup to get
  // wrong here.
  const userId = student.user._id;
  await Enrollment.create({ userId, courseId: course._id, status: 'active', enrollmentId: `ENR-E-${Math.random().toString(36).slice(2, 8)}` });
  await StudentProfile.findOneAndUpdate({ userId }, { userId }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return { ...student, userId };
}

const draft = (requirements, groups = []) => ({
  rootGroup: { logic: 'ALL', requirements: requirements.map((r, i) => ({ key: `r${i}`, enabled: true, ...r })) },
  groups,
});

// --- Configuration lifecycle -------------------------------------------------

test('a transition starts unconfigured and shut', async () => {
  const res = await asService(request.get('/api/internal/progression/eligibility'));
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const garud = res.body.data.find((r) => r.stageCode === 'GARUD');
  assert.equal(garud.status, 'NOT_CONFIGURED');
  assert.equal(garud.previousStageCode, 'PRARAMBH');

  // And the first stage is not "unconfigured" - it has no prerequisite at all.
  const prarambh = res.body.data.find((r) => r.stageCode === 'PRARAMBH');
  assert.equal(prarambh.isStartingStage, true);
  assert.equal(prarambh.status, 'STARTING_STAGE');
});

test('a draft can be saved, revised and published, and takes a version', async () => {
  const saved = await asService(request.put('/api/internal/progression/eligibility/GARUD/draft'))
    .send(draft([{ metric: 'XP', operator: 'GTE', value: 1000 }]));
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.status, 'DRAFT');
  assert.equal(saved.body.data.version, 1);

  // Revising edits the same draft rather than stacking versions.
  const revised = await asService(request.put('/api/internal/progression/eligibility/GARUD/draft'))
    .send(draft([{ metric: 'XP', operator: 'GTE', value: 2000 }]));
  assert.equal(revised.body.data.version, 1, 'still version 1 until published');

  const published = await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({
    publishedByEmail: 'admin@test.local',
  });
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.equal(published.body.data.rule.status, 'PUBLISHED');
  assert.equal(published.body.data.rule.publishedByEmail, 'admin@test.local');

  const listed = await asService(request.get('/api/internal/progression/eligibility'));
  const garud = listed.body.data.find((r) => r.stageCode === 'GARUD');
  assert.equal(garud.status, 'PUBLISHED');
  assert.equal(garud.publishedVersion, 1);
  assert.equal(garud.publishedRequirements, 1);
});

test('publishing a second version retires the first', async () => {
  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send(draft([{ metric: 'XP', operator: 'GTE', value: 100 }]));
  await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({});

  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send(draft([{ metric: 'XP', operator: 'GTE', value: 200 }]));
  const second = await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({});
  assert.equal(second.body.data.rule.version, 2);

  // Exactly one live rule per transition - the partial unique index makes that
  // structural rather than something publish has to remember.
  assert.equal(await StageEligibilityRule.countDocuments({ targetStageCode: 'GARUD', status: 'PUBLISHED' }), 1);
  assert.equal(await StageEligibilityRule.countDocuments({ targetStageCode: 'GARUD', status: 'ARCHIVED' }), 1, 'history is kept');
});

test('disabling a live rule shuts the stage rather than opening it', async () => {
  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send(draft([{ metric: 'XP', operator: 'GTE', value: 1 }]));
  await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({});

  const learner = await newLearner('disabled');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });
  let snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, true);

  await asService(request.post('/api/internal/progression/eligibility/GARUD/disable')).send({});

  snap = await engine.rebuildSnapshot(learner.userId);
  const garud = snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, false, 'no published rule means nobody passes');
  assert.equal(garud.status, 'NOT_CONFIGURED');
});

// --- Validation --------------------------------------------------------------

test('an empty rule is refused, because publishing one would lock the stage forever', async () => {
  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send(draft([]));
  const res = await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'RULE_INVALID');
  assert.match(res.body.error.message, /at least one enabled requirement/i);
});

test('invalid operator, subject and achievement references are all refused', async () => {
  const cases = [
    [{ metric: 'XP', operator: 'IS', value: 1 }, /cannot use the operator/i],
    [{ metric: 'SUBJECT_SCORE', operator: 'GTE', value: 50, subjectCode: 'NONSENSE' }, /subject that does not exist/i],
    [{ metric: 'ACHIEVEMENT', operator: 'IS', achievementCode: 'NOPE' }, /does not exist/i],
    [{ metric: 'KNOWLEDGE', operator: 'GTE', value: 500 }, /cannot exceed 100/i],
    [{ metric: 'XP', operator: 'GTE', value: -5 }, /cannot be negative/i],
  ];

  for (const [requirement, expected] of cases) {
    const res = await asService(request.post('/api/internal/progression/eligibility/GARUD/validate')).send(draft([requirement]));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.valid, false, `${requirement.metric} should be rejected`);
    assert.ok(res.body.data.errors.some((e) => expected.test(e)), `got: ${res.body.data.errors.join(' | ')}`);
  }
});

test('a subject the prerequisite stage does not teach is a warning, not a block', async () => {
  // Prarambh here teaches only English, which is the real situation.
  const res = await asService(request.post('/api/internal/progression/eligibility/GARUD/validate')).send(
    draft([{ metric: 'SUBJECT_SCORE', operator: 'GTE', value: 60, subjectCode: 'CYBERSECURITY' }])
  );

  assert.equal(res.body.data.valid, true, 'an administrator may require it knowingly');
  assert.ok(res.body.data.warnings.length > 0);
  assert.match(res.body.data.warnings[0], /no Cybersecurity activities/i);
  assert.match(res.body.data.warnings[0], /may be unable to satisfy/i);
});

// --- Evaluation --------------------------------------------------------------

async function publishFor(stage, requirements, groups = []) {
  await asService(request.put(`/api/internal/progression/eligibility/${stage}/draft`)).send(draft(requirements, groups));
  const res = await asService(request.post(`/api/internal/progression/eligibility/${stage}/publish`)).send({});
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

test('every requirement satisfied makes a student eligible', async () => {
  await publishFor('GARUD', [
    { metric: 'XP', operator: 'GTE', value: 5 },
    { metric: 'SUBJECT_SCORE', operator: 'GTE', value: 1, subjectCode: 'ENGLISH' },
  ]);

  const learner = await newLearner('all-pass');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const snap = await engine.rebuildSnapshot(learner.userId);
  const garud = snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, true);
  assert.equal(garud.status, 'ELIGIBLE');
  assert.ok(garud.requirements.every((r) => r.passed));
});

test('ANY logic passes on one satisfied requirement where ALL would not', async () => {
  const learner = await newLearner('any-logic');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  // One reachable, one not.
  const requirements = [
    { metric: 'XP', operator: 'GTE', value: 5 },
    { metric: 'XP', operator: 'GTE', value: 999999 },
  ];

  await publishFor('GARUD', requirements);
  let snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, false, 'ALL fails');

  await StageEligibilityRule.deleteMany({ targetStageCode: 'GARUD' });
  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send({
    rootGroup: { logic: 'ANY', requirements: requirements.map((r, i) => ({ key: `r${i}`, enabled: true, ...r })) },
    groups: [],
  });
  await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({});

  snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, true, 'ANY passes');
});

test('a disabled requirement is ignored', async () => {
  const learner = await newLearner('disabled-req');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send({
    rootGroup: {
      logic: 'ALL',
      requirements: [
        { key: 'r0', metric: 'XP', operator: 'GTE', value: 5, enabled: true },
        { key: 'r1', metric: 'XP', operator: 'GTE', value: 999999, enabled: false },
      ],
    },
    groups: [],
  });
  await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({});

  const snap = await engine.rebuildSnapshot(learner.userId);
  const garud = snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, true, 'the parked requirement did not count');
  assert.equal(garud.requirements.length, 1, 'nor was it reported to the student');
});

test('the boundary moves when the operator changes', async () => {
  const learner = await newLearner('boundary');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });
  const profile = await StudentProfile.findOne({ userId: learner.userId }).lean();
  const exactXp = profile.xp;

  await publishFor('GARUD', [{ metric: 'XP', operator: 'GTE', value: exactXp }]);
  let snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, true, '>= passes at the boundary');

  await StageEligibilityRule.deleteMany({ targetStageCode: 'GARUD' });
  await publishFor('GARUD', [{ metric: 'XP', operator: 'GT', value: exactXp }]);
  snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, false, '> does not');
});

test('missing attendance is reported as data required, never as zero', async () => {
  await publishFor('GARUD', [{ metric: 'ATTENDANCE', operator: 'GTE', value: 80 }]);

  const learner = await newLearner('no-attendance');
  const snap = await engine.rebuildSnapshot(learner.userId);
  const garud = snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  const attendance = garud.requirements.find((r) => r.metric === 'ATTENDANCE');

  assert.equal(attendance.status, 'DATA_REQUIRED');
  assert.equal(attendance.actual, null, 'not 0 - the student has not attended none of the classes, there are none');
  assert.equal(attendance.passed, false, 'and it does not pass by default either');
  assert.equal(garud.eligible, false);
});

test('an achievement requirement reads the real unlock', async () => {
  await publishFor('GARUD', [{ metric: 'ACHIEVEMENT', operator: 'IS', achievementCode: 'VOICE_OF_CONFIDENCE' }]);

  const learner = await newLearner('achievement-req');
  let snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, false);

  const { StudentAchievement } = await import('../src/models/StudentAchievement.js');
  await StudentAchievement.create({ userId: learner.userId, achievementCode: 'VOICE_OF_CONFIDENCE', name: 'Voice of Confidence' });

  snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, true);
});

// --- The property that is easiest to lose ------------------------------------

test('evaluating eligibility changes nothing about the student', async () => {
  await publishFor('GARUD', [{ metric: 'XP', operator: 'GTE', value: 999999 }]);

  const learner = await newLearner('side-effect-free');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 90,
    refId: 'q1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const before = await StudentProfile.findOne({ userId: learner.userId }).lean();
  const { ProgressionEvent } = await import('../src/models/ProgressionEvent.js');
  const eventsBefore = await ProgressionEvent.countDocuments({ userId: learner.userId });

  // Evaluate repeatedly, including through the admin preview.
  for (let i = 0; i < 3; i += 1) {
    await engine.rebuildSnapshot(learner.userId);
    await asService(request.post('/api/internal/progression/eligibility/preview')).send({
      userId: String(learner.userId), stageCode: 'GARUD',
    });
  }

  const after = await StudentProfile.findOne({ userId: learner.userId }).lean();
  assert.equal(after.xp, before.xp, 'XP unmoved');
  assert.equal(after.level, before.level, 'level unmoved');
  assert.equal(after.progression.overallPower, before.progression.overallPower, 'power unmoved');
  assert.equal(await ProgressionEvent.countDocuments({ userId: learner.userId }), eventsBefore, 'no events invented');
});

// --- Admin preview and overview ----------------------------------------------

test('preview explains a real student against the published rule', async () => {
  await publishFor('GARUD', [
    { metric: 'XP', operator: 'GTE', value: 999999 },
    { metric: 'SUBJECT_SCORE', operator: 'GTE', value: 1, subjectCode: 'ENGLISH' },
  ]);

  const learner = await newLearner('preview');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const res = await asService(request.post('/api/internal/progression/eligibility/preview')).send({
    userId: String(learner.userId), stageCode: 'GARUD',
  });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.eligible, false);
  assert.equal(res.body.data.missingRequirements.length, 1, 'one requirement short');
  assert.equal(res.body.data.missingRequirements[0].metric, 'XP');
  assert.ok(res.body.data.student.name.startsWith('Elig preview'), 'the preview names the student it evaluated');
});

test('preview can try a draft without publishing it', async () => {
  await publishFor('GARUD', [{ metric: 'XP', operator: 'GTE', value: 1 }]);

  const learner = await newLearner('preview-draft');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send(
    draft([{ metric: 'XP', operator: 'GTE', value: 999999 }])
  );

  const live = await asService(request.post('/api/internal/progression/eligibility/preview')).send({
    userId: String(learner.userId), stageCode: 'GARUD',
  });
  assert.equal(live.body.data.eligible, true, 'against the published rule');

  const withDraft = await asService(request.post('/api/internal/progression/eligibility/preview')).send({
    userId: String(learner.userId), stageCode: 'GARUD', useDraft: true,
  });
  assert.equal(withDraft.body.data.eligible, false, 'against the draft');
  assert.equal(withDraft.body.data.usingDraft, true);

  // And the student's own standing is still decided by the published rule.
  const snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD').eligible, true);
});

test('the student overview pages and filters in the database', async () => {
  await publishFor('GARUD', [{ metric: 'XP', operator: 'GTE', value: 999999 }]);

  for (const label of ['ov1', 'ov2', 'ov3']) {
    const learner = await newLearner(label);
    await engine.rebuildSnapshot(learner.userId);
  }

  const page = await asService(request.get('/api/internal/progression/student-eligibility?limit=2'));
  assert.equal(page.status, 200, JSON.stringify(page.body));
  assert.equal(page.body.data.length, 2, 'server-side paging, not everything at once');
  assert.ok(page.body.meta.total >= 3);
  assert.ok(page.body.meta.totalPages >= 2);

  const notEligible = await asService(
    request.get('/api/internal/progression/student-eligibility?targetStage=GARUD&eligibility=NOT_ELIGIBLE&limit=100')
  );
  assert.ok(notEligible.body.data.length >= 3);
  const row = notEligible.body.data[0];
  const garudRow = row.stages.find((s) => s.stageCode === 'GARUD');
  assert.equal(garudRow.eligible, false);
  assert.ok(garudRow.missing.length > 0, 'and names what is missing');
});

test('eligibility configuration is unreachable without the service key', async () => {
  for (const [method, path] of [
    ['get', '/api/internal/progression/eligibility'],
    ['get', '/api/internal/progression/eligibility/GARUD'],
    ['put', '/api/internal/progression/eligibility/GARUD/draft'],
    ['post', '/api/internal/progression/eligibility/GARUD/publish'],
    ['post', '/api/internal/progression/eligibility/preview'],
    ['get', '/api/internal/progression/student-eligibility'],
  ]) {
    const res = await request[method](path).send({});
    assert.ok(res.status === 401 || res.status === 403, `${method} ${path} must be guarded (got ${res.status})`);
  }
});

test('an empty group is refused at publish and unsatisfied if it ever reaches evaluation', async () => {
  // Two layers, because they fail in different directions. Validation stops an
  // administrator locking everyone out by adding a group and not filling it in;
  // the evaluator's own rule is the backstop for anything that gets past it.
  await asService(request.put('/api/internal/progression/eligibility/GARUD/draft')).send({
    rootGroup: { logic: 'ALL', requirements: [{ key: 'r0', metric: 'XP', operator: 'GTE', value: 1, enabled: true }] },
    groups: [{ logic: 'ALL', label: 'Assessment', requirements: [] }],
  });

  const published = await asService(request.post('/api/internal/progression/eligibility/GARUD/publish')).send({});
  assert.equal(published.status, 400, 'publishing an empty group is refused');
  assert.match(published.body.error.message, /no enabled requirements/i);

  // Force one past validation to prove the evaluator does not wave it through.
  await StageEligibilityRule.deleteMany({ targetStageCode: 'GARUD' });
  await StageEligibilityRule.create({
    targetStageCode: 'GARUD', previousStageCode: 'PRARAMBH', version: 1, status: 'PUBLISHED', publishedAt: new Date(),
    rootGroup: { logic: 'ALL', requirements: [{ key: 'r0', metric: 'XP', operator: 'GTE', value: 1, enabled: true }] },
    // ALL specifically: [].every() is vacuously true, so this is the shape that
    // would wave everyone through without the guard. An empty ANY group is
    // already false via [].some() and would not test anything.
    groups: [{ logic: 'ALL', label: 'Assessment', requirements: [] }],
  });

  const learner = await newLearner('empty-group');
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const snap = await engine.rebuildSnapshot(learner.userId);
  const garud = snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, false, 'an empty group is not vacuously satisfied');
});


// --- Regressions -------------------------------------------------------------

test('a search term is matched literally, not compiled as a pattern', async () => {
  // The term went into `new RegExp` unescaped. "C++" is not a valid pattern, so
  // it threw and the endpoint answered 500; "(a+)+$" is worse, because it does
  // compile and then backtracks catastrophically over every name in the
  // collection. A search box is a literal substring - nothing the caller types
  // should ever be executed as a pattern.
  await newLearner('regex-literal', 'Ravi C++ Sharma');

  const found = await asService(
    request.get('/api/internal/progression/student-eligibility').query({ search: 'C++' })
  );
  assert.equal(found.status, 200, `metacharacters must not crash the search: ${JSON.stringify(found.body)}`);
  assert.ok(
    found.body.data.some((r) => r.name === 'Ravi C++ Sharma'),
    'the literal term still finds the student it names'
  );

  // A pattern that would match everything if it were honoured as one must match
  // nobody, because no name contains those characters.
  const injected = await asService(
    request.get('/api/internal/progression/student-eligibility').query({ search: '.*' })
  );
  assert.equal(injected.status, 200);
  assert.equal(injected.body.data.length, 0, '".*" is a literal, not a wildcard');

  const redos = await asService(
    request.get('/api/internal/progression/student-eligibility').query({ search: '(a+)+$' })
  );
  assert.equal(redos.status, 200, 'a catastrophic pattern is inert once escaped');
});

test('preview reports the same previous-stage figure the live engine uses', async () => {
  // The preview passed the student's CURRENT stage progress as the previous
  // stage's, whichever transition was asked about. A student sitting on
  // PRARAMBH at 50% had that 50% reported as their GARUD completion when
  // previewing YODDHA - so the preview could clear someone the real gate
  // refuses, which is the one thing a preview must never do.
  await publishFor('YODDHA', [{ metric: 'PREVIOUS_STAGE_COMPLETION', operator: 'GTE', value: 50 }]);

  const learner = await newLearner('preview-prev-stage');
  // One of the course's two lessons: 50% through PRARAMBH, their current stage.
  // Stage progress is read from LessonProgress rather than the XP ledger, so it
  // is the lesson record - not recordActivity - that moves the figure.
  await LessonProgress.create({
    userId: learner.userId, courseId: course._id, moduleId: 'm1', lessonId: 'l-e1',
    completed: true, completedAt: new Date(),
  });
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-e1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.currentStageCode, 'PRARAMBH');
  assert.ok(snap.profile.progression.stageProgress >= 50, 'the student is at least halfway through PRARAMBH');

  const live = snap.profile.progression.eligibility.find((e) => e.stageCode === 'YODDHA');

  const preview = await asService(request.post('/api/internal/progression/eligibility/preview')).send({
    userId: String(learner.userId), stageCode: 'YODDHA',
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));

  assert.equal(
    preview.body.data.eligible,
    live.eligible,
    'the preview and the gate must reach the same verdict'
  );
  assert.equal(live.eligible, false, 'GARUD is not complete, so YODDHA stays shut');

  const previewed = preview.body.data.requirements.find((r) => r.metric === 'PREVIOUS_STAGE_COMPLETION');
  const gated = live.requirements.find((r) => r.metric === 'PREVIOUS_STAGE_COMPLETION');
  assert.equal(previewed.actual, gated.actual, 'and report the same figure for the same metric');
});

test('preview refuses an unusable student id instead of failing as a server error', async () => {
  const bad = await asService(request.post('/api/internal/progression/eligibility/preview')).send({
    userId: 'not-an-object-id', stageCode: 'GARUD',
  });
  assert.equal(bad.status, 400, 'an unparseable id is a bad request, not a 500');
  assert.equal(bad.body.error.code, 'INVALID_USER_ID');

  const missingStage = await asService(request.post('/api/internal/progression/eligibility/preview')).send({
    userId: String((await newLearner('preview-no-stage')).userId),
  });
  assert.equal(missingStage.status, 400);
});

test('the overview names the transitions it is reporting on', async () => {
  // The admin table used to hardcode PRARAMBH, GARUD and YODDHA as columns,
  // which would silently ignore a fourth stage - in a system whose entire point
  // is that the progression is configurable.
  const res = await asService(request.get('/api/internal/progression/student-eligibility'));
  assert.equal(res.status, 200);

  const codes = res.body.meta.stages.map((s) => s.code);
  assert.deepEqual(codes, ['PRARAMBH', 'GARUD', 'YODDHA'], 'every configured stage, in order');

  // The starting stage is never a column: nothing gates entry to it.
  assert.deepEqual(res.body.meta.targets, ['GARUD', 'YODDHA']);
  assert.equal(res.body.meta.stages.find((s) => s.code === 'PRARAMBH').isStartingStage, true);
});

test('the first stage cannot be validated any more than it can be drafted', async () => {
  // saveDraft already refused it; validate accepted it and answered with the
  // baffling "Previous stage undefined does not exist."
  const res = await asService(request.post('/api/internal/progression/eligibility/PRARAMBH/validate')).send({
    rootGroup: { logic: 'ALL', requirements: [{ key: 'r0', metric: 'XP', operator: 'GTE', value: 1, enabled: true }] },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'STARTING_STAGE');
});


test('the public catalogue exposes a duration that can be computed with', async () => {
  // Only the "9 Months" label was published. A client cannot add a label to a
  // date, so an enrolment window or a countdown had nothing to work from, and
  // QA could not verify the stage durations as data rather than display text.
  const list = await request.get('/api/public/courses');
  assert.equal(list.status, 200);

  const row = list.body.data.find((c) => c.slug === 'prarambh');
  assert.ok(row, 'the course is listed');
  assert.equal(row.durationValue, 9);
  assert.equal(row.durationUnit, 'MONTHS');
  // The display label is separate and set independently of these two - this
  // fixture sets only the numbers, which are the part a client computes with.
  assert.ok('duration' in row, 'the human label is still carried alongside');

  const detail = await request.get('/api/public/courses/prarambh');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.durationValue, 9, 'and on the detail route, not just the list');
  assert.equal(detail.body.data.durationUnit, 'MONTHS');
});


test('requiring completion of a stage with no lessons is warned about', async () => {
  // Production has exactly this shape: GARUD and YODDHA exist as courses with
  // zero modules and zero lessons. Stage progress is lessons-completed over
  // lessons-available and returns 0 when there is nothing available, so a
  // YODDHA rule asking for GARUD completion could never be met by anyone - and
  // would read to the student as "you have not done enough" rather than "there
  // is nothing here to do".
  const empty = await Course.create({
    slug: 'garud', title: 'GARUD', description: 'x', priceInPaise: 0,
    isPublished: true, isPurchasable: false, pillar: 'communicate', modules: [],
  });
  await Stage.updateOne({ code: 'GARUD' }, { $set: { courseSlug: 'garud' } });

  const res = await asService(request.post('/api/internal/progression/eligibility/YODDHA/validate')).send({
    rootGroup: {
      logic: 'ALL',
      requirements: [{ key: 'r0', metric: 'PREVIOUS_STAGE_COMPLETION', operator: 'GTE', value: 80, enabled: true }],
    },
  });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.valid, true, 'it is a warning, not a block - the stage may be built later');
  assert.ok(
    res.body.data.warnings.some((w) => /no published lessons/i.test(w)),
    `expected an unreachable-progress warning, got ${JSON.stringify(res.body.data.warnings)}`
  );

  await Course.deleteOne({ _id: empty._id });
  await Stage.updateOne({ code: 'GARUD' }, { $set: { courseSlug: null } });
});
