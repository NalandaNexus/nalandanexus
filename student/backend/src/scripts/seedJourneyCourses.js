/**
 * The three stages of the Nalanda Nexus journey, as real courses.
 *
 *   npm run seed:journey              Dry run. Prints what would change.
 *   npm run seed:journey -- --apply   Makes the changes.
 *
 * A thin wrapper over progression/journey.service.js, which the admin portal
 * calls through its own endpoint - so a shell run and a button press cannot
 * disagree about what the journey is.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { setupJourney } from '../services/progression/journey.service.js';

async function run() {
  const apply = process.argv.slice(2).includes('--apply');

  await mongoose.connect(env.mongoUri);
  console.log(`\n  Connected to ${mongoose.connection.name}\n`);

  try {
    const { courses, links } = await setupJourney({ apply });

    console.log('  COURSES');
    for (const c of courses) console.log(`    ${c.slug.padEnd(10)} ${c.action.padEnd(16)} ${c.detail}`);

    console.log('\n  STAGE LINKS');
    for (const l of links) console.log(`    ${l.stage.padEnd(10)} ${l.action.padEnd(16)} ${l.detail}`);

    console.log(
      apply
        ? '\n  Done. Set a price and turn on isPurchasable for GARUD/YODDHA in the payment pass.\n'
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
