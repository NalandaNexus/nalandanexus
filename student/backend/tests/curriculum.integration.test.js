import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin } from './helpers/testApp.js';

/**
 * The GARUD and YODDHA curriculum.
 *
 * Four properties are worth more than the counts:
 *
 *   seeding twice changes nothing the second time,
 *   every activity credits a real subject rather than falling to UNASSIGNED,
 *   seeding creates no student data of any kind,
 *   and the three subjects move independently of one another.
 *
 * The last one is the reason the curriculum is tagged at activity level at all.
 * If completing an English lesson moved the Cybersecurity score, the whole
 * three-skill profile would be decoration.
 */

let ctx;
let Course;
let Stage;
let Quiz;
let Task;
let Subject;
let Achievement;
let Enrollment;
let StudentProfile;
let ProgressionEvent;
let LessonProgress;
let engine;
let curriculum;
let journey;

before(async () => {
  ctx = await bootTestApp();

  ({ Course } = await import('../src/models/Course.js'));
  ({ Stage } = await import('../src/models/Stage.js'));
  ({ Quiz } = await import('../src/models/Quiz.js'));
  ({ Task } = await import('../src/models/Task.js'));
  ({ Subject } = await import('../src/models/Subject.js'));
  ({ Achievement } = await import('../src/models/Achievement.js'));
  ({ Enrollment } = await import('../src/models/Enrollment.js'));
  ({ StudentProfile } = await import('../src/models/StudentProfile.js'));
  ({ ProgressionEvent } = await import('../src/models/ProgressionEvent.js'));
  ({ LessonProgress } = await import('../src/models/LessonProgress.js'));
  engine = await import('../src/services/progression/engine.service.js');
  curriculum = await import('../src/services/progression/curriculum.service.js');
  journey = await import('../src/services/progression/journey.service.js');

  const { DEFAULT_SUBJECTS } = await import('../src/models/Subject.js');
  const { DEFAULT_STAGES } = await import('../src/models/Stage.js');
  const { DEFAULT_ACHIEVEMENTS } = await import('../src/models/Achievement.js');
  await Subject.insertMany(DEFAULT_SUBJECTS.map((s) => ({ ...s })));
  await Achievement.insertMany(DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })));
  await Stage.insertMany(DEFAULT_STAGES.map((s) => ({ ...s })));

  // PRARAMBH must exist for the journey seed to link it; the curriculum seed
  // deliberately never touches it.
  await Course.create({
    slug: 'prarambh',
    title: 'PRARAMBH',
    description: 'x',
    priceInPaise: 0,
    isPublished: true,
    pillar: 'communicate',
    modules: [{ moduleId: 'p-m1', title: 'Existing', order: 1, lessons: [{ lessonId: 'p-l1', title: 'Existing lesson', order: 1, subject: 'ENGLISH' }] }],
  });

  await journey.setupJourney({ apply: true });
});

after(async () => {
  await ctx.teardown();
});

const SLUGS = ['garud', 'yoddha'];

test('a dry run writes nothing at all', async () => {
  const before = await Course.findOne({ slug: 'garud' }).lean();
  assert.equal((before.modules || []).length, 0, 'starts empty');

  const { applied, courses } = await curriculum.seedCurriculum({ apply: false });
  assert.equal(applied, false);
  assert.ok(courses.length === 2, 'both courses considered');
  assert.ok(
    courses[0].decisions.some((d) => d.action === 'CREATE'),
    'it reports what it would create'
  );

  const after = await Course.findOne({ slug: 'garud' }).lean();
  assert.equal((after.modules || []).length, 0, 'and wrote none of it');
  assert.equal(await Quiz.countDocuments({}), 0);
  assert.equal(await Task.countDocuments({}), 0);
});

test('seeding builds nine months of content in each stage', async () => {
  await curriculum.seedCurriculum({ apply: true });
  const audit = await curriculum.auditCurriculum();

  for (const slug of SLUGS) {
    const row = audit.find((r) => r.slug === slug);
    assert.ok(row.present, `${slug} exists`);
    assert.equal(row.months, 9, `${slug} covers nine months`);
    assert.equal(row.modules, 18, `${slug} has eighteen modules`);
    assert.ok(row.lessons >= 100, `${slug} has substantial lessons, got ${row.lessons}`);
    assert.ok(row.quizzes >= 3, `${slug} has module quizzes, got ${row.quizzes}`);
    assert.equal(row.assessments, 1, `${slug} has one final assessment`);
    assert.ok(row.assignments >= 8, `${slug} has assignments, got ${row.assignments}`);
    assert.ok(row.capstones >= 1, `${slug} has a capstone`);

    assert.equal(row.duration.value, 9);
    assert.equal(row.duration.unit, 'MONTHS');
    assert.equal(row.stageLinkedSlug, slug, 'the stage points at this course');
  }
});

test('every activity credits a real subject - nothing falls to UNASSIGNED', async () => {
  const audit = await curriculum.auditCurriculum();

  for (const row of audit) {
    assert.equal(
      row.bySubject.UNASSIGNED,
      0,
      `${row.slug} has unassigned activities: ${row.unassigned.slice(0, 10).join(', ')}`
    );
    // And all three subjects are genuinely taught in each stage, rather than
    // the course being one subject wearing three labels.
    assert.ok(row.bySubject.ENGLISH >= 10, `${row.slug} teaches English (${row.bySubject.ENGLISH})`);
    assert.ok(row.bySubject.COMPUTER >= 10, `${row.slug} teaches Computer (${row.bySubject.COMPUTER})`);
    assert.ok(row.bySubject.CYBERSECURITY >= 10, `${row.slug} teaches Cybersecurity (${row.bySubject.CYBERSECURITY})`);
  }
});

test('no lesson is a placeholder', async () => {
  const audit = await curriculum.auditCurriculum();
  for (const row of audit) {
    assert.equal(
      row.emptyLessons.length,
      0,
      `${row.slug} has lessons with no real material: ${row.emptyLessons.slice(0, 8).join(', ')}`
    );
  }

  // And no lesson title is one of the placeholder shapes the brief forbids.
  const courses = await Course.find({ slug: { $in: SLUGS } }).lean();
  const banned = /^(lesson \d+|introduction|coming soon|content tbd|lorem ipsum|tbd|todo)$/i;
  for (const course of courses) {
    for (const mod of course.modules || []) {
      for (const lesson of mod.lessons || []) {
        assert.ok(!banned.test(lesson.title.trim()), `placeholder title: ${lesson.lessonId} "${lesson.title}"`);
        assert.ok(lesson.summary && lesson.summary.length > 20, `${lesson.lessonId} has no summary`);
      }
    }
  }
});

test('every quiz question is answerable and has a correct option', async () => {
  const quizzes = await Quiz.find({}).lean();
  assert.ok(quizzes.length >= 8, 'quizzes were created');

  for (const quiz of quizzes) {
    assert.ok(quiz.questions.length >= 4, `${quiz.quizId} has real questions`);
    assert.ok(quiz.subject, `${quiz.quizId} is subject tagged`);
    for (const q of quiz.questions) {
      assert.ok(q.question.length > 15, `${quiz.quizId}/${q.questionId} has a real question`);
      assert.ok(q.options.length >= 3, `${quiz.quizId}/${q.questionId} has real options`);
      assert.ok(
        q.correctIndex >= 0 && q.correctIndex < q.options.length,
        `${quiz.quizId}/${q.questionId} correctIndex ${q.correctIndex} is out of range`
      );
      assert.ok(q.explanation && q.explanation.length > 20, `${quiz.quizId}/${q.questionId} explains the answer`);
      assert.equal(new Set(q.options).size, q.options.length, `${quiz.quizId}/${q.questionId} has duplicate options`);
    }
  }
});

test('every assignment states an actual task', async () => {
  const tasks = await Task.find({}).lean();
  assert.ok(tasks.length >= 16, 'assignments were created');
  for (const task of tasks) {
    assert.ok(task.subject, `${task.taskId} is subject tagged`);
    assert.ok(task.description.length > 300, `${task.taskId} has a real brief, got ${task.description.length} chars`);
    assert.ok(task.courseId, `${task.taskId} belongs to a course`);
  }
});

test('seeding again changes nothing', async () => {
  const before = {
    courses: await Course.find({ slug: { $in: SLUGS } }).lean(),
    quizzes: await Quiz.countDocuments({}),
    tasks: await Task.countDocuments({}),
  };

  const { courses } = await curriculum.seedCurriculum({ apply: true });

  const created = courses.flatMap((c) => c.decisions).filter((d) => d.action === 'CREATE');
  assert.equal(created.length, 0, `second run created ${created.length} items: ${created.slice(0, 5).map((d) => d.id).join(', ')}`);

  assert.equal(await Quiz.countDocuments({}), before.quizzes, 'no duplicate quizzes');
  assert.equal(await Task.countDocuments({}), before.tasks, 'no duplicate tasks');

  for (const prior of before.courses) {
    const now = await Course.findById(prior._id).lean();
    assert.equal(now.modules.length, prior.modules.length, `${prior.slug} gained no duplicate modules`);
    const lessonsBefore = prior.modules.reduce((n, m) => n + m.lessons.length, 0);
    const lessonsNow = now.modules.reduce((n, m) => n + m.lessons.length, 0);
    assert.equal(lessonsNow, lessonsBefore, `${prior.slug} gained no duplicate lessons`);
  }
});

test('an edit made after seeding survives a re-run', async () => {
  // The seed adds and never overwrites, because by the time it runs again an
  // administrator may have changed something and reasserting the code version
  // would discard their work silently.
  const course = await Course.findOne({ slug: 'garud' });
  const mod = course.modules.find((m) => m.moduleId === 'garud-m01');
  mod.lessons[0].title = 'EDITED BY AN ADMINISTRATOR';
  mod.lessons[0].duration = '99 mins';
  await course.save();

  await curriculum.seedCurriculum({ apply: true });

  const after = await Course.findOne({ slug: 'garud' }).lean();
  const lesson = after.modules.find((m) => m.moduleId === 'garud-m01').lessons[0];
  assert.equal(lesson.title, 'EDITED BY AN ADMINISTRATOR', 'the edit was not overwritten');
  assert.equal(lesson.duration, '99 mins');

  // Restore so later assertions about content quality still hold.
  const restore = await Course.findOne({ slug: 'garud' });
  const rmod = restore.modules.find((m) => m.moduleId === 'garud-m01');
  rmod.lessons[0].title = '1.1 From Beginner to Builder';
  rmod.lessons[0].duration = '20 mins';
  await restore.save();
});

test('seeding creates no students, enrolments, progress or XP', async () => {
  // Content existing is not the same as anybody having access to it. The
  // eligibility gate decides that, and a populated course must not change
  // anyone's standing.
  assert.equal(await Enrollment.countDocuments({}), 0, 'no enrolments');
  assert.equal(await StudentProfile.countDocuments({}), 0, 'no learner profiles');
  assert.equal(await ProgressionEvent.countDocuments({}), 0, 'no progression events');
  assert.equal(await LessonProgress.countDocuments({}), 0, 'no lesson progress');
});

test('the three subject scores move independently', async () => {
  // The critical test. One activity from each subject, checked after each, so
  // that a change to the wrong score is attributable to the activity that
  // caused it rather than discovered at the end.
  const student = await registerAndLogin(ctx.request, {
    name: 'Curriculum QA',
    email: `curriculum.qa.${Math.random().toString(36).slice(2, 8)}@example.com`,
  });
  const userId = student.user._id;
  const course = await Course.findOne({ slug: 'garud' }).lean();
  await Enrollment.create({ userId, courseId: course._id, status: 'active', enrollmentId: `ENR-C-${Math.random().toString(36).slice(2, 8)}` });

  const scores = async () => {
    const { profile } = await engine.rebuildSnapshot(userId);
    const by = {};
    for (const s of profile.progression.skills || []) by[s.subjectCode] = s.score;
    return { ENGLISH: by.ENGLISH || 0, COMPUTER: by.COMPUTER || 0, CYBERSECURITY: by.CYBERSECURITY || 0 };
  };

  const start = await scores();
  assert.deepEqual(start, { ENGLISH: 0, COMPUTER: 0, CYBERSECURITY: 0 }, 'a new student starts at zero everywhere');

  // ENGLISH: a lesson from module 1.
  await engine.recordActivity({
    userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'garud-m01-l01', courseId: course._id, subjectCode: 'ENGLISH',
  });
  const afterEnglish = await scores();
  assert.ok(afterEnglish.ENGLISH > start.ENGLISH, 'English rose');
  assert.equal(afterEnglish.COMPUTER, start.COMPUTER, 'Computer did not move');
  assert.equal(afterEnglish.CYBERSECURITY, start.CYBERSECURITY, 'Cybersecurity did not move');

  // COMPUTER: a lesson from module 2.
  await engine.recordActivity({
    userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'garud-m02-l01', courseId: course._id, subjectCode: 'COMPUTER',
  });
  const afterComputer = await scores();
  assert.ok(afterComputer.COMPUTER > afterEnglish.COMPUTER, 'Computer rose');
  assert.equal(afterComputer.ENGLISH, afterEnglish.ENGLISH, 'English did not move');
  assert.equal(afterComputer.CYBERSECURITY, afterEnglish.CYBERSECURITY, 'Cybersecurity did not move');

  // CYBERSECURITY: a lesson from the networking module.
  await engine.recordActivity({
    userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'garud-m06-l01', courseId: course._id, subjectCode: 'CYBERSECURITY',
  });
  const afterCyber = await scores();
  assert.ok(afterCyber.CYBERSECURITY > afterComputer.CYBERSECURITY, 'Cybersecurity rose');
  assert.equal(afterCyber.ENGLISH, afterComputer.ENGLISH, 'English did not move');
  assert.equal(afterCyber.COMPUTER, afterComputer.COMPUTER, 'Computer did not move');
});

test('completing the same curriculum lesson twice pays once', async () => {
  const student = await registerAndLogin(ctx.request, {
    name: 'Idempotency QA',
    email: `curriculum.idem.${Math.random().toString(36).slice(2, 8)}@example.com`,
  });
  const userId = student.user._id;
  const course = await Course.findOne({ slug: 'garud' }).lean();
  await Enrollment.create({ userId, courseId: course._id, status: 'active', enrollmentId: `ENR-I-${Math.random().toString(36).slice(2, 8)}` });

  const first = await engine.recordActivity({
    userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'garud-m07-l01', courseId: course._id, subjectCode: 'CYBERSECURITY',
  });
  const second = await engine.recordActivity({
    userId, activityType: 'LECTURE_COMPLETED', status: 'COMPLETED',
    refId: 'garud-m07-l01', courseId: course._id, subjectCode: 'CYBERSECURITY',
  });

  assert.ok(first.xpAwarded > 0, 'the first completion pays');
  assert.equal(second.duplicate, true, 'the second is recognised as a duplicate');
  assert.equal(second.xpAwarded, 0, 'and pays nothing');

  const events = await ProgressionEvent.countDocuments({ userId, refId: 'garud-m07-l01' });
  assert.equal(events, 1, 'only one progression event exists');
});

test('a populated stage does not become enterable', async () => {
  // Creating content must not change who may enter the stage. With no published
  // eligibility rule, GARUD stays shut.
  const student = await registerAndLogin(ctx.request, {
    name: 'Access QA',
    email: `curriculum.access.${Math.random().toString(36).slice(2, 8)}@example.com`,
  });
  const { profile } = await engine.rebuildSnapshot(student.user._id);
  const garud = (profile.progression.eligibility || []).find((e) => e.stageCode === 'GARUD');

  assert.equal(garud.eligible, false, 'still not eligible');
  assert.equal(garud.status, 'NOT_CONFIGURED', 'because no rule is published, not because content was missing');
});
