/**
 * The three stages of the Nalanda Nexus journey, as real courses.
 *
 *   npm run seed:journey              Dry run. Prints what would change.
 *   npm run seed:journey -- --apply   Makes the changes.
 *
 * Additive and idempotent. PRARAMBH already exists in production with real
 * enrolments, payments and progress behind it, so it is UPDATED in place -
 * never recreated - and only the duration fields are touched. GARUD and YODDHA
 * are created if absent and left alone if present.
 *
 * Both new courses are created NOT purchasable. They exist, are visible, and are
 * gated by the eligibility engine; what they do not yet have is a price or a
 * payment flow, and a course that could be bought for nothing is a worse
 * placeholder than one that plainly cannot be bought yet.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Course } from '../models/Course.js';
import { Stage } from '../models/Stage.js';
import { Enrollment } from '../models/Enrollment.js';

const DURATION = { durationValue: 9, durationUnit: 'MONTHS', duration: '9 Months' };

const JOURNEY = [
  {
    stageCode: 'PRARAMBH',
    slug: 'prarambh',
    // Existing production course: matched, never created.
    createIfMissing: false,
  },
  {
    stageCode: 'GARUD',
    slug: 'garud',
    createIfMissing: true,
    doc: {
      title: 'GARUD — The Rise',
      subtitle: 'Build Your Power',
      tagline: 'Sharpen what you started. Build range, depth and confidence.',
      description:
        'GARUD is the second stage of the Nalanda Nexus journey. It builds on the foundations laid in PRARAMBH, deepening communication, computing and cybersecurity into working capability.',
      category: 'foundation',
      // The course pillar is only a DEFAULT for untagged activities; GARUD
      // carries all three subjects at the activity level, as PRARAMBH does.
      pillar: 'communicate',
      difficulty: 'Intermediate',
      grades: ['6', '7', '8', '9', '10', '11', '12'],
      priceInPaise: 0,
      isPublished: true,
      isPurchasable: false,
      modules: [],
    },
  },
  {
    stageCode: 'YODDHA',
    slug: 'yoddha',
    createIfMissing: true,
    doc: {
      title: 'YODDHA — The Warrior',
      subtitle: 'Master Your Skills. Lead With Confidence.',
      tagline: 'Lead, present and defend your work in the real world.',
      description:
        'YODDHA is the final stage of the Nalanda Nexus journey. It turns capability into leadership: communicating under pressure, applying computing to real problems, and thinking about security as a practitioner.',
      category: 'foundation',
      pillar: 'communicate',
      difficulty: 'Advanced',
      grades: ['6', '7', '8', '9', '10', '11', '12'],
      priceInPaise: 0,
      isPublished: true,
      isPurchasable: false,
      modules: [],
    },
  },
];

function parseArgs(argv) {
  return { apply: argv.includes('--apply') };
}

async function run() {
  const { apply } = parseArgs(process.argv.slice(2));

  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}\n`);

  try {
    console.log('  COURSES');
    for (const entry of JOURNEY) {
      const existing = await Course.findOne({ slug: entry.slug });

      if (!existing && !entry.createIfMissing) {
        console.log(`    ${entry.slug.padEnd(10)} MISSING - expected an existing production course, leaving alone`);
        continue;
      }

      if (!existing) {
        console.log(`    ${entry.slug.padEnd(10)} create "${entry.doc.title}" (${DURATION.duration}, not yet purchasable)`);
        if (apply) await Course.create({ slug: entry.slug, ...entry.doc, ...DURATION });
        continue;
      }

      // Only the duration is touched on an existing course. Its title, price,
      // content, publication state and every enrolment behind it are left as
      // they are.
      const needsDuration =
        existing.durationValue !== DURATION.durationValue || existing.durationUnit !== DURATION.durationUnit;
      const enrolments = await Enrollment.countDocuments({ courseId: existing._id });

      if (needsDuration) {
        console.log(
          `    ${entry.slug.padEnd(10)} update duration "${existing.duration || 'none'}" -> ${DURATION.duration}` +
            `  (${enrolments} existing enrolment(s), untouched)`
        );
        if (apply) {
          await Course.updateOne({ _id: existing._id }, { $set: DURATION });
        }
      } else {
        console.log(`    ${entry.slug.padEnd(10)} duration already ${DURATION.duration}, left alone`);
      }
    }

    console.log('\n  STAGE LINKS');
    for (const entry of JOURNEY) {
      const stage = await Stage.findOne({ code: entry.stageCode });
      if (!stage) {
        console.log(`    ${entry.stageCode.padEnd(10)} no stage defined - run seed:progression first`);
        continue;
      }
      if (stage.courseSlug === entry.slug) {
        console.log(`    ${entry.stageCode.padEnd(10)} already linked to "${entry.slug}"`);
        continue;
      }
      console.log(`    ${entry.stageCode.padEnd(10)} link ${stage.courseSlug || 'none'} -> "${entry.slug}"`);
      if (apply) await Stage.updateOne({ _id: stage._id }, { $set: { courseSlug: entry.slug } });
    }

    console.log(
      apply
        ? '\n  Done. GARUD and YODDHA exist and are gated by the eligibility engine;\n' +
            '  set their price and turn on isPurchasable in the payment pass.\n'
        : '\n  DRY RUN - nothing was written. Re-run with --apply.\n'
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
