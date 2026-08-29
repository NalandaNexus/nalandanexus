#!/usr/bin/env node
/**
 * Bulk-applies an OPERATOR-SUPPLIED class -> student-course mapping.
 *
 * Why this exists
 * ---------------
 * Batches created before the course-link feature carry no `studentCourseSlug`.
 * `syncEnrollmentForClass` returns NOT_LINKED before it ever calls the student
 * portal, so those batches can never verify a roster, and
 * `resolveTeacherForCourseSlug` (which matches on the same field) resolves no
 * teacher for the course. The supported repair is the Classes page, where a
 * teacher picks the course themselves. This script is only for an operator who
 * already knows the mapping for many batches and would rather not click through
 * them one at a time.
 *
 * Why it will not guess
 * ---------------------
 * Nothing in the data says which course "Class 10A" teaches. Inferring it from
 * a name, a subject, or "the only course that exists" would attach real
 * students to a course nobody chose, and enrollment sync would then import a
 * roster against it. Every mapping must be written down by a human. There is no
 * --all, no default slug, and no heuristic fallback.
 *
 * Usage
 * -----
 *   node src/scripts/linkLegacyClasses.js --list
 *       Prints every unlinked batch (id, teacher, name) so you can build the
 *       mapping file. Read-only.
 *
 *   node src/scripts/linkLegacyClasses.js --file ./mapping.json
 *       DRY RUN by default: validates every slug against the live student
 *       catalogue and prints exactly what would change. Writes nothing.
 *
 *   node src/scripts/linkLegacyClasses.js --file ./mapping.json --apply
 *       Applies the mapping. Only ever sets `studentCourseSlug`.
 *
 * mapping.json - keys are class ids (preferred, unambiguous) or exact batch
 * names; values are student-course slugs:
 *
 *   {
 *     "68a1f...c21": "some-course-slug",
 *     "Class 10A":   "another-course-slug"
 *   }
 *
 * Safety
 * ------
 * - Never deletes, archives, or creates anything.
 * - Never touches teacher, roster, code, status, or any other field.
 * - Refuses any slug not present in the live student catalogue.
 * - Refuses to run at all if the catalogue is unreachable (a failed fetch and
 *   an empty catalogue look identical, and accepting slugs blind is what
 *   produced unrepairable batches in the first place).
 * - Skips batches that already have a link unless --relink is passed.
 * - Does NOT sync enrollment; run the Sync action per batch afterwards so each
 *   result is seen individually.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
// Imported for its side effect of registering the schema: teacherLabel below
// populates 'user', and without this Mongoose throws "Schema hasn't been
// registered for model User" the moment --list finds anything.
import '../models/User.js';
import { fetchStudentCourseCatalog } from '../services/studentBridge.service.js';

function parseArgs(argv) {
  const args = { list: false, file: null, apply: false, relink: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--apply') args.apply = true;
    else if (a === '--relink') args.relink = true;
    else if (a === '--file') args.file = argv[++i];
    else if (a.startsWith('--file=')) args.file = a.slice('--file='.length);
  }
  return args;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function teacherLabel(teacherId, cache) {
  const key = String(teacherId);
  if (!cache.has(key)) {
    const teacher = await Teacher.findById(teacherId).populate('user', 'name email').lean();
    cache.set(key, teacher?.user?.email || teacher?.user?.name || key);
  }
  return cache.get(key);
}

async function listUnlinked() {
  const classes = await SchoolClass.find({
    $or: [{ studentCourseSlug: null }, { studentCourseSlug: { $exists: false } }, { studentCourseSlug: '' }],
  })
    .sort({ name: 1 })
    .lean();

  if (!classes.length) {
    console.log('\n  Every batch already has a course link. Nothing to do.\n');
    return;
  }

  const cache = new Map();
  console.log(`\n  ${classes.length} batch(es) with no course link:\n`);
  for (const c of classes) {
    const who = await teacherLabel(c.teacher, cache);
    console.log(`    ${String(c._id)}  ${(c.name || '(unnamed)').padEnd(24)}  status=${c.status}  teacher=${who}`);
  }
  console.log('\n  Build a mapping file of { "<id or exact name>": "<course-slug>" } and re-run with --file.\n');
}

function readMapping(file) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) fail(`Mapping file not found: ${resolved}`);

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    fail(`Mapping file is not valid JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('Mapping file must be a JSON object of { "<class id or name>": "<course-slug>" }.');
  }

  const entries = Object.entries(parsed);
  if (!entries.length) fail('Mapping file is empty - nothing to apply.');
  for (const [key, slug] of entries) {
    if (typeof slug !== 'string' || !slug.trim()) {
      fail(`Mapping for "${key}" must be a non-empty course slug string.`);
    }
  }
  return entries.map(([key, slug]) => [key.trim(), slug.trim()]);
}

async function resolveTarget(key) {
  if (mongoose.Types.ObjectId.isValid(key)) {
    const byId = await SchoolClass.findById(key);
    if (byId) return { doc: byId };
  }
  const byName = await SchoolClass.find({ name: key });
  if (byName.length === 1) return { doc: byName[0] };
  if (byName.length > 1) {
    return { error: `matches ${byName.length} batches by name - use the class id instead` };
  }
  return { error: 'no batch found with that id or name' };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  await mongoose.connect(env.mongodbUri);
  console.log(`\n  Connected to ${mongoose.connection.name}`);

  try {
    if (args.list || !args.file) {
      if (!args.file) console.log('  (no --file given, listing unlinked batches)');
      await listUnlinked();
      return;
    }

    const mapping = readMapping(args.file);

    // Validate against the live catalogue BEFORE touching anything, and refuse
    // to proceed if it could not be read at all.
    const { ok, courses } = await fetchStudentCourseCatalog();
    if (!ok) {
      fail(
        'The student course catalogue is unreachable, so the slugs in this mapping cannot be verified. ' +
          'Nothing was changed. Check STUDENT_BACKEND_URL and try again.'
      );
    }
    const validSlugs = new Set(courses.map((c) => c.slug));
    if (!validSlugs.size) {
      fail('The student catalogue is reachable but contains no published courses. There is nothing valid to link to yet.');
    }
    console.log(`  Catalogue: ${validSlugs.size} published course(s) available for linking.`);

    const plan = [];
    const problems = [];

    for (const [key, slug] of mapping) {
      if (!validSlugs.has(slug)) {
        problems.push(`${key}: "${slug}" is not a published student course`);
        continue;
      }
      const { doc, error } = await resolveTarget(key);
      if (error) {
        problems.push(`${key}: ${error}`);
        continue;
      }
      if (doc.studentCourseSlug && !args.relink) {
        problems.push(`${key}: already linked to "${doc.studentCourseSlug}" (pass --relink to change it)`);
        continue;
      }
      plan.push({ doc, slug, from: doc.studentCourseSlug || null });
    }

    if (problems.length) {
      console.log(`\n  ${problems.length} entr(ies) will be SKIPPED:`);
      for (const p of problems) console.log(`    - ${p}`);
    }

    if (!plan.length) {
      console.log('\n  Nothing to apply.\n');
      return;
    }

    console.log(`\n  ${plan.length} batch(es) would be linked:`);
    for (const { doc, slug, from } of plan) {
      console.log(`    ${String(doc._id)}  ${(doc.name || '(unnamed)').padEnd(24)}  ${from || '(none)'} -> ${slug}`);
    }

    if (!args.apply) {
      console.log('\n  DRY RUN - nothing was written. Re-run with --apply to commit.\n');
      return;
    }

    let applied = 0;
    for (const { doc, slug } of plan) {
      doc.studentCourseSlug = slug;
      await doc.save();
      applied += 1;
    }
    console.log(`\n  Applied ${applied} link(s). Only studentCourseSlug was modified.`);
    console.log('  Next: open each batch on the Classes page and run Sync, so every result is reviewed individually.\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
});
