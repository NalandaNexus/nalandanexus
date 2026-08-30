#!/usr/bin/env node
/**
 * Issues an enrollmentId to enrollments created before the field existed.
 *
 * Enrollment IDs are the business identity the other two portals join on, and
 * rows predating them carry none. This is additive and reversible in intent: it
 * only ever fills an ABSENT value, never rewrites one that exists, and touches
 * no other field.
 *
 * Usage
 * -----
 *   node src/scripts/backfillEnrollmentIds.js
 *       DRY RUN. Reports how many rows would be given an id, and shows the first
 *       few. Writes nothing.
 *
 *   node src/scripts/backfillEnrollmentIds.js --apply
 *       Assigns ids, oldest enrollment first so the sequence follows real
 *       chronology.
 *
 * Safety
 * ------
 * - Never overwrites an existing enrollmentId (they are quoted externally).
 * - Never deletes, never changes status, batch, progress, or ownership.
 * - Uses the same atomic counter as live enrollment, so a backfill running
 *   beside real traffic cannot hand out a number twice.
 * - Re-runnable: a second run finds nothing left to do.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Enrollment } from '../models/Enrollment.js';
import { nextEnrollmentId } from '../services/enrollment.service.js';
import '../models/Counter.js';

const APPLY = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}`);

  try {
    // Absent OR null: production may hold both shapes depending on when the row
    // was written relative to the schema change.
    const filter = { $or: [{ enrollmentId: { $exists: false } }, { enrollmentId: null }] };
    const pending = await Enrollment.find(filter).sort({ enrolledAt: 1, createdAt: 1 });

    const total = await Enrollment.countDocuments();
    console.log(`  ${total} enrollment(s) total, ${pending.length} without a business identifier.`);

    if (!pending.length) {
      console.log('\n  Nothing to backfill.\n');
      return;
    }

    if (!APPLY) {
      console.log('\n  These would be assigned (showing up to 10):');
      for (const e of pending.slice(0, 10)) {
        const when = e.enrolledAt ? new Date(e.enrolledAt).toISOString().slice(0, 10) : 'unknown date';
        console.log(`    ${String(e._id)}  enrolled ${when}`);
      }
      console.log('\n  DRY RUN - nothing was written. Re-run with --apply to commit.\n');
      return;
    }

    let assigned = 0;
    for (const enrollment of pending) {
      enrollment.enrollmentId = await nextEnrollmentId(enrollment.enrolledAt || enrollment.createdAt || new Date());
      // The model refuses a changed enrollmentId on an existing document; this
      // is the one sanctioned path, and it only ever fills an absent value.
      enrollment.$locals.allowEnrollmentIdBackfill = true;
      await enrollment.save();
      assigned += 1;
    }

    console.log(`\n  Assigned ${assigned} identifier(s). No other field was modified.`);
    console.log('  Batch placement is separate and deliberately not done here - place students explicitly.\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
});
