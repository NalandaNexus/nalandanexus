#!/usr/bin/env node
/**
 * Previews the real-world impact of turning a course's mandatory-progression
 * gate on, before anyone actually flips it - the required first step in the
 * rollout plan (see courseGating.service.js#dryRunImpact for the comparison
 * logic: today's lock state vs. what it would be with the course-level gate
 * forced on). Writes nothing, ever - there is no --apply mode for this
 * script, and no notification is sent; sending the real notifications this
 * report justifies is a separate, deliberate step.
 *
 * Usage
 * -----
 *   node src/scripts/moduleGatingDryRun.js <course-slug>
 *       Reports every actively-enrolled student who would newly lose access
 *       to a specific module or lesson if this course's gate were turned on
 *       right now, and why.
 *
 *   node src/scripts/moduleGatingDryRun.js --all
 *       Same report for every course in the catalogue, one section each.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Course } from '../models/Course.js';
import { dryRunImpact } from '../services/courseGating.service.js';

const ALL = process.argv.includes('--all');
const slugArg = process.argv.slice(2).find((a) => !a.startsWith('--'));

function printReport(report) {
  console.log(`\n  ${report.courseTitle}  (${report.courseSlug})`);
  console.log(`  Currently gated: ${report.currentlyGated ? 'yes' : 'no'}`);
  console.log(`  Active enrollments: ${report.totalActiveEnrollments}`);
  console.log(`  Students who would newly lose access: ${report.studentsNewlyLocked}`);

  for (const row of report.impacted) {
    console.log(`\n    ${row.name || row.email || row.userId}`);
    for (const m of row.newlyLockedModules) {
      console.log(`      - module ${m.moduleId}: ${m.reason}`);
    }
    for (const l of row.newlyLockedLessons) {
      console.log(`      - lesson ${l.lessonId}: ${l.reason}`);
    }
  }
}

async function run() {
  if (!ALL && !slugArg) {
    console.error('\n  Usage: node src/scripts/moduleGatingDryRun.js <course-slug>  |  --all\n');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}`);

  try {
    const courses = ALL ? await Course.find() : await Course.find({ slug: slugArg });
    if (!courses.length) {
      console.log(`\n  No course found${ALL ? '' : ` for slug "${slugArg}"`}.\n`);
      return;
    }

    for (const course of courses) {
      const report = await dryRunImpact(course);
      printReport(report);
    }

    console.log('\n  This was a dry run - nothing was written, and no notification was sent.\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
});
