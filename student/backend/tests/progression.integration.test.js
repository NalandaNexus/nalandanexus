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

  await Stage.updateOne(
    { code: 'PRARAMBH' },
    {
      $set: {
        'requirements.minXP': 5000,
        'requirements.minStageProgress': 100,
        'requirements.subjects': [
          { subjectCode: 'ENGLISH', minScore: 70, required: true },
          { subjectCode: 'CYBERSECURITY', minScore: 70, required: true },
        ],
      },
    }
  );

  const { profile } = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-1', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const verdict = profile.progression.eligibility.find((e) => e.stageCode === 'PRARAMBH');
  assert.equal(verdict.eligible, false);

  const xpCheck = verdict.checks.find((c) => c.key === 'xp');
  assert.equal(xpCheck.required, 5000);
  assert.ok(xpCheck.actual < 5000);
  assert.equal(xpCheck.met, false);

  const cyber = verdict.checks.find((c) => c.key === 'subject:CYBERSECURITY');
  assert.equal(cyber.required, 70, 'the student can be told exactly what is missing');
  assert.equal(cyber.met, false);
});

test('a stage with no configured requirements is not silently passed', async () => {
  const learner = await newLearner('no-reqs');

  await Stage.updateOne(
    { code: 'GARUD' },
    { $set: { requirements: { minStageProgress: 0, minXP: 0, minAttendance: 0, minKnowledge: 0, minConsistency: 0, minOverallPower: 0, subjects: [], requiredAchievements: [], requireAllLessons: false } } }
  );

  const { profile } = await engine.recordActivity({
    userId: learner.userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'l-eng-2', courseId: course._id, subjectCode: 'ENGLISH',
  });

  const garud = profile.progression.eligibility.find((e) => e.stageCode === 'GARUD');
  assert.equal(garud.eligible, false, 'clearing every field must not hand out the next stage for free');
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
