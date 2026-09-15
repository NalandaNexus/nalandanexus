#!/usr/bin/env node
/**
 * Issues an enrollment number to every student who already holds course access
 * but has none - the students who enrolled before enrollment numbers existed.
 *
 * Usage
 * -----
 *   node src/scripts/backfillEnrollmentNumbers.js
 *       DRY RUN. Reports who would be numbered, in the order they would be
 *       numbered. Writes nothing.
 *
 *   node src/scripts/backfillEnrollmentNumbers.js --apply
 *       Makes sure the unique index exists, then issues the numbers, earliest
 *       enrolment first. Writes a record of every number issued to
 *       enrollment-numbers-<timestamp>.json in the current directory.
 *
 *   node src/scripts/backfillEnrollmentNumbers.js --revert <record.json>
 *       Removes exactly the numbers a previous --apply issued, and only where the
 *       same student still holds that same number.
 *
 * Safety
 * ------
 * - Never changes a number that already exists; they are quoted by teachers,
 *   admins and support.
 * - Touches no field other than the enrollment number: no enrolment, payment,
 *   coupon, progress or identity.
 * - Issues through the same atomic counter and conditional write as live
 *   enrolment, so running beside real traffic cannot hand out a number twice.
 * - Re-runnable: a second --apply finds nothing left to do.
 * - Connects to whatever MONGODB_URI names. Check the database it prints before
 *   passing --apply.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { StudentProfile } from '../models/StudentProfile.js';
import '../models/Counter.js';
import { backfillEnrollmentNumbers, revertEnrollmentNumbers } from '../services/studentProfile.service.js';

const APPLY = process.argv.includes('--apply');
const revertIndex = process.argv.indexOf('--revert');
const REVERT_FILE = revertIndex > -1 ? process.argv[revertIndex + 1] : null;

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name} on ${mongoose.connection.host}`);

  try {
    if (REVERT_FILE) {
      const record = JSON.parse(fs.readFileSync(REVERT_FILE, 'utf8'));
      const { reverted } = await revertEnrollmentNumbers(record.assigned);
      console.log(`\n  Removed ${reverted} of ${record.assigned.length} number(s) recorded in ${REVERT_FILE}.\n`);
      return;
    }

    if (APPLY) {
      // Built before any number is written, so uniqueness is enforced by the
      // database from the first assignment even where automatic index builds
      // are switched off. createIndexes only adds; it never drops an index.
      await StudentProfile.createIndexes();
    }

    const report = await backfillEnrollmentNumbers({ apply: APPLY });
    console.log(`  ${report.studentsWithCourseAccess} student(s) hold course access; ${report.alreadyNumbered} already numbered, ${report.pending} without a number.`);

    if (!report.pending) {
      console.log('\n  Nothing to backfill.\n');
      return;
    }

    if (!APPLY) {
      console.log('\n  These would be numbered, in this order (showing up to 20):');
      for (const p of report.plan.slice(0, 20)) {
        const when = p.firstEnrolledAt ? new Date(p.firstEnrolledAt).toISOString().slice(0, 10) : 'unknown date';
        console.log(`    ${p.userId}  first enrolled ${when}`);
      }
      console.log('\n  DRY RUN - nothing was written. Re-run with --apply to commit.\n');
      return;
    }

    const file = path.resolve(`enrollment-numbers-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ database: mongoose.connection.name, assigned: report.assigned }, null, 2));
    console.log(`\n  Issued ${report.assigned.length} enrollment number(s). No other field was modified.`);
    console.log(`  Record written to ${file} - keep it; --revert needs it.\n`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
});
