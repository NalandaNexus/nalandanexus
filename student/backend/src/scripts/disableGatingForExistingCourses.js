#!/usr/bin/env node
/**
 * One-time deployment step: sets progressionGatingEnabled: false on every
 * course that does not already have it explicitly set, so that shipping the
 * mandatory-progression gate (courseGating.service.js) does not itself
 * silently start enforcing anything for students already enrolled in
 * existing courses.
 *
 * Why this exists: Course.progressionGatingEnabled defaults to true in the
 * schema (every NEW course is gated unless an admin opts it out) - the
 * right default going forward, since mandatory progression is the whole
 * point of this feature. But Mongoose applies schema defaults on READ for
 * any document missing the field, not only on create - so the moment
 * courseGating.service.js is wired into course.controller.js, every course
 * that predates this field (or simply hasn't had the toggle touched yet)
 * would be read as gated=true with no admin having reviewed anything. That
 * is exactly the "single blind global flip" the rollout plan requires never
 * happens: dry-run each course, notify affected students, THEN flip it on,
 * one course at a time.
 *
 * Run this BEFORE or atomically WITH deploying this feature - not after.
 * It is safe to run more than once (a course already explicitly false is
 * left alone) and touches no other field on any course.
 *
 * Usage
 * -----
 *   node src/scripts/disableGatingForExistingCourses.js
 *       DRY RUN. Reports how many courses would be changed and lists them.
 *       Writes nothing.
 *
 *   node src/scripts/disableGatingForExistingCourses.js --apply
 *       Sets progressionGatingEnabled: false on every course that is not
 *       already explicitly false (an unset field, or any other current
 *       value, both count as "not yet explicitly set").
 *
 * After running this with --apply, use moduleGatingDryRun.js to review each
 * course's real impact before turning its gate back on.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Course } from '../models/Course.js';

const APPLY = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}`);

  try {
    // Lean, deliberately: a lean read skips schema defaults entirely, so this
    // sees the field exactly as it is actually stored (or truly absent) -
    // never the application-level default this script exists to neutralize.
    const courses = await Course.find({ progressionGatingEnabled: { $ne: false } })
      .select('slug title progressionGatingEnabled')
      .lean();

    const total = await Course.countDocuments();
    console.log(`  ${total} course(s) total, ${courses.length} not yet explicitly set to false.`);

    if (!courses.length) {
      console.log('\n  Nothing to do - every course already has an explicit gating setting.\n');
      return;
    }

    console.log('\n  These would be set to progressionGatingEnabled: false:');
    for (const c of courses) {
      const current = c.progressionGatingEnabled === undefined ? 'unset, currently defaults to true' : String(c.progressionGatingEnabled);
      console.log(`    ${c.slug}  (currently: ${current})`);
    }

    if (!APPLY) {
      console.log('\n  DRY RUN - nothing was written. Re-run with --apply to commit.\n');
      return;
    }

    const result = await Course.updateMany(
      { progressionGatingEnabled: { $ne: false } },
      { $set: { progressionGatingEnabled: false } }
    );
    console.log(`\n  Updated ${result.modifiedCount} course(s). No other field was modified.`);
    console.log('  Review each course with moduleGatingDryRun.js before turning its gate back on.\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
});
