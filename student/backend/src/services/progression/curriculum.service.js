import { Course } from '../../models/Course.js';
import { Stage } from '../../models/Stage.js';
import { Quiz } from '../../models/Quiz.js';
import { Task } from '../../models/Task.js';
import { CURRICULUM } from '../../curriculum/index.js';
import { resolveSubject } from './subject.service.js';

/**
 * Putting the GARUD and YODDHA curriculum into the database.
 *
 * Two properties matter more than anything else here.
 *
 * It adds and never overwrites. An item already present - a module, a lesson, a
 * quiz, a task - is left exactly as it is, because by the time this runs a
 * second time an administrator or teacher may have edited it, and a seed that
 * reasserts its own version would silently discard that work. The cost is that
 * changing the curriculum in code does not update a course that already has it;
 * that is the correct trade, and the report says plainly which items were
 * skipped so the difference is visible rather than assumed.
 *
 * It touches no student data. No enrolments, no progress, no XP, no
 * achievements, no attendance, no payments. Creating content is not the same as
 * giving anybody access to it: the eligibility gate still decides that, and a
 * populated course changes nothing about who may enter it.
 *
 * PRARAMBH is deliberately not in the curriculum registry. It has live students
 * behind it and content authored before this existed.
 */

/** A quiz that assesses a whole stage rather than a module. */
const isAssessment = (quizId) => /final-assessment$/.test(quizId);

/** A task that is the stage's culminating piece of work. */
const isCapstone = (taskId) => /capstone/.test(taskId);

/** "Month 3 · Operating Systems" -> 3. Modules are grouped into months by title. */
function monthOf(moduleTitle) {
  const match = /^Month\s+(\d+)/.exec(moduleTitle || '');
  return match ? Number(match[1]) : null;
}

/**
 * Brings one course's content into existence, or reports what it would do.
 *
 * Returns a decision per item rather than a count, because "created" and
 * "already present, left alone" are different outcomes and an operator running
 * this against production deserves to see which happened to what.
 */
async function seedCourse(entry, { apply }) {
  const decisions = [];
  const course = await Course.findOne({ slug: entry.slug });

  if (!course) {
    decisions.push({
      kind: 'course',
      id: entry.slug,
      action: 'MISSING',
      detail: 'course does not exist - run the journey seed first; curriculum not applied',
    });
    return { slug: entry.slug, decisions };
  }

  // --- modules and lessons ---------------------------------------------------
  const existingModules = new Map((course.modules || []).map((m) => [m.moduleId, m]));
  let courseChanged = false;

  for (const mod of entry.modules) {
    const existing = existingModules.get(mod.moduleId);

    if (!existing) {
      decisions.push({
        kind: 'module',
        id: mod.moduleId,
        action: 'CREATE',
        detail: `${mod.title} (${mod.lessons.length} lessons, subject ${mod.subject})`,
      });
      if (apply) {
        course.modules.push({
          moduleId: mod.moduleId,
          title: mod.title,
          order: mod.order,
          subject: mod.subject,
          lessons: mod.lessons.map((l) => ({
            lessonId: l.lessonId,
            title: l.title,
            duration: l.duration,
            order: mod.lessons.indexOf(l) + 1,
            subject: l.subject,
            summary: l.summary,
            content: l.content,
            isPublished: true,
          })),
        });
        courseChanged = true;
      }
      continue;
    }

    decisions.push({ kind: 'module', id: mod.moduleId, action: 'UNCHANGED', detail: 'already present, left alone' });

    // A module can exist while a lesson added to the curriculum later does not.
    const existingLessons = new Set((existing.lessons || []).map((l) => l.lessonId));
    for (const lesson of mod.lessons) {
      if (existingLessons.has(lesson.lessonId)) continue;
      decisions.push({ kind: 'lesson', id: lesson.lessonId, action: 'CREATE', detail: lesson.title });
      if (apply) {
        existing.lessons.push({
          lessonId: lesson.lessonId,
          title: lesson.title,
          duration: lesson.duration,
          order: (existing.lessons?.length || 0) + 1,
          subject: lesson.subject,
          summary: lesson.summary,
          content: lesson.content,
          isPublished: true,
        });
        courseChanged = true;
      }
    }
  }

  if (apply && courseChanged) {
    course.modules.sort((a, b) => a.order - b.order);
    await course.save();
  }

  // --- quizzes ---------------------------------------------------------------
  for (const mod of entry.modules) {
    for (const quiz of mod.quizzes || []) {
      const existing = await Quiz.findOne({ quizId: quiz.quizId }).select('_id').lean();
      if (existing) {
        decisions.push({ kind: 'quiz', id: quiz.quizId, action: 'UNCHANGED', detail: 'already present, left alone' });
        continue;
      }
      decisions.push({
        kind: 'quiz',
        id: quiz.quizId,
        action: 'CREATE',
        detail: `${quiz.title} (${quiz.questions.length} questions, subject ${quiz.subject})`,
      });
      if (apply) {
        await Quiz.create({
          quizId: quiz.quizId,
          courseId: course._id,
          subject: quiz.subject,
          title: quiz.title,
          moduleTitle: mod.title,
          pointsReward: quiz.pointsReward,
          timeLimitMins: quiz.timeLimitMins,
          questions: quiz.questions,
          isPublished: true,
        });
      }
    }
  }

  // --- tasks and assignments -------------------------------------------------
  for (const mod of entry.modules) {
    for (const task of mod.tasks || []) {
      const existing = await Task.findOne({ taskId: task.taskId }).select('_id').lean();
      if (existing) {
        decisions.push({ kind: 'task', id: task.taskId, action: 'UNCHANGED', detail: 'already present, left alone' });
        continue;
      }
      decisions.push({
        kind: 'task',
        id: task.taskId,
        action: 'CREATE',
        detail: `${task.title} (subject ${task.subject})`,
      });
      if (apply) {
        await Task.create({
          taskId: task.taskId,
          courseId: course._id,
          subject: task.subject,
          title: task.title,
          type: task.type || 'Task',
          description: task.description,
          moduleTitle: mod.title,
          dueOffsetDays: task.dueOffsetDays ?? 14,
          urgency: task.urgency || 'medium',
          iconName: task.iconName || 'FileText',
          pointsReward: task.pointsReward ?? 40,
          order: mod.order,
          isPublished: true,
        });
      }
    }
  }

  return { slug: entry.slug, decisions };
}

/**
 * Seeds every course in the curriculum registry.
 *
 * Dry by default, matching the journey seed: an operator sees the full list of
 * decisions before anything is written.
 */
export async function seedCurriculum({ apply = false, only = null } = {}) {
  const entries = Object.values(CURRICULUM).filter((e) => !only || e.slug === only);
  const courses = [];
  for (const entry of entries) {
    courses.push(await seedCourse(entry, { apply }));
  }
  return { applied: apply, courses };
}

/**
 * What is actually in the database for these courses.
 *
 * Subjects are resolved through the real resolver rather than read off the
 * records, so the audit reports what the progression engine will actually
 * credit - including anything that would land in UNASSIGNED, which is the
 * number this audit exists to keep at zero.
 */
export async function auditCurriculum() {
  const report = [];

  for (const entry of Object.values(CURRICULUM)) {
    const course = await Course.findOne({ slug: entry.slug }).lean();
    const stage = await Stage.findOne({ code: entry.stageCode }).lean();

    if (!course) {
      report.push({ slug: entry.slug, present: false });
      continue;
    }

    const quizzes = await Quiz.find({ courseId: course._id }).select('quizId title subject questions').lean();
    const tasks = await Task.find({ courseId: course._id }).select('taskId title subject type').lean();

    const bySubject = { ENGLISH: 0, COMPUTER: 0, CYBERSECURITY: 0, UNASSIGNED: 0 };
    const unassigned = [];

    const credit = async (activitySubject, moduleSubject, id) => {
      const resolved = await resolveSubject({
        activitySubject,
        moduleSubject,
        coursePillar: course.pillar,
      });
      bySubject[resolved] = (bySubject[resolved] || 0) + 1;
      if (resolved === 'UNASSIGNED') unassigned.push(id);
    };

    const moduleSubjectById = new Map((course.modules || []).map((m) => [m.moduleId, m.subject]));
    let lessons = 0;

    for (const mod of course.modules || []) {
      for (const lesson of mod.lessons || []) {
        lessons += 1;
        await credit(lesson.subject, mod.subject, lesson.lessonId);
      }
    }
    for (const quiz of quizzes) {
      // A quiz belongs to a module by title; its own subject is authoritative
      // and is set on every quiz this curriculum defines.
      await credit(quiz.subject, null, quiz.quizId);
    }
    for (const task of tasks) {
      await credit(task.subject, null, task.taskId);
    }

    const months = new Set((course.modules || []).map((m) => monthOf(m.title)).filter((n) => n !== null));

    report.push({
      slug: entry.slug,
      present: true,
      courseId: String(course._id),
      title: course.title,
      stageCode: stage?.code || null,
      stageId: stage ? String(stage._id) : null,
      stageLinkedSlug: stage?.courseSlug || null,
      duration: {
        value: course.durationValue,
        unit: course.durationUnit,
        label: course.duration,
      },
      isPublished: course.isPublished,
      isPurchasable: course.isPurchasable,
      months: months.size,
      modules: (course.modules || []).length,
      lessons,
      quizzes: quizzes.filter((q) => !isAssessment(q.quizId)).length,
      assessments: quizzes.filter((q) => isAssessment(q.quizId)).length,
      assignments: tasks.filter((t) => !isCapstone(t.taskId)).length,
      capstones: tasks.filter((t) => isCapstone(t.taskId)).length,
      questions: quizzes.reduce((n, q) => n + (q.questions?.length || 0), 0),
      bySubject,
      unassigned,
      // Lessons carrying no teaching material at all, which is what the
      // content-quality requirement exists to prevent.
      emptyLessons: (course.modules || [])
        .flatMap((m) => m.lessons || [])
        .filter((l) => !l.content || l.content.trim().length < 200)
        .map((l) => l.lessonId),
    });
  }

  return report;
}

export default { seedCurriculum, auditCurriculum };
