/**
 * Progression configuration.
 *
 *   npm run seed:progression
 *       Dry run. Prints what would change and writes nothing.
 *
 *   npm run seed:progression -- --apply
 *       Creates the subjects, stages, achievements and rules document if they
 *       are missing, and tags untagged Prarambh lessons with the subject its
 *       pillar implies. Idempotent and additive: it never overwrites a subject
 *       an administrator has already set, and never edits an existing rule.
 *
 * Deliberately has no demo mode. Every number the platform shows is derived from
 * a student's own recorded activity, and seeding fabricated learners would put
 * invented people into the same collections the dashboards and averages read
 * from - which is exactly the thing the engine exists to make impossible.
 * A new deployment starts at zero and fills up as students actually learn.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Subject, DEFAULT_SUBJECTS, PILLAR_DEFAULT_SUBJECT } from '../models/Subject.js';
import { Stage, DEFAULT_STAGES } from '../models/Stage.js';
import { Achievement, DEFAULT_ACHIEVEMENTS } from '../models/Achievement.js';
import { Course } from '../models/Course.js';
import { ensureRules } from '../services/progression/rules.service.js';
import { ProgressionRules } from '../models/ProgressionRules.js';

function parseArgs(argv) {
  return { apply: argv.includes('--apply') };
}

async function seedConfig(apply) {
  const report = [];

  const existingSubjects = await Subject.countDocuments({});
  if (existingSubjects === 0) {
    report.push(`subjects:     create ${DEFAULT_SUBJECTS.length} (${DEFAULT_SUBJECTS.map((s) => s.code).join(', ')})`);
    if (apply) await Subject.insertMany(DEFAULT_SUBJECTS.map((s) => ({ ...s })));
  } else {
    report.push(`subjects:     ${existingSubjects} already defined, left alone`);
  }

  const existingStages = await Stage.countDocuments({});
  if (existingStages === 0) {
    report.push(`stages:       create ${DEFAULT_STAGES.length} (${DEFAULT_STAGES.map((s) => s.code).join(' -> ')})`);
    if (apply) await Stage.insertMany(DEFAULT_STAGES.map((s) => ({ ...s })));
  } else {
    report.push(`stages:       ${existingStages} already defined, left alone`);
  }

  const existingAchievements = await Achievement.countDocuments({});
  if (existingAchievements === 0) {
    report.push(`achievements: create ${DEFAULT_ACHIEVEMENTS.length}`);
    if (apply) await Achievement.insertMany(DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })));
  } else {
    report.push(`achievements: ${existingAchievements} already defined, left alone`);
  }

  const rules = await ProgressionRules.findOne({ key: 'GLOBAL' });
  if (!rules) {
    report.push('rules:        create the GLOBAL rules document with launch defaults');
    if (apply) await ensureRules();
  } else {
    report.push('rules:        GLOBAL document exists, left alone');
  }

  return report;
}

/**
 * Gives every untagged lesson the subject its course pillar implies.
 *
 * The safe starting point the migration decision calls for: nothing is
 * overwritten, so a lesson an administrator has already classified keeps that
 * classification, and everything else gets a defensible default they can
 * correct in the UI rather than a null that silently scores nothing.
 */
async function tagLessons(apply) {
  const courses = await Course.find({}).select('slug title pillar modules').lean();
  const changes = [];

  for (const course of courses) {
    const fallback = PILLAR_DEFAULT_SUBJECT[String(course.pillar || '').toLowerCase()];
    if (!fallback) continue;

    let untagged = 0;
    for (const mod of course.modules || []) {
      for (const lesson of mod.lessons || []) {
        if (!lesson.subject && !mod.subject) untagged += 1;
      }
    }
    if (!untagged) continue;

    changes.push(`  ${course.slug}: ${untagged} lesson(s) -> ${fallback} (from pillar "${course.pillar}")`);

    if (apply) {
      const doc = await Course.findById(course._id);
      for (const mod of doc.modules) {
        for (const lesson of mod.lessons) {
          if (!lesson.subject && !mod.subject) lesson.subject = fallback;
        }
      }
      await doc.save();
    }
  }
  return changes;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}\n`);

  try {
    const config = await seedConfig(args.apply);
    console.log('  CONFIGURATION');
    for (const line of config) console.log(`    ${line}`);

    console.log('\n  LESSON SUBJECT TAGGING');
    const tagged = await tagLessons(args.apply);
    if (tagged.length) {
      for (const line of tagged) console.log(line);
      console.log('\n    Defaults only - correct individual lessons from the admin or teacher UI.');
    } else {
      console.log('    Nothing untagged.');
    }

    if (!args.apply) {
      console.log('\n  DRY RUN - nothing was written. Re-run with --apply.\n');
    } else {
      console.log('\n  Done.\n');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
