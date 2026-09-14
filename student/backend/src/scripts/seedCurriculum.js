/**
 * The GARUD and YODDHA curriculum, as real modules, lessons, quizzes and tasks.
 *
 *   npm run seed:curriculum                    Dry run. Prints every decision.
 *   npm run seed:curriculum -- --apply         Writes.
 *   npm run seed:curriculum -- --only=garud    One course.
 *   npm run seed:curriculum -- --audit         Reports what is in the database.
 *
 * Safe to run repeatedly. Anything already present is left exactly as it is,
 * including edits made by an administrator or teacher after seeding. It writes
 * no student data of any kind - no enrolments, progress, XP or achievements.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { seedCurriculum, auditCurriculum } from '../services/progression/curriculum.service.js';

const COUNT_KINDS = ['module', 'lesson', 'quiz', 'task'];

function printAudit(rows) {
  console.log('\n  CONTENT AUDIT\n');
  for (const r of rows) {
    if (!r.present) {
      console.log(`    ${r.slug.padEnd(9)} NOT PRESENT - course record does not exist\n`);
      continue;
    }
    console.log(`    ${r.title}`);
    console.log(`      slug            ${r.slug}`);
    console.log(`      courseId        ${r.courseId}`);
    console.log(`      stage           ${r.stageCode || 'none'}  (id ${r.stageId || 'none'}, linked to ${r.stageLinkedSlug || 'nothing'})`);
    console.log(`      duration        ${r.duration.value} ${r.duration.unit}  ("${r.duration.label}")`);
    console.log(`      published       ${r.isPublished}   purchasable ${r.isPurchasable}`);
    console.log(`      months          ${r.months}`);
    console.log(`      modules         ${r.modules}`);
    console.log(`      lessons         ${r.lessons}`);
    console.log(`      quizzes         ${r.quizzes}`);
    console.log(`      assessments     ${r.assessments}`);
    console.log(`      assignments     ${r.assignments}`);
    console.log(`      capstones       ${r.capstones}`);
    console.log(`      quiz questions  ${r.questions}`);
    console.log(`      ENGLISH         ${r.bySubject.ENGLISH}`);
    console.log(`      COMPUTER        ${r.bySubject.COMPUTER}`);
    console.log(`      CYBERSECURITY   ${r.bySubject.CYBERSECURITY}`);
    console.log(`      UNASSIGNED      ${r.bySubject.UNASSIGNED}${r.unassigned.length ? '  <- ' + r.unassigned.slice(0, 5).join(', ') : ''}`);
    if (r.emptyLessons.length) {
      console.log(`      THIN LESSONS    ${r.emptyLessons.length}  <- ${r.emptyLessons.slice(0, 5).join(', ')}`);
    }
    console.log('');
  }
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const auditOnly = args.includes('--audit');
  const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;

  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}`);

  try {
    if (auditOnly) {
      printAudit(await auditCurriculum());
      return;
    }

    const { courses } = await seedCurriculum({ apply, only });

    for (const course of courses) {
      console.log(`\n  ${course.slug.toUpperCase()}`);

      const created = course.decisions.filter((d) => d.action === 'CREATE');
      const unchanged = course.decisions.filter((d) => d.action === 'UNCHANGED');
      const missing = course.decisions.filter((d) => d.action === 'MISSING');

      for (const m of missing) console.log(`    ${m.kind.padEnd(7)} ${m.id.padEnd(24)} MISSING   ${m.detail}`);

      for (const kind of COUNT_KINDS) {
        const c = created.filter((d) => d.kind === kind).length;
        const u = unchanged.filter((d) => d.kind === kind).length;
        if (c || u) console.log(`    ${kind.padEnd(7)} create ${String(c).padStart(3)}   unchanged ${String(u).padStart(3)}`);
      }

      // The detail matters on a first run; on a repeat run it is all unchanged.
      for (const d of created.slice(0, 200)) {
        console.log(`      + ${d.kind.padEnd(7)} ${d.id.padEnd(24)} ${d.detail}`);
      }
      if (created.length > 200) console.log(`      ... and ${created.length - 200} more`);
    }

    console.log(
      apply
        ? '\n  Applied. Content exists; nobody has been enrolled and no progress was created.\n'
        : '\n  DRY RUN - nothing was written. Re-run with --apply.\n'
    );

    if (apply) printAudit(await auditCurriculum());
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
