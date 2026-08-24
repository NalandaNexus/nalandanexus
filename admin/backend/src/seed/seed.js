/**
 * Explicit, developer-triggered seed script (`npm run seed`). Never runs
 * automatically on server boot — this backend never silently inserts fake
 * data into a real deployment's database.
 *
 * Idempotent: re-running it will not duplicate the super admin account or
 * reference data (upserts / existence checks throughout).
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { assertEnv, env } from '../config/env.js';
import { Admin } from '../models/Admin.js';
import { Teacher } from '../models/Teacher.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Settings } from '../models/Settings.js';
import { ROLES } from '../constants/permissions.js';

async function seedSuperAdmin() {
  const existing = await Admin.findOne({ email: env.seedSuperAdminEmail });
  if (existing) {
    console.log(`[seed] Super admin already exists: ${existing.email}`);
    return existing;
  }
  const admin = await Admin.create({
    name: env.seedSuperAdminName,
    email: env.seedSuperAdminEmail,
    passwordHash: await Admin.hashPassword(env.seedSuperAdminPassword),
    role: ROLES.SUPER_ADMIN,
    badge: 'Root Authority',
    status: 'ACTIVE',
  });
  console.log(`[seed] Created super admin: ${admin.email} / (password set from SEED_SUPER_ADMIN_PASSWORD)`);
  return admin;
}

async function seedTeachers() {
  const specs = [
    { name: 'Dr. Rajesh Varma', email: 'rajesh.varma@nalanda.edu', department: 'Computer Science', subject: 'Data Structures', rating: 4.8, studentsCount: 142, coursesCount: 3, status: 'ACTIVE' },
    { name: 'Prof. Priya Singh', email: 'priya.singh@nalanda.edu', department: 'Physics', subject: 'Quantum Mechanics', rating: 4.6, studentsCount: 88, coursesCount: 2, status: 'ACTIVE' },
    { name: 'Dr. Amit Verma', email: 'amit.verma@nalanda.edu', department: 'Computer Applications', subject: 'Operating Systems', rating: 4.5, studentsCount: 130, coursesCount: 2, status: 'ACTIVE' },
    { name: 'Dr. Neha Sharma', email: 'neha.sharma@nalanda.edu', department: 'Mathematics', subject: 'Discrete Mathematics', rating: 4.4, studentsCount: 155, coursesCount: 1, status: 'ACTIVE' },
    { name: 'Prof. Rakesh Singh', email: 'rakesh.singh@nalanda.edu', department: 'Electrical Engineering', subject: 'Circuit Theory', rating: 0, studentsCount: 0, coursesCount: 0, status: 'INVITED' },
  ];

  const teachers = [];
  let counter = 1;
  for (const spec of specs) {
    let teacher = await Teacher.findOne({ email: spec.email });
    if (!teacher) {
      teacher = await Teacher.create({ ...spec, teacherId: `TCH-${String(counter).padStart(4, '0')}` });
      console.log(`[seed] Created teacher: ${teacher.email}`);
    }
    teachers.push(teacher);
    counter += 1;
  }
  return teachers;
}

async function seedCourses(teachers) {
  const specs = [
    { code: 'CS201', title: 'Data Structures & Algorithms', category: 'Core Engineering', instructor: teachers[0]._id, department: 'Computer Science', credits: 4, modulesCount: 12, status: 'APPROVED', completionRate: 78, rating: 4.7 },
    { code: 'PH102', title: 'Quantum Mechanics & Modern Physics', category: 'Core Science', instructor: teachers[1]._id, department: 'Physics', credits: 3, modulesCount: 10, status: 'APPROVED', completionRate: 65, rating: 4.4 },
    { code: 'CS304', title: 'Operating Systems & Architecture', category: 'Core Engineering', instructor: teachers[2]._id, department: 'Computer Applications', credits: 4, modulesCount: 9, status: 'PENDING_REVIEW', completionRate: 0, rating: 0, submittedAt: new Date() },
  ];
  const courses = [];
  for (const spec of specs) {
    let course = await Course.findOne({ code: spec.code });
    if (!course) course = await Course.create(spec);
    courses.push(course);
  }
  return courses;
}

async function seedStudents() {
  const specs = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@nalanda.edu', rollNo: '2024-CSE-101', batch: '2024', department: 'Computer Science', semester: 3, attendancePercent: 92, gpa: 8.4 },
    { name: 'Diya Patel', email: 'diya.patel@nalanda.edu', rollNo: '2024-CSE-102', batch: '2024', department: 'Computer Science', semester: 3, attendancePercent: 88, gpa: 8.9 },
    { name: 'Rohan Gupta', email: 'rohan.gupta@nalanda.edu', rollNo: '2024-PHY-201', batch: '2024', department: 'Physics', semester: 3, attendancePercent: 71, gpa: 7.1 },
    { name: 'Kabir Mehta', email: 'kabir.mehta@nalanda.edu', rollNo: '2023-BCA-301', batch: '2023', department: 'Computer Applications', semester: 5, attendancePercent: 95, gpa: 9.1 },
  ];
  const students = [];
  for (const spec of specs) {
    let student = await Student.findOne({ email: spec.email });
    if (!student) {
      student = await Student.create({ ...spec, passwordHash: await Student.hashPassword('Student@Nalanda2026!') });
    }
    students.push(student);
  }
  return students;
}

async function seedSettings() {
  const existing = await Settings.findById('platform_settings');
  if (!existing) {
    await Settings.create({ _id: 'platform_settings' });
    console.log('[seed] Created default platform settings document');
  }
}

async function run() {
  assertEnv();
  await connectDatabase();

  await seedSuperAdmin();
  const teachers = await seedTeachers();
  await seedCourses(teachers);
  await seedStudents();
  await seedSettings();

  console.log('[seed] Done.');
  await disconnectDatabase();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
