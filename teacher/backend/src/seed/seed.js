/**
 * Development seed script — NOT for production data.
 *
 * Populates one demo teacher account with real classes, curriculum
 * concepts, today's schedule template, courses, exams, and resources —
 * enough to log in and see a non-empty shell without an empty state.
 *
 * Deliberately does NOT fabricate students, assignments, submissions,
 * attendance, or messages: a "Student" only ever becomes real by way of
 * syncEnrollmentForClass matching a genuine student-portal purchase (see
 * services/student.service.js), and an "Assignment" only ever becomes real
 * by a teacher actually creating one. A previous version of this script
 * inserted 256 synthetic Student documents (and fake graded submissions to
 * match) that were visually indistinguishable from real, paying students —
 * that generator is gone, not merely hidden, so it can't be reintroduced by
 * accident. See student.service.js#listStudents and friends, which now
 * additionally filter on `linkedUserId` so an old/unlinked roster row
 * can't resurface even if one exists in an existing database.
 *
 * Usage:
 *   npm run seed            # seed if this teacher has no data yet
 *   npm run seed -- --reset # wipe this teacher's data first, then reseed
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';

import { env, assertEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Student } from '../models/Student.js';
import { Concept } from '../models/Concept.js';
import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { Attendance } from '../models/Attendance.js';
import { ClassSession } from '../models/ClassSession.js';
import { Notification } from '../models/Notification.js';
import { Course } from '../models/Course.js';
import { Exam } from '../models/Exam.js';
import { Resource } from '../models/Resource.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { AuditLog } from '../models/AuditLog.js';
import { fetchStudentCourseOptions } from '../services/studentBridge.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'demoFixture.json'), 'utf-8'));

const shouldReset = process.argv.includes('--reset') || process.argv.includes('--destroy');

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

async function main() {
  assertEnv();
  await connectDatabase();

  const existingUser = await User.findOne({ email: env.seedTeacherEmail });

  if (existingUser && !shouldReset) {
    const existingTeacher = await Teacher.findOne({ user: existingUser._id });
    const classCount = existingTeacher ? await SchoolClass.countDocuments({ teacher: existingTeacher._id }) : 0;
    if (classCount > 0) {
      console.log(`[seed] Demo data already present for ${env.seedTeacherEmail} (${classCount} classes). Run "npm run seed -- --reset" to wipe and reseed.`);
      await disconnectDatabase();
      return;
    }
  }

  if (existingUser && shouldReset) {
    await wipeTeacherData(existingUser._id);
  }

  console.log('[seed] Creating demo teacher account...');
  const { teacher } = await createDemoTeacher();

  console.log('[seed] Creating classes...');
  const classByCode = await createClasses(teacher._id);

  console.log('[seed] Creating concepts...');
  const conceptByKey = await createConcepts(teacher._id);

  console.log("[seed] Creating today's class sessions (one live now)...");
  await createTodaysSessions(teacher._id, classByCode, conceptByKey);

  console.log('[seed] Creating courses, exams, resources...');
  await createCourses(teacher._id, classByCode);
  await createExams(teacher._id, classByCode);
  await createResources(teacher._id, classByCode);

  console.log('[seed] Creating a welcome notification...');
  await createNotifications(teacher._id);

  console.log('\n[seed] Done!');
  console.log('──────────────────────────────────────────────');
  console.log(`  Login email:    ${env.seedTeacherEmail}`);
  console.log(`  Login password: ${env.seedTeacherPassword}`);
  console.log(`  Classes:        ${Object.keys(classByCode).length}`);
  console.log('  Students:       0 (real students appear only after a real purchase — see "Sync Enrollment" on a class)');
  console.log('  Assignments:    0 (create one from the app — it will reach real enrolled students automatically)');
  console.log('──────────────────────────────────────────────\n');

  await disconnectDatabase();
}

async function wipeTeacherData(userId) {
  const teacher = await Teacher.findOne({ user: userId });
  console.log(`[seed] --reset: wiping previous demo data for ${env.seedTeacherEmail}...`);
  if (teacher) {
    const teacherId = teacher._id;
    await Promise.all([
      Student.deleteMany({ teacher: teacherId }),
      Assignment.deleteMany({ teacher: teacherId }),
      Submission.deleteMany({ teacher: teacherId }),
      Attendance.deleteMany({ teacher: teacherId }),
      ClassSession.deleteMany({ teacher: teacherId }),
      Notification.deleteMany({ recipient: teacherId }),
      Course.deleteMany({ teacher: teacherId }),
      Exam.deleteMany({ teacher: teacherId }),
      Resource.deleteMany({ teacher: teacherId }),
      Concept.deleteMany({ teacher: teacherId }),
      Conversation.deleteMany({ teacher: teacherId }),
      AuditLog.deleteMany({ actor: teacherId }),
      SchoolClass.deleteMany({ teacher: teacherId }),
    ]);
    await Message.deleteMany({ conversation: { $nin: await Conversation.find().distinct('_id') } }); // orphaned cleanup
    await Teacher.deleteOne({ _id: teacherId });
  }
  await User.deleteOne({ _id: userId });
}

async function createDemoTeacher() {
  const passwordHash = await User.hashPassword(env.seedTeacherPassword);
  const user = await User.create({
    name: 'Dr. Rajesh Varma',
    email: env.seedTeacherEmail,
    phone: '+91 98765 43210',
    passwordHash,
    role: 'teacher',
    status: 'active',
  });

  const teacher = await Teacher.create({
    user: user._id,
    teacherId: 'TCH-0001',
    title: 'Senior Faculty & Lead Educator',
    department: 'Physics & Physical Sciences',
    subject: 'Physics',
    qualification: 'Ph.D. in Physics, IIT Delhi',
    experienceYears: 12,
    bio: 'Passionate physics educator specializing in mechanics, optics, and electromagnetism for grades 9-12.',
    tier: 'pro',
    accountStatus: 'active',
  });

  return { user, teacher };
}

/**
 * Coaching-style batches, not school grade/sections — every batch links to
 * a REAL, purchasable course from the student portal's public catalog
 * (see studentBridge.service.js#fetchStudentCourseOptions), matching
 * validators/class.validators.js#createClassValidator's real requirement.
 * If the student portal has no courses yet (e.g. a fresh environment where
 * student/backend hasn't been seeded), this correctly creates zero
 * classes rather than fabricating a batch with no real course to attach
 * it to — an honest empty state beats a fake one.
 */
async function createClasses(teacherId) {
  const courses = await fetchStudentCourseOptions();
  if (!courses.length) {
    console.log('[seed] No real courses found in the student portal catalog yet — skipping batch creation. Seed student/backend first, or create a batch from the app once a course exists.');
    return {};
  }

  const byCode = {};
  const slots = fixture.classes; // reused only for schedule/room variety, not for grade/section
  const batchCount = Math.min(courses.length, slots.length, 4);

  for (let i = 0; i < batchCount; i += 1) {
    const course = courses[i];
    const slot = slots[i];
    const name = `Batch ${String.fromCharCode(65 + i)}`; // 'Batch A', 'Batch B', ...
    const code = `${course.slug}-${name}`.toUpperCase().replace(/[^A-Z0-9-]+/g, '-');
    const cls = await SchoolClass.create({
      code,
      name,
      teacher: teacherId,
      room: slot.room,
      schedule: slot.schedule,
      capacity: 40,
      academicSession: currentAcademicSession(),
      status: 'active',
      studentCourseSlug: course.slug,
    });
    byCode[code] = cls;
  }
  return byCode;
}

async function createConcepts(teacherId) {
  const byKey = {};
  for (const c of fixture.concepts) {
    const concept = await Concept.create({
      key: c.key,
      name: c.name,
      subject: c.subject,
      description: c.description,
      teacher: teacherId,
    });
    byKey[c.key] = concept;
  }
  return byKey;
}

async function createTodaysSessions(teacherId, classByCode, conceptByKey) {
  const classes = Object.values(classByCode);
  const chosen = shuffle(classes).slice(0, Math.min(4, classes.length));
  const now = Date.now();
  const offsetsMinutes = [-10, 120, 240, 360]; // first one is "live now"
  const concepts = Object.values(conceptByKey);

  for (let i = 0; i < chosen.length; i += 1) {
    const cls = chosen[i];
    const concept = pick(concepts);
    await ClassSession.create({
      class: cls._id,
      teacher: teacherId,
      startAt: new Date(now + offsetsMinutes[i] * 60000),
      durationMinutes: 45,
      topic: `${concept.name} — ${pick(['Introduction', 'Problem Solving', 'Numerical Practice', 'Revision'])}`,
      room: cls.room,
      status: 'scheduled',
    });
  }
}

async function createCourses(teacherId, classByCode) {
  const classes = Object.values(classByCode);
  if (!classes.length) return;

  await Course.create({
    title: 'Advanced Electrodynamics & Wave Optics',
    category: 'Physics',
    teacher: teacherId,
    classes: classes.map((c) => c._id),
    modulesCount: 12,
    rating: 4.8,
    status: 'active',
  });
}

async function createExams(teacherId, classByCode) {
  const classes = Object.values(classByCode);
  const templates = [
    { title: 'Wave Optics: Interference & Diffraction', type: 'quiz', totalQuestions: 15, durationMinutes: 30, status: 'scheduled', daysFromNow: 1 },
    { title: 'Newtonian Gravitation & Kepler Laws', type: 'test', totalQuestions: 20, durationMinutes: 45, status: 'draft', daysFromNow: null },
    { title: 'Work, Power & Energy Benchmark Test', type: 'exam', totalQuestions: 25, durationMinutes: 60, status: 'active', daysFromNow: 0 },
  ];
  if (!classes.length) return;
  for (let i = 0; i < templates.length; i += 1) {
    const t = templates[i];
    await Exam.create({
      title: t.title,
      class: classes[i % classes.length]._id,
      teacher: teacherId,
      type: t.type,
      totalQuestions: t.totalQuestions,
      durationMinutes: t.durationMinutes,
      scheduledAt: t.daysFromNow === null ? null : new Date(Date.now() + t.daysFromNow * 86400000),
      status: t.status,
    });
  }
}

async function createResources(teacherId, classByCode) {
  const uploadsDir = path.resolve(__dirname, '../../uploads/resources');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const templates = [
    { title: 'Ray Optics: Formula Sheets & Ray Diagrams', type: 'pdf', filename: 'ray-optics-formula-sheet.pdf' },
    { title: 'Newton Laws: Free Body Diagram Handbook', type: 'pdf', filename: 'newton-laws-handbook.pdf' },
    { title: 'Electromagnetism Maxwell Equations Guide', type: 'pdf', filename: 'em-maxwell-guide.pdf' },
  ];

  const classes = Object.values(classByCode);
  if (!classes.length) return;
  for (const t of templates) {
    const filePath = path.join(uploadsDir, t.filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `Placeholder demo resource: ${t.title}\nSeeded by Nalanda Nexus dev seed script.\n`);
    }
    const size = fs.statSync(filePath).size;
    await Resource.create({
      title: t.title,
      type: t.type,
      fileUrl: `/uploads/resources/${t.filename}`,
      fileName: t.filename,
      fileSize: size,
      subject: 'Physics',
      class: pick(classes)._id,
      teacher: teacherId,
      downloadsCount: 0,
    });
  }
}

async function createNotifications(teacherId) {
  await Notification.create([
    {
      recipient: teacherId,
      type: 'system',
      title: 'Welcome to Nalanda Nexus',
      message: 'Your faculty workspace is ready. Students appear on your roster automatically once they purchase a course linked to one of your classes — see "Sync Enrollment" on the Classes page.',
      isRead: true,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function currentAcademicSession() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

main().catch(async (err) => {
  console.error('[seed] Fatal error:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
