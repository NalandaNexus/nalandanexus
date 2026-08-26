/**
 * Removes the test records created during the August 2026 production
 * readiness audit.
 *
 * Everything it touches is QA data on the reserved example.com domain, plus
 * one community post containing a harmless XSS probe string that the product
 * has no delete endpoint for. It is deliberately narrow:
 *
 *   - it only ever matches the exact QA email addresses listed below
 *   - it only deletes a community post whose author is one of those accounts
 *     AND whose body contains the probe string
 *   - it prints a plan and does nothing at all unless run with --confirm
 *
 * Usage (from student/backend):
 *   node scripts/cleanupQaData.mjs            # dry run - shows what it would do
 *   node scripts/cleanupQaData.mjs --confirm  # actually deletes
 *
 * Reads MONGODB_URI from student/backend/.env, so point that at whichever
 * database you mean to clean before running it.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const CONFIRM = process.argv.includes('--confirm');

const QA_EMAILS = [
  'qa.alpha@example.com',
  'qa.bravo@example.com',
  'qa.charlie@example.com',
  'qa.delta@example.com',
];

const XSS_PROBE = '<script>alert(document.cookie)</script>';

function log(action, detail) {
  console.log(`${CONFIRM ? '[delete]' : '[dry-run]'} ${action}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Check student/backend/.env');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Connected to "${db.databaseName}"\n`);

  // ---- 1. The QA accounts ------------------------------------------
  const users = await db.collection('users').find({ email: { $in: QA_EMAILS } }).toArray();
  if (!users.length) {
    console.log('No QA accounts found — already cleaned up.\n');
  }
  const userIds = users.map((u) => u._id);

  for (const user of users) {
    log('user', `${user.email} (${user._id})`);
  }

  // ---- 2. The XSS-probe community post -----------------------------
  // Narrow on BOTH author and content so a real student post can never match.
  const postFilter = { userId: { $in: userIds }, body: { $regex: XSS_PROBE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } };
  const posts = await db.collection('posts').find(postFilter).toArray();
  for (const post of posts) {
    log('community post', `${post._id} (contains the XSS probe string)`);
  }

  // ---- 3. Everything owned by those accounts -----------------------
  // Collections keyed by userId. Anything not listed here is left alone.
  const OWNED_COLLECTIONS = [
    'studentprofiles',
    'enrollments',
    'orders',
    'notes',
    'notifications',
    'quizattempts',
    'tasksubmissions',
    'lessonprogresses',
    'xpevents',
    'refreshtokens',
    'passwordresettokens',
    'emailverificationtokens',
    'supporttickets',
    'messages',
    'posts',
  ];

  const counts = {};
  for (const name of OWNED_COLLECTIONS) {
    const n = await db.collection(name).countDocuments({ userId: { $in: userIds } });
    if (n > 0) {
      counts[name] = n;
      log(name, `${n} document(s)`);
    }
  }

  if (!CONFIRM) {
    console.log('\nNothing was deleted. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }

  console.log('');
  for (const name of Object.keys(counts)) {
    const res = await db.collection(name).deleteMany({ userId: { $in: userIds } });
    console.log(`deleted ${res.deletedCount} from ${name}`);
  }
  if (posts.length) {
    const res = await db.collection('posts').deleteMany(postFilter);
    console.log(`deleted ${res.deletedCount} community post(s) carrying the XSS probe`);
  }
  if (userIds.length) {
    const res = await db.collection('users').deleteMany({ _id: { $in: userIds } });
    console.log(`deleted ${res.deletedCount} QA user account(s)`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Cleanup failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
