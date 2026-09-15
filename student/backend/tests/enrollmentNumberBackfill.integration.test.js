import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Numbering the students who enrolled before enrollment numbers existed.
 *
 * Runs against its own throwaway mongod, and never through the app's
 * configuration: the models are connected directly, and the backfill script is
 * run as a real process with MONGODB_URI pointed at that mongod and a working
 * directory that holds no .env file - so it cannot pick up whatever database
 * the backend's own .env names.
 */

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(BACKEND, 'src/scripts/backfillEnrollmentNumbers.js');

let mongod;
let uri;
let workdir;
let User;
let StudentProfile;
let Enrollment;
let Order;
let service;
let people;

const uniq = () => crypto.randomBytes(4).toString('hex');
const digest = async (Model) =>
  crypto.createHash('sha256').update(JSON.stringify(await Model.find().sort({ _id: 1 }).lean())).digest('hex');

before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  uri = mongod.getUri('backfill_test');
  await mongoose.connect(uri);
  assert.equal(mongoose.connection.host, '127.0.0.1', 'connected to the throwaway mongod');

  ({ User } = await import('../src/models/User.js'));
  ({ StudentProfile } = await import('../src/models/StudentProfile.js'));
  ({ Enrollment } = await import('../src/models/Enrollment.js'));
  ({ Order } = await import('../src/models/Order.js'));
  service = await import('../src/services/studentProfile.service.js');
  await Promise.all([StudentProfile.init(), Enrollment.init(), User.init()]);

  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-backfill-'));

  const student = (name, role = 'student') => User.create({ name, email: `${name.toLowerCase().replace(/\s+/g, '.')}.${uniq()}@example.com`, role });
  const courseA = new mongoose.Types.ObjectId();
  const courseB = new mongoose.Types.ObjectId();

  // Created in this order on purpose: two students share a first-enrolment date,
  // and the tie is broken by account id, which follows creation order.
  const early = await student('Early Student');
  const tieFirst = await student('Tie First');
  const tieSecond = await student('Tie Second');
  const numbered = await student('Already Numbered');
  const revokedOnly = await student('Revoked Only');
  const staff = await student('Staff Member', 'teacher');
  const noCourse = await student('No Course');

  await StudentProfile.create({ userId: early._id, grade: '10th Standard' });
  await StudentProfile.create({ userId: tieSecond._id });
  await StudentProfile.create({ userId: numbered._id, enrollmentNumber: 'NN24-000777' });
  // tieFirst deliberately has no profile record at all.

  await Enrollment.create([
    { userId: early._id, courseId: courseA, enrolledAt: new Date('2024-05-01'), progressPercent: 62 },
    { userId: early._id, courseId: courseB, enrolledAt: new Date('2025-06-01') },
    { userId: tieFirst._id, courseId: courseA, enrolledAt: new Date('2025-01-15') },
    { userId: tieSecond._id, courseId: courseA, enrolledAt: new Date('2025-01-15') },
    { userId: numbered._id, courseId: courseA, enrolledAt: new Date('2023-01-01') },
    { userId: revokedOnly._id, courseId: courseA, enrolledAt: new Date('2024-01-01'), status: 'revoked' },
    { userId: staff._id, courseId: courseA, enrolledAt: new Date('2024-01-01') },
  ]);
  await Order.create({ userId: early._id, courseId: courseA, razorpayOrderId: `order_${uniq()}`, amountInPaise: 99900, status: 'paid' });

  people = { early, tieFirst, tieSecond, numbered, revokedOnly, staff, noCourse };
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  fs.rmSync(workdir, { recursive: true, force: true });
});

function runScript(args) {
  assert.equal(fs.existsSync(path.join(workdir, '.env')), false, 'the script runs where no .env can be read');
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: workdir,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, MONGODB_URI: uri, NODE_ENV: 'test', JWT_ACCESS_SECRET: 'backfill_test', JWT_REFRESH_SECRET: 'backfill_test' },
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert.match(output, /Connected to backfill_test on 127\.0\.0\.1/, `the script must report the throwaway database:\n${output}`);
  return { code: result.status, output };
}

const numberOf = async (user) => (await StudentProfile.findOne({ userId: user._id }).lean())?.enrollmentNumber ?? null;

test('a dry run proposes a deterministic order and writes nothing', async () => {
  const before = await Promise.all([digest(User), digest(StudentProfile), digest(Enrollment), digest(Order)]);

  const report = await service.backfillEnrollmentNumbers();
  assert.equal(report.applied, false);
  assert.deepEqual(
    report.plan.map((p) => p.userId),
    [people.early, people.tieFirst, people.tieSecond].map((u) => String(u._id)),
    'earliest first enrolment first; a tie goes to the older account'
  );
  assert.equal(report.pending, 3, 'the numbered, revoked-only, staff and course-less accounts are all left out');

  const again = await service.backfillEnrollmentNumbers();
  assert.deepEqual(again.plan, report.plan, 'the same data proposes the same plan');

  const script = runScript([]);
  assert.equal(script.code, 0, script.output);
  assert.match(script.output, /DRY RUN - nothing was written/);

  const after = await Promise.all([digest(User), digest(StudentProfile), digest(Enrollment), digest(Order)]);
  assert.deepEqual(after, before, 'not one document changed');
});

test('--apply numbers each student once, by the year they first enrolled, and touches nothing else', async () => {
  const untouched = await Promise.all([digest(User), digest(Enrollment), digest(Order)]);

  const run = runScript(['--apply']);
  assert.equal(run.code, 0, run.output);
  assert.match(run.output, /Issued 3 enrollment number\(s\)/);

  assert.equal(await numberOf(people.early), 'NN24-000001', 'first enrolled in 2024, numbered as a 2024 student');
  assert.equal(await numberOf(people.tieFirst), 'NN25-000001', 'a missing profile record is created to hold the number');
  assert.equal(await numberOf(people.tieSecond), 'NN25-000002');
  assert.equal(await numberOf(people.numbered), 'NN24-000777', 'an existing number is never changed');
  for (const skipped of [people.revokedOnly, people.staff, people.noCourse]) {
    assert.equal(await numberOf(skipped), null, `${skipped.name} holds no active course and is not numbered`);
  }
  assert.equal((await StudentProfile.findOne({ userId: people.early._id }).lean()).grade, '10th Standard', 'other profile fields are untouched');

  assert.deepEqual(await Promise.all([digest(User), digest(Enrollment), digest(Order)]), untouched, 'accounts, enrolments and payments are byte-for-byte unchanged');

  const rerun = runScript(['--apply']);
  assert.equal(rerun.code, 0, rerun.output);
  assert.match(rerun.output, /Nothing to backfill/, 'a second run finds nothing left to do');
});

test('--revert removes exactly what was issued, and never a number someone else now holds', async () => {
  const records = fs.readdirSync(workdir).filter((f) => f.startsWith('enrollment-numbers-'));
  assert.equal(records.length, 1, 'one record, from the one run that issued numbers');
  const recordPath = path.join(workdir, records[0]);
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  assert.equal(record.database, 'backfill_test');
  assert.equal(record.assigned.length, 3);

  // A stale line naming the pre-existing number: reverting must not remove it.
  record.assigned.push({ userId: String(people.numbered._id), enrollmentNumber: 'NN24-000001' });
  fs.writeFileSync(recordPath, JSON.stringify(record));

  const revert = runScript(['--revert', recordPath]);
  assert.equal(revert.code, 0, revert.output);
  assert.match(revert.output, /Removed 3 of 4/);

  for (const user of [people.early, people.tieFirst, people.tieSecond]) assert.equal(await numberOf(user), null);
  assert.equal(await numberOf(people.numbered), 'NN24-000777');
});

test('the database itself refuses a second student holding the same number', async () => {
  await StudentProfile.updateOne({ userId: people.early._id }, { $set: { enrollmentNumber: 'NN24-555555' } });
  await assert.rejects(
    StudentProfile.updateOne({ userId: people.tieFirst._id }, { $set: { enrollmentNumber: 'NN24-555555' } }),
    (err) => err.code === 11000
  );
});
