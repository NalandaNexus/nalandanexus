/**
 * Makes Admin the system of record for courses that already exist in the
 * student catalog — without duplicating them.
 *
 * Why this exists rather than "just re-create them in the Admin UI":
 *
 * Admin derives a course slug from its title, and checks that slug for
 * uniqueness only against its OWN collection. Re-creating
 * "PRARAMBH — The Awakening" therefore produces the slug
 * "prarambh-the-awakening", which does not collide with the student
 * catalog's existing "prarambh". The publish bridge matches on
 * { source: 'admin-portal', sourceId }, finds nothing, and INSERTS — leaving
 * two PRARAMBH courses on the storefront, the new one with modules: [] and
 * isPurchasable: true. Students could buy the empty duplicate.
 *
 * This script instead performs an *adoption*: it creates the governance
 * record in Admin carrying the student course's real slug, price and
 * description, then stamps the existing student course with
 * source: 'admin-portal' and that record's _id as sourceId. From then on the
 * bridge's upsert MATCHES the existing course and updates it in place.
 * Lesson content is never touched — upsertBridgedCourse only writes modules
 * via $setOnInsert.
 *
 * Both databases live on the same Atlas cluster, so one connection serves
 * both; MONGODB_URI from admin/backend/.env supplies the cluster and
 * STUDENT_DB_NAME (default "nalanda_student") names the other database.
 *
 * Usage (from admin/backend):
 *   node scripts/adoptExistingCourses.mjs            # dry run — shows the plan
 *   node scripts/adoptExistingCourses.mjs --confirm  # apply
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const CONFIRM = process.argv.includes('--confirm');
const STUDENT_DB = process.env.STUDENT_DB_NAME || 'nalanda_student';

function codeFor(slug) {
  return slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 20);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Check admin/backend/.env');

  await mongoose.connect(uri);
  const adminDb = mongoose.connection.db;
  const studentDb = mongoose.connection.getClient().db(STUDENT_DB);

  console.log(`admin db   : ${adminDb.databaseName}`);
  console.log(`student db : ${studentDb.databaseName}`);
  console.log(CONFIRM ? '\nMODE: APPLY\n' : '\nMODE: DRY RUN (nothing will be written)\n');

  const adminCourses = adminDb.collection('courses');
  const studentCourses = studentDb.collection('courses');

  // An admin account to record as the reviewer. Any active one will do; this
  // is bookkeeping, not authorisation — the script is run by an operator.
  const admin = await adminDb.collection('admins').findOne({});
  if (!admin) throw new Error('No admin account found to attribute the adoption to.');

  const candidates = await studentCourses.find({ source: { $ne: 'admin-portal' } }).toArray();
  if (!candidates.length) {
    console.log('Every student course is already owned by Admin. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  let adopted = 0;
  let skipped = 0;

  for (const course of candidates) {
    const existing = await adminCourses.findOne({ slug: course.slug, deletedAt: null });
    if (existing) {
      console.log(`SKIP   ${course.slug} — Admin already has a record with this slug (${existing._id})`);
      skipped += 1;
      continue;
    }

    const code = codeFor(course.slug);
    const clash = await adminCourses.findOne({ code });
    if (clash) {
      console.log(`SKIP   ${course.slug} — course code "${code}" is already taken in Admin`);
      skipped += 1;
      continue;
    }

    const now = new Date();
    const doc = {
      code,
      title: course.title,
      category: course.category || 'foundation',
      department: course.pillar || null,
      credits: 3,
      modulesCount: Array.isArray(course.modules) ? course.modules.length : 0,
      status: 'APPROVED',
      completionRate: 0,
      rating: course.rating || 0,
      submittedAt: now,
      reviewedAt: now,
      reviewedBy: admin._id,
      notes: 'Adopted from the existing student catalog by scripts/adoptExistingCourses.mjs',
      description: course.description || '',
      features: Array.isArray(course.skills) ? course.skills : [],
      priceInPaise: course.priceInPaise || 0,
      image: course.bannerImage || null,
      // The student course's OWN slug, so the bridge keeps addressing the
      // same course rather than minting a new one.
      slug: course.slug,
      catalogSyncedAt: now,
      catalogSyncStatus: 'synced',
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    console.log(
      `ADOPT  ${course.slug.padEnd(26)} code=${code.padEnd(20)} price=${doc.priceInPaise} modules=${doc.modulesCount}`
    );

    if (!CONFIRM) {
      adopted += 1;
      continue;
    }

    const { insertedId } = await adminCourses.insertOne(doc);
    await studentCourses.updateOne(
      { _id: course._id },
      { $set: { source: 'admin-portal', sourceId: String(insertedId) } }
    );
    adopted += 1;
  }

  console.log(`\n${CONFIRM ? 'Adopted' : 'Would adopt'}: ${adopted}   Skipped: ${skipped}`);
  if (!CONFIRM) console.log('Re-run with --confirm to apply.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Adoption failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
