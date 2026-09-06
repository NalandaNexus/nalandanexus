#!/usr/bin/env node
/**
 * Generates a batch of coupons for one course.
 *
 * Built for the launch giveaway - 25 single-use codes at 100% off - but it takes
 * the course and the count as arguments, so it is not a one-off.
 *
 * Usage
 * -----
 *   npm run seed:coupons -- --list-courses
 *       Prints the published courses and their slugs. Read-only.
 *
 *   npm run seed:coupons -- --course prarambh --count 25 --label "Launch 2026"
 *       DRY RUN by default. Says exactly what it would create and writes nothing.
 *
 *   npm run seed:coupons -- --course prarambh --count 25 --label "Launch 2026" --apply
 *       Creates them and prints the codes. This is the only time the full list is
 *       shown in one place, so capture the output.
 *
 * Safety
 * ------
 * - Dry run unless --apply is passed.
 * - Refuses to run twice for the same label on the same course, so a repeated
 *   deploy or a re-run cannot quietly mint a second set of 25. Override with
 *   --allow-duplicate-label when a second batch is genuinely wanted.
 * - Creates only. Never deletes, deactivates, or touches an existing coupon,
 *   course, enrollment or user.
 * - Codes come from crypto.randomInt via the same generator the admin UI uses.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Course } from '../models/Course.js';
import { Coupon } from '../models/Coupon.js';
import { createCampaign } from '../services/coupon.service.js';
import { CouponCampaign } from '../models/CouponCampaign.js';

function parseArgs(argv) {
  const args = { course: null, count: 25, label: null, expiresAt: null, apply: false, listCourses: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--list-courses') args.listCourses = true;
    else if (a === '--course') args.course = argv[++i];
    else if (a === '--count') args.count = Number(argv[++i]);
    else if (a === '--label') args.label = argv[++i];
    else if (a === '--expires') args.expiresAt = argv[++i];
  }
  return args;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  // Checked before connecting: a mistyped flag should not require a working
  // database to find out about, and --list-courses is the one mode that has
  // nothing to validate.
  if (args.course && !args.listCourses) {
    if (!Number.isInteger(args.count) || args.count < 1 || args.count > 500) {
      fail('--count must be a whole number between 1 and 500.');
    }
    if (!String(args.label || '').trim()) {
      fail('--label is required: it names the campaign, and is what stops a re-run creating a second batch.');
    }
  }

  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}`);

  try {
    if (args.listCourses || !args.course) {
      const courses = await Course.find({ isPublished: true }).select('slug title priceInPaise').sort({ createdAt: 1 }).lean();
      if (!args.course) console.log('  (no --course given, listing published courses)');
      console.log(`\n  ${courses.length} published course(s):\n`);
      for (const c of courses) {
        console.log(`    ${String(c.slug).padEnd(28)} ${String(c.title).slice(0, 40).padEnd(42)} ₹${(c.priceInPaise / 100).toFixed(2)}`);
      }
      console.log('\n  Re-run with --course <slug> --count 25 --label "..." to preview a batch.\n');
      return;
    }


    const course = await Course.findOne({ slug: args.course, isPublished: true });
    if (!course) fail(`No published course with slug "${args.course}". Run --list-courses to see the options.`);

    let expiresAt = null;
    if (args.expiresAt) {
      expiresAt = new Date(args.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) fail(`--expires "${args.expiresAt}" is not a valid date.`);
      if (expiresAt.getTime() <= Date.now()) fail('--expires is in the past; the coupons would be born expired.');
    }

    // The guard against minting a second set of 25 on a re-run. The unique index
    // on (courseId, name) enforces this regardless; checking here turns what
    // would be a duplicate-key stack trace into a sentence.
    const existingCampaign = await CouponCampaign.findOne({ courseId: course._id, name: args.label }).lean();
    if (existingCampaign) {
      const minted = await Coupon.countDocuments({ campaignId: existingCampaign._id });
      fail(
        `A campaign named "${args.label}" already exists for "${course.title}" with ${minted} coupon(s). ` +
          'Nothing was created. Use a different --label to mint a separate campaign.'
      );
    }

    const already = await Coupon.countDocuments({ courseId: course._id });
    console.log(`\n  Course:   ${course.title} (${course.slug})`);
    console.log(`  Price:    ₹${(course.priceInPaise / 100).toFixed(2)}`);
    console.log(`  Existing: ${already} coupon(s) already attached to this course`);
    console.log(`  Creating: ${args.count} × 100% off, single use${expiresAt ? `, expiring ${expiresAt.toISOString().slice(0, 10)}` : ', no expiry'}`);
    if (args.label) console.log(`  Label:    ${args.label}`);

    if (!args.apply) {
      console.log('\n  DRY RUN - nothing was written. Re-run with --apply to create them.\n');
      return;
    }

    const { campaign, coupons: created } = await createCampaign({
      courseId: course._id,
      name: args.label,
      count: args.count,
      discountType: 'FULL',
      discountValue: 100,
      maxUses: 1,
      expiresAt,
      createdByName: 'seedCoupons.js',
    });

    console.log(`  Campaign: ${campaign.name} (${campaign._id})`);
    console.log(`\n  Created ${created.length} coupon(s):\n`);
    for (const c of created) console.log(`    ${c.code}`);
    console.log('\n  Capture these now - they are shown together only here.');
    console.log('  Each is valid once, for this course only, and is worth the full price.\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
});
