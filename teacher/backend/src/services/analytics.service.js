import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { recomputeConceptAnalytics } from './metrics.service.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Cohort score distribution (quartile-style breakdown behind the "Avg
 * Score" stat card's drill-down modal). Every number here is computed from
 * `Student.metrics.currentScore` across the teacher's active roster — for a
 * brand-new teacher with zero students this correctly returns all zeros
 * instead of a fabricated distribution.
 */
export async function getAvgScoreBreakdown(teacherId) {
  const students = await Student.find({ teacher: teacherId, status: 'active', linkedUserId: { $ne: null } }).select('metrics.currentScore').lean();

  if (!students.length) {
    return {
      classAverage: 0,
      top10Percent: 0,
      middle60Percent: 0,
      bottom30Percent: 0,
      studentsBelow60: 0,
      studentsAbove90: 0,
      interpretation: 'No students enrolled yet — once you add students and grade work, this breakdown will populate automatically.',
    };
  }

  const scores = students.map((s) => s.metrics?.currentScore || 0).sort((a, b) => a - b);
  const n = scores.length;
  const classAverage = round1(avg(scores));

  const bottomCut = Math.max(1, Math.round(n * 0.3));
  const topCut = Math.max(1, Math.round(n * 0.1));

  const bottom30 = scores.slice(0, bottomCut);
  const top10 = scores.slice(n - topCut);
  const middle60 = scores.slice(bottomCut, n - topCut);

  const studentsBelow60 = scores.filter((s) => s < 60).length;
  const studentsAbove90 = scores.filter((s) => s >= 90).length;

  const interpretation = buildInterpretation({ classAverage, studentsBelow60, studentsAbove90, n });

  return {
    classAverage,
    top10Percent: round1(avg(top10)),
    middle60Percent: round1(avg(middle60.length ? middle60 : scores)),
    bottom30Percent: round1(avg(bottom30)),
    studentsBelow60,
    studentsAbove90,
    interpretation,
  };
}

function buildInterpretation({ classAverage, studentsBelow60, studentsAbove90, n }) {
  const healthLabel = classAverage >= 80 ? 'broadly healthy' : classAverage >= 65 ? 'moderate' : 'a cause for concern';
  const belowClause = studentsBelow60 > 0
    ? ` However, ${studentsBelow60} of ${n} students are below 60% and would benefit from targeted concept intervention.`
    : ' No students are currently below the 60% threshold.';
  const aboveClause = studentsAbove90 > 0 ? ` ${studentsAbove90} students are performing above 90% and may be ready for advanced challenges.` : '';
  return `The ${classAverage}% average is ${healthLabel}.${belowClause}${aboveClause}`;
}

/**
 * Class-wide concept mastery diagnostics. Delegates the actual number
 * crunching (and weekly baseline rollover for the trend arrow) to
 * metrics.service.js so there's a single implementation shared with
 * whatever else needs it (e.g. a future cron job).
 */
export async function getConceptPerformance(teacherId) {
  const rows = await recomputeConceptAnalytics(teacherId);
  const classAverage = round1(avg((await Student.find({ teacher: teacherId, status: 'active', linkedUserId: { $ne: null } }).select('metrics.currentScore').lean()).map((s) => s.metrics?.currentScore || 0)));
  // `id` stays the human-readable key (used for UI selection/routing); the
  // real Mongo _id is exposed separately as `conceptId` because that's what
  // createAssignment's conceptId field (and anything else addressing the
  // actual Concept document) needs — the key alone isn't a valid ObjectId.
  return rows.map(({ _conceptId, ...rest }) => ({ ...rest, conceptId: _conceptId, classAverage }));
}

/**
 * Time-series for the "Class Performance Overview" chart. Buckets graded
 * submission scores by day (thisWeek), ISO week (thisMonth), or month
 * (thisTerm) and — because there's no historical snapshot table — only
 * returns buckets that actually contain graded work; empty buckets are
 * omitted rather than filled with a fabricated flat line.
 */
export async function getPerformanceTrend(teacherId, { range = 'thisWeek', classId, studentIds = [] } = {}) {
  const { since, dateFormat } = rangeConfig(range);

  const match = { teacher: oid(teacherId), status: 'graded', gradedAt: { $gte: since } };
  if (classId && classId !== 'all') match.class = oid(classId);

  const classAvgRows = await Submission.aggregate([
    { $match: match },
    // Excludes submissions belonging to an unverified/never-purchased
    // roster row (still physically present from the pre-purchase-
    // verification seed data) - same linkedUserId gate used everywhere
    // else Student is queried, applied here via a join since this pipeline
    // starts from Submission, not Student.
    { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentDoc' } },
    { $match: { 'studentDoc.linkedUserId': { $ne: null } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$gradedAt' } },
        avg: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const points = classAvgRows.map((r) => ({ label: r._id, classAvg: Math.round(r.avg) }));

  if (studentIds.length) {
    const perStudent = await Submission.aggregate([
      { $match: { ...match, student: { $in: studentIds.map(oid) } } },
      {
        $group: {
          _id: { bucket: { $dateToString: { format: dateFormat, date: '$gradedAt' } }, student: '$student' },
          avg: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
        },
      },
    ]);

    const students = await Student.find({ _id: { $in: studentIds } }).select('name').lean();
    const nameById = new Map(students.map((s) => [String(s._id), s.name]));

    for (const row of perStudent) {
      const point = points.find((p) => p.label === row._id.bucket);
      if (point) point[String(row._id.student)] = Math.round(row.avg);
    }

    return { points, students: students.map((s) => ({ id: s._id, name: nameById.get(String(s._id)) })) };
  }

  return { points, students: [] };
}

/**
 * The Gradebook: a real Student × Assignment grid, built entirely from
 * `Submission.score`/`maxScore` — there is no separate Grade model in this
 * codebase (see models/Submission.js), and none is invented here. The
 * per-assignment percentage and the per-student overall average both use
 * the exact same `(score / maxScore) * 100` formula already used by
 * getPerformanceTrend above — no new/invented grading formula, no
 * weightage system exists anywhere in this app to draw on instead. A
 * student with zero graded work returns `overallPercent: null` (not 0 —
 * "ungraded" and "graded at 0%" are different, real facts).
 */
export async function getGradebook(teacherId, classId) {
  const studentFilter = { teacher: teacherId, status: 'active', linkedUserId: { $ne: null } };
  if (classId) studentFilter.class = classId;
  const students = await Student.find(studentFilter).select('name email rollNumber class').sort({ name: 1 }).lean();
  if (!students.length) return { assignments: [], students: [] };

  const assignmentFilter = { teacher: teacherId };
  if (classId) assignmentFilter.class = classId;
  const assignments = await Assignment.find(assignmentFilter).select('title maxScore dueDate class').sort({ dueDate: 1 }).lean();
  const assignmentIds = assignments.map((a) => a._id);

  const submissions = await Submission.find({
    student: { $in: students.map((s) => s._id) },
    assignment: { $in: assignmentIds },
    status: 'graded',
  })
    .select('student assignment score maxScore')
    .lean();

  const byStudent = new Map();
  for (const sub of submissions) {
    const key = String(sub.student);
    if (!byStudent.has(key)) byStudent.set(key, new Map());
    byStudent.get(key).set(String(sub.assignment), sub);
  }

  const shapedStudents = students.map((s) => {
    const subsByAssignment = byStudent.get(String(s._id)) || new Map();
    const grades = assignments.map((a) => {
      const sub = subsByAssignment.get(String(a._id));
      if (!sub) return { assignmentId: a._id, score: null, maxScore: a.maxScore, percent: null };
      const percent = sub.maxScore ? Math.round((sub.score / sub.maxScore) * 100) : null;
      return { assignmentId: a._id, score: sub.score, maxScore: sub.maxScore, percent };
    });
    const graded = grades.filter((g) => g.percent !== null);
    const overallPercent = graded.length ? Math.round(avg(graded.map((g) => g.percent))) : null;
    return {
      id: s._id,
      name: s.name,
      email: s.email,
      rollNumber: s.rollNumber,
      classId: s.class,
      grades,
      overallPercent,
    };
  });

  return {
    assignments: assignments.map((a) => ({ id: a._id, title: a.title, maxScore: a.maxScore, dueDate: a.dueDate })),
    students: shapedStudents,
  };
}

function rangeConfig(range) {
  const now = new Date();
  if (range === 'thisMonth') {
    return { since: new Date(now.getFullYear(), now.getMonth(), 1), dateFormat: '%G-W%V' };
  }
  if (range === 'thisTerm') {
    const since = new Date(now);
    since.setMonth(since.getMonth() - 4);
    return { since, dateFormat: '%Y-%m' };
  }
  // thisWeek (default)
  const since = new Date(now);
  since.setDate(since.getDate() - since.getDay() + (since.getDay() === 0 ? -6 : 1)); // Monday
  since.setHours(0, 0, 0, 0);
  return { since, dateFormat: '%Y-%m-%d' };
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export default { getAvgScoreBreakdown, getConceptPerformance, getPerformanceTrend, getGradebook };
