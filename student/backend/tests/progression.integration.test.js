import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * The progression engine, end to end.
 *
 * The claim under test is the one the whole design rests on: that a single
 * purchased course can move three independent skill scores, that every number
 * shown to a student is derived from recorded activity, and that repeating an
 * activity cannot be turned into repeated XP.
 */

let ctx;
let request;
let Course;
let StudentProfile;
let ProgressionEvent;
let StudentAchievement;
let Subject;
let Stage;
let Achievement;
let ProgressionRules;
let Enrollment;
let engine;
let rulesService;
let subjectService;

let course;

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;

  ({ Course } = await import('../src/models/Course.js'));
  ({ StudentProfile } = await import('../src/models/StudentProfile.js'));
  ({ ProgressionEvent } = await import('../src/models/ProgressionEvent.js'));
  ({ StudentAchievement } = await import('../src/models/StudentAchievement.js'));
  ({ Subject } = await import('../src/models/Subject.js'));
  ({ Stage } = await import('../src/models/Stage.js'));
  ({ Achievement } = await import('../src/models/Achievement.js'));
  ({ ProgressionRules } = await import('../src/models/ProgressionRules.js'));
  ({ Enrollment } = await import('../src/models/Enrollment.js'));
  engine = await import('../src/services/progression/engine.service.js');
  rulesService = await import('../src/services/progression/rules.service.js');
  subjectService = await import('../src/services/progression/subject.service.js');

  const { DEFAULT_SUBJECTS } = await import('../src/models/Subject.js');
  const { DEFAULT_STAGES } = await import('../src/models/Stage.js');
  const { DEFAULT_ACHIEVEMENTS } = await import('../src/models/Achievement.js');
  await Subject.insertMany(DEFAULT_SUBJECTS.map((s) => ({ ...s })));
  await Stage.insertMany(DEFAULT_STAGES.map((s) => ({ ...s })));
  await Achievement.insertMany(DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })));

  // One course - a `communicate` course, as production Prarambh is - carrying
  // lessons in all three subjects. That combination is the point: if skills came
  // from the course pillar, two of these three could never leave zero.
  course = await Course.create({
    slug: 'prarambh',
    title: 'PRARAMBH — The Awakening',
    description: 'Foundation',
    priceInPaise: 500000,
    isPublished: true,
    isPurchasable: true,
    pillar: 'communicate',
    modules: [
      {
        moduleId: 'mod-1',
        title: 'Speaking',
        order: 1,
        lessons: [
          { lessonId: 'l-eng-1', title: 'Introductions', order: 1, subject: 'ENGLISH' },
          { lessonId: 'l-eng-2', title: 'Presenting', order: 2, subject: 'ENGLISH' },
        ],
      },
      {
        moduleId: 'mod-2',
        title: 'Computers',
        order: 2,
        subject: 'COMPUTER', // module-level default
        lessons: [
          { lessonId: 'l-comp-1', title: 'Files', order: 1 },
          { lessonId: 'l-comp-2', title: 'Spreadsheets', order: 2 },
        ],
      },
      {
        moduleId: 'mod-3',
        title: 'Staying safe',
        order: 3,
        lessons: [
          { lessonId: 'l-cyb-1', title: 'Passwords', order: 1, subject: 'CYBERSECURITY' },
          { lessonId: 'l-cyb-2', title: 'Phishing', order: 2, subject: 'CYBERSECURITY' },
        ],
      },
    ],
  });
});

after(async () => {
  await ctx.teardown();
});

beforeEach(async () => {
  rulesService.invalidateRulesCache();
  subjectService.invalidateSubjectCache();
  await ProgressionRules.deleteMany({});
});

async function newLearner(label) {
  const student = await registerAndLogin(request, {
    name: `Progress ${label}`,
    email: `prog.${label}.${Math.random().toString(36).slice(2, 7)}@example.com`,
  });
  const { User } = await import('../src/models/User.js');
  const user = await User.findOne({ email: student.email?.toLowerCase() }).lean();
  const userId = user?._id || student.userId || student.user?._id;
  await Enrollment.create({ userId, courseId: course._id, status: 'active', enrollmentId: `ENR-T-${Math.random().toString(36).slice(2, 8)}` });
  await StudentProfile.findOneAndUpdate({ userId }, { userId }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return { ...student, userId };
}

let StageEligibilityRule;

/**
 * Publishes a rule the way an administrator would, so the tests exercise the
 * same path production does rather than writing a verdict directly.
 */
async function publishEligibilityRule(targetStageCode, previousStageCode, requirements, { logic = 'ALL', groups = [] } = {}) {
  if (!StageEligibilityRule) ({ StageEligibilityRule } = await import('../src/models/StageEligibilityRule.js'));
  await StageEligibilityRule.deleteMany({ targetStageCode });
  return StageEligibilityRule.create({
    targetStageCode,
    previousStageCode,
    version: 1,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    rootGroup: { logic, requirements: requirements.map((r, i) => ({ key: `r${i}`, enabled: true, ...r })) },
    groups,
  });
}

async function clearEligibilityRulesFor(targetStageCode) {
  if (!StageEligibilityRule) ({ StageEligibilityRule } = await import('../src/models/StageEligibilityRule.js'));
  await StageEligibilityRule.deleteMany({ targetStageCode });
}

async function clearEligibilityRules() {
  if (!StageEligibilityRule) ({ StageEligibilityRule } = await import('../src/models/StageEligibilityRule.js'));
  await StageEligibilityRule.deleteMany({});
}

const requirementFor = (verdict, metric, subjectCode = null) =>
  (verdict?.requirements || []).find((r) => r.metric === metric && (!subjectCode || r.name));

const skill = (profile, code) => (profile.progression.skills || []).find((s) => s.subjectCode === code)?.score ?? 0;

// --- The scenario the subject-tagging decision specifies --------------------

test('one course moves three independent skill scores', async () => {
  const learner = await newLearner('three-skills');

  let snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(skill(snap.profile, 'ENGLISH'), 0, 'starts at zero');
  assert.equal(skill(snap.profile, 'COMPUTER'), 0);
  assert.equal(skill(snap.profile, 'CYBERSECURITY'), 0);

  // English activity only.
  let res = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });
  assert.ok(skill(res.profile, 'ENGLISH') > 0, 'English moved');
  assert.equal(skill(res.profile, 'COMPUTER'), 0, 'Computer untouched');
  assert.equal(skill(res.profile, 'CYBERSECURITY'), 0, 'Cybersecurity untouched');

  const englishAfterFirst = skill(res.profile, 'ENGLISH');

  // Computer activity only.
  res = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-comp-1', courseId: course._id, subjectCode: 'COMPUTER',
  });
  assert.equal(skill(res.profile, 'ENGLISH'), englishAfterFirst, 'English unchanged');
  assert.ok(skill(res.profile, 'COMPUTER') > 0, 'Computer moved');
  assert.equal(skill(res.profile, 'CYBERSECURITY'), 0);

  // Cybersecurity activity only.
  res = await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 92,
    refId: 'q-cyb-1', courseId: course._id, subjectCode: 'CYBERSECURITY',
  });
  assert.ok(skill(res.profile, 'CYBERSECURITY') > 0, 'Cybersecurity moved');
  assert.equal(skill(res.profile, 'ENGLISH'), englishAfterFirst);
});

test('every downstream number is derived, not stored by the caller', async () => {
  const learner = await newLearner('derived');

  await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 92,
    refId: 'q-1', courseId: course._id, subjectCode: 'CYBERSECURITY',
  });
  const { profile } = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const p = profile.progression;
  assert.ok(profile.xp > 0, 'XP accumulated from the rules, not from the request');
  assert.ok(profile.level >= 1);
  assert.ok(p.knowledgeScore > 0, 'knowledge derived from the quiz');
  assert.ok(p.consistencyScore > 0, 'consistency derived from activity days');
  assert.ok(p.overallPower > 0, 'overall power derived from the rest');
  assert.ok(p.rankCode, 'a rank was assigned');
  assert.equal(p.currentStageCode, 'PRARAMBH', 'stage resolved from the enrolled course');
  assert.ok(p.stageProgress >= 0);
  assert.ok(p.recalculatedAt instanceof Date);
});

// --- Duplicate XP, the spec's central anti-exploit requirement --------------

test('completing the same lecture twice pays once', async () => {
  const learner = await newLearner('dup-lecture');

  const first = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });
  const second = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  assert.ok(first.xpAwarded > 0, 'the first completion pays');
  assert.equal(second.duplicate, true, 'the second is recognised as the same event');
  assert.equal(second.xpAwarded, 0, 'and pays nothing');
  assert.equal(second.profile.xp, first.profile.xp, 'the balance did not move');
  assert.equal(await ProgressionEvent.countDocuments({ userId: learner.userId }), 1, 'one event, not two');
});

test('a duplicated request racing itself still pays once', async () => {
  // The case a read-then-write guard cannot survive: both requests look, both
  // see nothing, both award. Here the unique index decides.
  const learner = await newLearner('race');

  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      engine.recordActivity({
        userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
        refId: 'l-comp-1', courseId: course._id, subjectCode: 'COMPUTER',
      })
    )
  );

  const paid = results.filter((r) => r.xpAwarded > 0);
  assert.equal(paid.length, 1, `exactly one award, got ${paid.length}`);
  assert.equal(await ProgressionEvent.countDocuments({ userId: learner.userId, refId: 'l-comp-1' }), 1);

  const profile = await StudentProfile.findOne({ userId: learner.userId });
  const rules = await rulesService.getRules();
  const lectureRule = rules.xpRules.find((r) => r.activityType === 'LECTURE_COMPLETED');
  assert.equal(profile.xp, lectureRule.baseXP, 'the balance reflects exactly one lecture');
});

test('a retaken quiz does not pay again under the default policy', async () => {
  const learner = await newLearner('retake');

  const first = await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 70,
    refId: 'q-retake', courseId: course._id, subjectCode: 'ENGLISH',
  });
  const better = await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 100,
    refId: 'q-retake', courseId: course._id, subjectCode: 'ENGLISH',
  });

  assert.ok(first.xpAwarded > 0);
  assert.equal(better.duplicate, true, 'FIRST_ONLY means the retake is the same event');
  assert.equal(better.xpAwarded, 0);
});

// --- Configuration is the authority ----------------------------------------

test('XP comes from the rules document, not from the code path', async () => {
  const learner = await newLearner('configurable');

  await rulesService.ensureRules();
  await ProgressionRules.updateOne(
    { key: 'GLOBAL', 'xpRules.activityType': 'LECTURE_COMPLETED' },
    { $set: { 'xpRules.$.baseXP': 137 } }
  );
  rulesService.invalidateRulesCache();

  const res = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-2', courseId: course._id, subjectCode: 'ENGLISH',
  });
  assert.equal(res.xpAwarded, 137, 'the configured value was used verbatim');
});

test('a disabled XP rule stops paying without stopping the activity', async () => {
  const learner = await newLearner('disabled-rule');

  await rulesService.ensureRules();
  await ProgressionRules.updateOne(
    { key: 'GLOBAL', 'xpRules.activityType': 'LECTURE_COMPLETED' },
    { $set: { 'xpRules.$.enabled': false } }
  );
  rulesService.invalidateRulesCache();

  const res = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  assert.equal(res.xpAwarded, 0, 'no XP');
  assert.equal(await ProgressionEvent.countDocuments({ userId: learner.userId }), 1, 'but the activity is still recorded');
  assert.ok(skill(res.profile, 'ENGLISH') > 0, 'and still counts toward the skill');
});

test('the level curve is configuration, and defaults to the platform behaviour', async () => {
  const learner = await newLearner('levels');
  const { levelForXp } = await import('../src/services/progression/calculators.js');
  const rules = await rulesService.getRules();

  // Parity with the original floor(xp / 500) + 1, so switching the engine on
  // does not restate anybody's level.
  assert.equal(levelForXp(0, rules.levels).level, 1);
  assert.equal(levelForXp(499, rules.levels).level, 1);
  assert.equal(levelForXp(500, rules.levels).level, 2);
  assert.equal(levelForXp(4850, rules.levels).level, 10);

  await ProgressionRules.updateOne({ key: 'GLOBAL' }, { $set: { 'levels.xpPerLevel': 100 } });
  rulesService.invalidateRulesCache();
  const changed = await rulesService.getRules();
  assert.equal(levelForXp(500, changed.levels).level, 6, 'the curve followed the configuration');
});

// --- Achievements -----------------------------------------------------------

test('an achievement unlocks once, however many times its criterion is met', async () => {
  const learner = await newLearner('achieve');

  // Four strong English activities, enough to pass the 70 threshold and stay there.
  for (const [i, refId] of ['l-eng-1', 'l-eng-2'].entries()) {
    await engine.recordActivity({
      userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
      refId, courseId: course._id, subjectCode: 'ENGLISH', occurredAt: new Date(Date.now() - i * 1000),
    });
  }
  for (const refId of ['q-e1', 'q-e2', 'q-e3']) {
    await engine.recordActivity({
      userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 95,
      refId, courseId: course._id, subjectCode: 'ENGLISH',
    });
  }

  const held = await StudentAchievement.find({ userId: learner.userId, achievementCode: 'VOICE_OF_CONFIDENCE' });
  assert.equal(held.length, 1, 'unlocked exactly once');

  // Re-running the whole evaluation must not hand it out again.
  await engine.rebuildSnapshot(learner.userId);
  await engine.rebuildSnapshot(learner.userId);
  assert.equal(await StudentAchievement.countDocuments({ userId: learner.userId, achievementCode: 'VOICE_OF_CONFIDENCE' }), 1);
});

// --- Eligibility ------------------------------------------------------------

test('eligibility reports each unmet requirement rather than a bare no', async () => {
  const learner = await newLearner('eligibility');

  await publishEligibilityRule('GARUD', 'PRARAMBH', [
    { metric: 'XP', operator: 'GTE', value: 5000 },
    { metric: 'SUBJECT_SCORE', operator: 'GTE', value: 70, subjectCode: 'ENGLISH' },
    { metric: 'SUBJECT_SCORE', operator: 'GTE', value: 70, subjectCode: 'CYBERSECURITY' },
  ]);

  const { profile } = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const verdict = profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.status, 'NOT_ELIGIBLE');
  assert.equal(verdict.version, 1, 'the verdict records which rule produced it');

  const xp = verdict.requirements.find((r) => r.metric === 'XP');
  assert.equal(xp.required, 5000);
  assert.ok(xp.actual < 5000);
  assert.equal(xp.passed, false);
  assert.equal(xp.operator, '>=', 'the operator is reported, not assumed by the UI');

  const cyber = verdict.requirements.filter((r) => r.metric === 'SUBJECT_SCORE').find((r) => r.name.match(/Cyber/i));
  assert.equal(cyber.required, 70, 'the student can be told exactly what is missing');
  assert.equal(cyber.passed, false);
});

test('a transition with no published rule is not passable', async () => {
  // The safety property: silence is not consent. An administrator who has not
  // configured a stage has not thereby opened it.
  const learner = await newLearner('unconfigured');
  await clearEligibilityRules();

  const { profile } = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-2', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const garud = profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, false);
  assert.equal(garud.status, 'NOT_CONFIGURED', 'and says why, rather than looking like a failed check');
  assert.deepEqual(garud.requirements, []);
});

test('a draft rule changes nothing for a live student', async () => {
  const learner = await newLearner('draft-inert');
  if (!StageEligibilityRule) ({ StageEligibilityRule } = await import('../src/models/StageEligibilityRule.js'));

  await publishEligibilityRule('GARUD', 'PRARAMBH', [{ metric: 'XP', operator: 'GTE', value: 5 }]);
  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  let snap = await engine.rebuildSnapshot(learner.userId);
  let garud = snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, true, 'the published rule is satisfied');

  // A draft demanding far more sits alongside it and must not bite.
  await StageEligibilityRule.create({
    targetStageCode: 'GARUD', previousStageCode: 'PRARAMBH', version: 2, status: 'DRAFT',
    rootGroup: { logic: 'ALL', requirements: [{ key: 'r0', metric: 'XP', operator: 'GTE', value: 999999, enabled: true }] },
  });

  snap = await engine.rebuildSnapshot(learner.userId);
  garud = snap.profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, true, 'a draft affects nobody until it is published');
  assert.equal(garud.version, 1, 'the published version is still the one in force');

  await StageEligibilityRule.deleteMany({ targetStageCode: 'GARUD', status: 'DRAFT' });
});

// --- The snapshot is a cache, and says so ----------------------------------

test('a damaged snapshot is repaired from the event ledger', async () => {
  const learner = await newLearner('rebuild');

  await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 88,
    refId: 'q-rebuild', courseId: course._id, subjectCode: 'COMPUTER',
  });
  const good = await StudentProfile.findOne({ userId: learner.userId });
  const goodPower = good.progression.overallPower;

  // Corrupt it the way a half-finished write would.
  await StudentProfile.updateOne(
    { userId: learner.userId },
    { $set: { 'progression.overallPower': 0, 'progression.knowledgeScore': 0, 'progression.skills': [] } }
  );

  const { profile } = await engine.recalculateStudent(learner.userId);
  assert.equal(profile.progression.overallPower, goodPower, 'recomputed from the ledger, not lost');
  assert.ok(skill(profile, 'COMPUTER') > 0);
});

test('subject is snapshotted at award time, so re-tagging cannot rewrite history', async () => {
  const learner = await newLearner('history');

  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  // An administrator re-classifies the lesson.
  const doc = await Course.findById(course._id);
  doc.modules[0].lessons[0].subject = 'COMPUTER';
  await doc.save();

  const event = await ProgressionEvent.findOne({ userId: learner.userId, refId: 'l-eng-1' });
  assert.equal(event.subjectCode, 'ENGLISH', 'the record of what the student was credited with is unchanged');

  // Restore, so later tests see the fixture as built.
  doc.modules[0].lessons[0].subject = 'ENGLISH';
  await doc.save();
});

// --- The student-facing API -------------------------------------------------

test('the profile endpoint reports derived values, not request values', async () => {
  const learner = await newLearner('api');

  await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 95,
    refId: 'q-api', courseId: course._id, subjectCode: 'COMPUTER',
  });

  const res = await request.get('/api/student/progression').set(bearer(learner.accessToken));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body.data;

  assert.equal(d.stage.code, 'PRARAMBH');
  assert.ok(d.level >= 1);
  assert.ok(d.rank.code, 'rank present');
  assert.ok(d.xp.current > 0);
  assert.ok(d.xp.forNextLevel > 0, 'the bar denominator comes from the server, not the client');
  assert.equal(d.skills.length, 3, 'one entry per enabled subject');
  assert.ok(d.skills.find((s) => s.code === 'COMPUTER').score > 0);
  assert.equal(d.skills.find((s) => s.code === 'ENGLISH').score, 0);
  assert.ok(d.skills[0].name && d.skills[0].color, 'subject metadata joined in');
  assert.ok(d.achievements.length > 0, 'locked achievements are listed too');
  assert.ok(d.nextStage, 'the next stage and its requirements are reported');
});

test('a student cannot write any progression value through the API', async () => {
  const learner = await newLearner('tamper');
  const before = await StudentProfile.findOne({ userId: learner.userId });

  // No write route exists for progression, and the point of the test is that it
  // keeps not existing - a 404/405 here is the design, not a gap.
  for (const [method, path, body] of [
    ['post', '/api/student/progression', { xp: 999999, level: 99 }],
    ['put', '/api/student/progression', { overallPower: 100 }],
    ['patch', '/api/student/progression', { rankCode: 'S' }],
    ['post', '/api/student/progression/activity', { activityType: 'QUIZ_PASSED', score: 100 }],
  ]) {
    const res = await request[method](path).set(bearer(learner.accessToken)).send(body);
    assert.ok(res.status >= 400, `${method} ${path} must not be a write route (got ${res.status})`);
  }

  // The profile PATCH is a real route, and it refuses the whole request rather
  // than quietly dropping the fields it does not recognise. Stricter than
  // ignoring them, and worth pinning: a future loosening of that validator
  // would turn this endpoint into a way to smuggle XP.
  const smuggle = await request
    .patch('/api/student/profile')
    .set(bearer(learner.accessToken))
    .send({ bio: 'Hello', xp: 999999, level: 99, progression: { overallPower: 100, rankCode: 'S' } });
  assert.equal(smuggle.status, 422, 'unknown fields are rejected outright');

  // And the same edit without them is accepted, so the refusal above is about
  // the smuggled fields rather than the route being broken.
  const clean = await request
    .patch('/api/student/profile')
    .set(bearer(learner.accessToken))
    .send({ bio: 'Hello' });
  assert.ok(clean.status < 400, `a legitimate edit still works (got ${clean.status})`);

  const after = await StudentProfile.findOne({ userId: learner.userId });
  assert.equal(after.xp, before.xp, 'XP unchanged');
  assert.equal(after.level, before.level, 'level unchanged');
  assert.equal(after.progression?.overallPower || 0, before.progression?.overallPower || 0, 'power unchanged');
  assert.equal(after.progression?.rankCode || null, before.progression?.rankCode || null, 'rank unchanged');
});

test('one student can never read another student progression', async () => {
  const mine = await newLearner('owner');
  const theirs = await newLearner('other');

  await engine.recordActivity({
    userId: theirs.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 99,
    refId: 'q-private', courseId: course._id, subjectCode: 'CYBERSECURITY',
  });

  // The endpoint takes no student id at all; it reads req.user. Passing one
  // must change nothing.
  const res = await request
    .get(`/api/student/progression?userId=${theirs.userId}&studentId=${theirs.userId}`)
    .set(bearer(mine.accessToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.xp.current, 0, 'got my own profile, not theirs');
  assert.equal(res.body.data.skills.find((s) => s.code === 'CYBERSECURITY').score, 0);
});

test('the activity timeline is the student own, newest first', async () => {
  const learner = await newLearner('timeline');

  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
    occurredAt: new Date(Date.now() - 60_000),
  });
  await engine.recordActivity({
    userId: learner.userId, activityType: 'QUIZ_PASSED', status: 'PASSED', score: 80,
    refId: 'q-timeline', courseId: course._id, subjectCode: 'CYBERSECURITY',
  });

  const res = await request.get('/api/student/progression/activity').set(bearer(learner.accessToken));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.data[0].activityType, 'QUIZ_PASSED', 'newest first');
  assert.ok(res.body.data[0].xpAwarded > 0, 'the timeline shows what each activity was worth');
});

test('unauthenticated callers get nothing', async () => {
  for (const path of ['/api/student/progression', '/api/student/progression/activity']) {
    const res = await request.get(path);
    assert.equal(res.status, 401, path);
  }
});

// --- Subject tagging across the service boundary ---------------------------

const asService = (req) => req.set('x-internal-service-key', process.env.INTERNAL_SERVICE_KEY || 'test_internal_key');

test('course content reports chosen and inherited subjects apart', async () => {
  const res = await asService(request.get('/api/internal/courses/prarambh/content'));
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const mods = res.body.data.modules;
  const englishLesson = mods[0].lessons.find((l) => l.lessonId === 'l-eng-1');
  assert.equal(englishLesson.subject, 'ENGLISH', 'explicitly chosen');
  assert.equal(englishLesson.inherited, false);

  // mod-2 carries a module-level subject and its lessons name none, so they
  // resolve to COMPUTER without having chosen it.
  const inheritedLesson = mods[1].lessons.find((l) => l.lessonId === 'l-comp-1');
  assert.equal(inheritedLesson.subject, null, 'nothing chosen on the lesson');
  assert.equal(inheritedLesson.resolvedSubject, 'COMPUTER', 'but it resolves via the module');
  assert.equal(inheritedLesson.inherited, true, 'and says so');
});

test('retagging changes what future activity credits, not the past', async () => {
  const learner = await newLearner('retag');

  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-2', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const before = await StudentProfile.findOne({ userId: learner.userId });
  const englishBefore = skill(before, 'ENGLISH');
  assert.ok(englishBefore > 0);

  // An administrator reclassifies that lesson.
  const patch = await asService(
    request.patch('/api/internal/courses/prarambh/subjects')
  ).send({ lessons: [{ lessonId: 'l-eng-2', subject: 'CYBERSECURITY' }] });
  assert.equal(patch.status, 200, JSON.stringify(patch.body));

  // The recorded event keeps the subject it was credited under.
  const event = await ProgressionEvent.findOne({ userId: learner.userId, refId: 'l-eng-2' });
  assert.equal(event.subjectCode, 'ENGLISH', 'history is not rewritten');

  const after = await engine.rebuildSnapshot(learner.userId);

  // Nothing already awarded is taken back or paid twice. That is the guarantee
  // the ledger makes; it is not the stronger "no derived number may change".
  const { XPEvent } = await import('../src/models/XPEvent.js');
  assert.equal(
    await XPEvent.countDocuments({ userId: learner.userId, refId: 'l-eng-2' }),
    1,
    'the original award is intact and unduplicated'
  );
  assert.ok(after.profile.xp >= before.xp, 'XP is never clawed back');

  // The English percentage DOES move, and correctly: one of its two lessons is
  // no longer an English lesson, so the subject's syllabus is smaller and the
  // student has covered all of what remains.
  assert.equal(skill(after.profile, 'ENGLISH'), 100, 'measured against the syllabus as it now stands');

  // And that can cross an achievement threshold, which then unlocks and pays.
  // Worth pinning: it means retagging content has a real, forward consequence
  // for students, rather than being a purely cosmetic relabel.
  const unlockedByRetag = await StudentAchievement.findOne({
    userId: learner.userId,
    achievementCode: 'VOICE_OF_CONFIDENCE',
  });
  assert.ok(unlockedByRetag, 'the student now genuinely meets the criterion');

  // Restore for the fixtures other tests rely on.
  await asService(request.patch('/api/internal/courses/prarambh/subjects')).send({
    lessons: [{ lessonId: 'l-eng-2', subject: 'ENGLISH' }],
  });
});

test('a subject can be cleared back to inheriting', async () => {
  const res = await asService(request.patch('/api/internal/courses/prarambh/subjects')).send({
    lessons: [{ lessonId: 'l-cyb-2', subject: null }],
  });
  assert.equal(res.status, 200);

  const content = await asService(request.get('/api/internal/courses/prarambh/content'));
  const lesson = content.body.data.modules[2].lessons.find((l) => l.lessonId === 'l-cyb-2');
  assert.equal(lesson.subject, null, 'cleared');
  // mod-3 names no subject either, so it now falls through to the course pillar.
  assert.equal(lesson.resolvedSubject, 'ENGLISH', 'falls back to the communicate pillar');
  assert.equal(lesson.inherited, true);

  await asService(request.patch('/api/internal/courses/prarambh/subjects')).send({
    lessons: [{ lessonId: 'l-cyb-2', subject: 'CYBERSECURITY' }],
  });
});

test('tagging routes are unreachable without the service key', async () => {
  for (const [method, path] of [
    ['get', '/api/internal/subjects'],
    ['get', '/api/internal/courses/prarambh/content'],
    ['patch', '/api/internal/courses/prarambh/subjects'],
  ]) {
    const res = await request[method](path).send({});
    assert.ok(res.status === 401 || res.status === 403, `${method} ${path} must be guarded (got ${res.status})`);
  }
});

// --- Attendance, bridged from the service that records it -------------------

test('bridged attendance produces a real attendance score', async () => {
  const learner = await newLearner('attendance');

  const marks = [
    { date: '2026-09-01', status: 'present' },
    { date: '2026-09-02', status: 'present' },
    { date: '2026-09-03', status: 'absent' },
    { date: '2026-09-04', status: 'late' },
  ];

  for (const m of marks) {
    const res = await asService(request.post('/api/internal/attendance')).send({
      records: [{ userId: String(learner.userId), classId: 'cls-1', date: m.date, status: m.status }],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }

  const { profile } = await engine.rebuildSnapshot(learner.userId);
  const p = profile.progression;

  assert.equal(p.classesConducted, 4, 'every session counted once');
  assert.equal(p.classesAttended, 3, 'present and late both count as turning up');
  // 2 present + 1 late at the configured 50% credit, over 4 sessions = 62.5.
  assert.equal(p.attendanceScore, 62.5, 'late earns the configured partial credit, not full');
  assert.ok(p.overallPower > 0, 'and attendance now contributes to overall power');
});

test('a corrected mark replaces the original rather than adding to it', async () => {
  const learner = await newLearner('correction');

  await asService(request.post('/api/internal/attendance')).send({
    records: [{ userId: String(learner.userId), classId: 'cls-2', date: '2026-09-05', status: 'absent' }],
  });
  let snap = await engine.rebuildSnapshot(learner.userId);
  assert.equal(snap.profile.progression.classesConducted, 1);
  assert.equal(snap.profile.progression.classesAttended, 0);

  // The teacher corrects it.
  await asService(request.post('/api/internal/attendance')).send({
    records: [{ userId: String(learner.userId), classId: 'cls-2', date: '2026-09-05', status: 'present' }],
  });
  snap = await engine.rebuildSnapshot(learner.userId);

  assert.equal(snap.profile.progression.classesConducted, 1, 'still one session, not two');
  assert.equal(snap.profile.progression.classesAttended, 1, 'the correction won');
  assert.equal(snap.profile.progression.attendanceScore, 100);

  // Both facts survive, which is what makes a disputed record explainable.
  const events = await ProgressionEvent.find({ userId: learner.userId, refId: 'cls-2:2026-09-05' }).lean();
  assert.equal(events.length, 2, 'the original mark and the correction are both on record');
});

test('re-sending the identical mark changes nothing', async () => {
  const learner = await newLearner('attendance-replay');

  const send = () =>
    asService(request.post('/api/internal/attendance')).send({
      records: [{ userId: String(learner.userId), classId: 'cls-3', date: '2026-09-06', status: 'present' }],
    });

  const first = await send();
  const second = await send();

  assert.equal(first.body.data.recorded, 1);
  assert.equal(second.body.data.duplicate, 1, 'a replayed push is recognised, not re-counted');
  assert.equal(await ProgressionEvent.countDocuments({ userId: learner.userId, refId: 'cls-3:2026-09-06' }), 1);
});

test('a roster row with no portal account is skipped, never guessed at', async () => {
  const res = await asService(request.post('/api/internal/attendance')).send({
    records: [{ userId: '0123456789abcdef01234567', classId: 'cls-4', date: '2026-09-07', status: 'present' }],
  });

  assert.equal(res.status, 200, 'the rest of a register still goes through');
  assert.equal(res.body.data.skipped, 1);
  assert.equal(res.body.data.recorded, 0, 'no student was credited on a guess');
});

test('attendance intake is unreachable without the service key', async () => {
  const res = await request.post('/api/internal/attendance').send({ records: [] });
  assert.ok(res.status === 401 || res.status === 403, `got ${res.status}`);
});

test('a freshly deployed service configures itself on first read', async () => {
  // The seed script needs shell access to the database, which a managed
  // deployment does not give you. Without this, the first admin to open the
  // tagging screen would find an empty dropdown and no way to fill it.
  const { Subject } = await import('../src/models/Subject.js');
  const { Stage } = await import('../src/models/Stage.js');
  const { Achievement } = await import('../src/models/Achievement.js');
  const { ensureProgressionConfig } = await import('../src/services/progression/rules.service.js');

  await Promise.all([Subject.deleteMany({}), Stage.deleteMany({}), Achievement.deleteMany({}), ProgressionRules.deleteMany({})]);
  subjectService.invalidateSubjectCache();
  rulesService.invalidateRulesCache();

  const created = await ensureProgressionConfig();
  assert.ok(created.subjects > 0 && created.stages > 0 && created.achievements > 0 && created.rules);

  const res = await asService(request.get('/api/internal/subjects'));
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 3, 'the tagging dropdown has options');

  // Running again must not duplicate or overwrite anything.
  await Subject.updateOne({ code: 'ENGLISH' }, { $set: { name: 'Renamed By Admin' } });
  const again = await ensureProgressionConfig();
  assert.deepEqual(again, { subjects: 0, stages: 0, achievements: 0, rules: false }, 'nothing recreated');
  const english = await Subject.findOne({ code: 'ENGLISH' }).lean();
  assert.equal(english.name, 'Renamed By Admin', 'an administrator edit survives');

  await Subject.updateOne({ code: 'ENGLISH' }, { $set: { name: 'English & Communication' } });
  subjectService.invalidateSubjectCache();
});

// --- The three-stage journey ------------------------------------------------

let garud;
let yoddha;

test('the journey courses exist and carry a real duration', async () => {
  garud = await Course.create({
    slug: 'garud', title: 'GARUD — The Rise', description: 'Build Your Power',
    priceInPaise: 0, isPublished: true, isPurchasable: false, pillar: 'communicate',
    duration: '9 Months', durationValue: 9, durationUnit: 'MONTHS', modules: [],
  });
  yoddha = await Course.create({
    slug: 'yoddha', title: 'YODDHA — The Warrior', description: 'Master Your Skills',
    priceInPaise: 0, isPublished: true, isPurchasable: false, pillar: 'communicate',
    duration: '9 Months', durationValue: 9, durationUnit: 'MONTHS', modules: [],
  });
  await Course.updateOne({ slug: 'prarambh' }, { $set: { duration: '9 Months', durationValue: 9, durationUnit: 'MONTHS' } });
  await Stage.updateOne({ code: 'GARUD' }, { $set: { courseSlug: 'garud' } });
  await Stage.updateOne({ code: 'YODDHA' }, { $set: { courseSlug: 'yoddha' } });

  // Duration is a number the system can compute with, not a label it has to parse.
  const { enrollmentWindow } = await import('../src/services/progression/access.service.js');
  const from = new Date('2026-01-15T00:00:00Z');
  const { endsAt } = enrollmentWindow(await Course.findOne({ slug: 'garud' }).lean(), from);
  assert.equal(endsAt.toISOString().slice(0, 10), '2026-10-15', 'nine months after the start');
});

test('a stage beyond the first is refused until its requirements are met', async () => {
  const learner = await newLearner('locked');
  const { assertStageAccessible, evaluateStageAccess } = await import('../src/services/progression/access.service.js');

  await publishEligibilityRule('GARUD', 'PRARAMBH', [
    { metric: 'PREVIOUS_STAGE_COMPLETION', operator: 'GTE', value: 100 },
    { metric: 'XP', operator: 'GTE', value: 5000 },
  ]);
  await engine.rebuildSnapshot(learner.userId);

  const verdict = await evaluateStageAccess(learner.userId, garud);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'REQUIREMENTS_NOT_MET');
  assert.ok(verdict.unmet.length > 0, 'and it can say what is outstanding');

  await assert.rejects(
    () => assertStageAccessible(learner.userId, garud),
    (err) => {
      assert.equal(err.code, 'STAGE_LOCKED');
      assert.match(err.message, /GARUD/);
      return true;
    }
  );
});

test('a stage with no published rule is refused for a different, stated reason', async () => {
  const learner = await newLearner('unconfigured-access');
  const { assertStageAccessible, evaluateStageAccess } = await import('../src/services/progression/access.service.js');
  await clearEligibilityRules();
  await engine.rebuildSnapshot(learner.userId);

  const verdict = await evaluateStageAccess(learner.userId, garud);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'NOT_CONFIGURED', 'not the same as failing a requirement');

  await assert.rejects(
    () => assertStageAccessible(learner.userId, garud),
    (err) => {
      assert.equal(err.code, 'STAGE_NOT_CONFIGURED');
      return true;
    }
  );
});

test('the first stage is always open', async () => {
  const learner = await newLearner('first-stage');
  const { evaluateStageAccess } = await import('../src/services/progression/access.service.js');

  const verdict = await evaluateStageAccess(learner.userId, course);
  assert.equal(verdict.allowed, true, 'nobody has to earn the beginning');
  assert.equal(verdict.reason, 'FIRST_STAGE');
});

test('an ordinary course outside the journey is unaffected', async () => {
  const learner = await newLearner('plain-course');
  const plain = await Course.create({
    slug: `plain-${Math.random().toString(36).slice(2, 7)}`, title: 'Something Else',
    description: 'x', priceInPaise: 0, isPublished: true, isPurchasable: true, modules: [],
  });

  const { evaluateStageAccess } = await import('../src/services/progression/access.service.js');
  const verdict = await evaluateStageAccess(learner.userId, plain);
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.reason, 'NOT_A_STAGE_COURSE', 'the gate only applies to the staged journey');
});

test('a locked stage cannot be reached by enrolling directly', async () => {
  // The gate lives inside createEnrollment, so every path that produces an
  // enrolment passes it - including one added later by someone who has not read
  // this file.
  const learner = await newLearner('bypass');
  const { createEnrollment } = await import('../src/services/enrollment.service.js');

  // A published rule this student cannot meet - so the refusal under test is a
  // locked stage, not an unconfigured one.
  await publishEligibilityRule('GARUD', 'PRARAMBH', [{ metric: 'XP', operator: 'GTE', value: 999999 }]);
  await engine.rebuildSnapshot(learner.userId);

  await assert.rejects(
    () => createEnrollment({ userId: learner.userId, courseId: garud._id, course: garud }),
    (err) => {
      assert.equal(err.code, 'STAGE_LOCKED');
      return true;
    }
  );
  assert.equal(await Enrollment.countDocuments({ userId: learner.userId, courseId: garud._id }), 0);
});

test('meeting a published rule unlocks that stage and no further', async () => {
  const learner = await newLearner('chain');
  const { createEnrollment } = await import('../src/services/enrollment.service.js');
  const { evaluateStageAccess } = await import('../src/services/progression/access.service.js');

  // Reachable for GARUD, deliberately out of reach for YODDHA.
  await publishEligibilityRule('GARUD', 'PRARAMBH', [{ metric: 'XP', operator: 'GTE', value: 5 }]);
  await publishEligibilityRule('YODDHA', 'GARUD', [{ metric: 'XP', operator: 'GTE', value: 100000 }]);

  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const toGarud = await evaluateStageAccess(learner.userId, garud);
  assert.equal(toGarud.allowed, true, 'GARUD unlocked by meeting its published rule');

  const enrolment = await createEnrollment({ userId: learner.userId, courseId: garud._id, course: garud });
  assert.ok(enrolment, 'and the enrolment goes through');
  assert.ok(enrolment.endsAt, 'with a computed end date');

  const toYoddha = await evaluateStageAccess(learner.userId, yoddha);
  assert.equal(toYoddha.allowed, false, 'YODDHA is not unlocked by reaching GARUD');
  assert.equal(toYoddha.reason, 'REQUIREMENTS_NOT_MET');
});

test('the journey reports a state and a reason for every stage', async () => {
  const learner = await newLearner('journey-view');
  await publishEligibilityRule('GARUD', 'PRARAMBH', [
    { metric: 'PREVIOUS_STAGE_COMPLETION', operator: 'GTE', value: 100 },
    { metric: 'XP', operator: 'GTE', value: 5000 },
  ]);
  await clearEligibilityRulesFor('YODDHA');

  await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-comp-1', courseId: course._id, subjectCode: 'COMPUTER',
  });

  const res = await request.get('/api/student/progression').set(bearer(learner.accessToken));
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const journey = res.body.data.journey;
  assert.equal(journey.length, 3, 'all three stages appear');
  assert.deepEqual(journey.map((j) => j.code), ['PRARAMBH', 'GARUD', 'YODDHA'], 'in order');

  const prarambh = journey[0];
  assert.equal(prarambh.state, 'ACTIVE', 'enrolled and under way');
  assert.equal(prarambh.duration.value, 9);
  assert.equal(prarambh.duration.unit, 'MONTHS');

  const garudView = journey[1];
  assert.equal(garudView.state, 'LOCKED');
  assert.equal(garudView.eligibilityStatus, 'NOT_ELIGIBLE');
  assert.ok(garudView.requirements.length > 0, 'and says what would unlock it');
  assert.ok(garudView.requirements.some((r) => !r.passed));

  // YODDHA has no published rule, which is a different kind of locked.
  assert.equal(journey[2].state, 'LOCKED');
  assert.equal(journey[2].eligibilityStatus, 'NOT_CONFIGURED');
});

test('existing enrolments are untouched by a course duration change', async () => {
  // The regression the spec is most worried about: setting PRARAMBH to nine
  // months must not disturb anybody already enrolled.
  const learner = await newLearner('regression');
  const before = await Enrollment.findOne({ userId: learner.userId, courseId: course._id }).lean();

  await Course.updateOne({ slug: 'prarambh' }, { $set: { durationValue: 9, durationUnit: 'MONTHS', duration: '9 Months' } });

  const after = await Enrollment.findOne({ userId: learner.userId, courseId: course._id }).lean();
  assert.equal(String(after._id), String(before._id), 'same enrolment');
  assert.equal(after.enrollmentId, before.enrollmentId, 'same identity');
  assert.equal(after.status, 'active');
  assert.deepEqual(after.endsAt, before.endsAt, 'the window it was enrolled under did not move');
});


test('an explicit activity subject outranks the module and the pillar', async () => {
  // Mutation testing found nothing guarding this. The fixture above has a
  // module-level subject whose lessons carry none, so the module default is
  // exercised - but no case ever had a lesson subject DISAGREE with its
  // module, which is exactly the case precedence exists to decide. Inverting
  // the order in resolveSubject passed all 180 tests.
  //
  // It matters because it is how PRARAMBH is tagged: a `communicate` course
  // whose individual lessons are the authoritative record of what they teach.
  const { resolveSubject, invalidateSubjectCache } = subjectService;
  invalidateSubjectCache();

  assert.equal(
    await resolveSubject({ activitySubject: 'ENGLISH', moduleSubject: 'COMPUTER', coursePillar: 'create' }),
    'ENGLISH',
    'the lesson wins over both the module and the pillar'
  );

  assert.equal(
    await resolveSubject({ moduleSubject: 'COMPUTER', coursePillar: 'create' }),
    'COMPUTER',
    'the module wins over the pillar when the lesson says nothing'
  );

  assert.equal(
    await resolveSubject({ coursePillar: 'communicate' }),
    'ENGLISH',
    'the pillar is the last resort, not the identity'
  );

  assert.equal(
    await resolveSubject({}),
    'UNASSIGNED',
    'nothing to go on is reported rather than guessed'
  );

  assert.equal(
    await resolveSubject({ activitySubject: 'NOT_A_REAL_SUBJECT' }),
    'UNASSIGNED',
    'a subject that is no longer enabled, with nothing to fall back to, is flagged rather than guessed'
  );

  // The case that matters most, and the one that used to disagree with the
  // function's own documentation. A lesson tagged with a subject that has since
  // been disabled must NOT quietly fall through to the pillar: on PRARAMBH - a
  // `communicate` course - that credited English for cybersecurity work, and a
  // wrong score nobody can see is worse than a visible gap.
  assert.equal(
    await resolveSubject({ activitySubject: 'NOT_A_REAL_SUBJECT', coursePillar: 'communicate' }),
    'UNASSIGNED',
    'a disabled subject is flagged for review, never demoted to the pillar default'
  );

  assert.equal(
    await resolveSubject({ activitySubject: 'NOT_A_REAL_SUBJECT', moduleSubject: 'COMPUTER' }),
    'UNASSIGNED',
    'and not demoted to the module subject either'
  );
});
