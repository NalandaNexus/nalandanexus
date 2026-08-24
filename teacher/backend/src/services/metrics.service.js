import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { Submission } from '../models/Submission.js';
import { Attendance } from '../models/Attendance.js';
import { Concept } from '../models/Concept.js';
import { Assignment } from '../models/Assignment.js';

const { Types } = mongoose;

/**
 * Recalculates every cached metric on a single Student document from the
 * real underlying records (Submission, Attendance) and persists it.
 *
 * This is called synchronously right after any write that could change a
 * student's standing — grading a submission, marking attendance — so the
 * cached fields (used for fast list/sort/filter across hundreds of
 * students) never drift for more than the duration of that one request.
 * See the comment on Student.metrics for why these are cached at all.
 */
export async function recalculateStudentMetrics(studentId) {
  const student = await Student.findById(studentId);
  if (!student) return null;

  const submissions = await Submission.find({ student: studentId }).lean();
  const gradedSubs = submissions.filter((s) => s.status === 'graded' && typeof s.score === 'number');
  const nonPendingSubs = submissions.filter((s) => s.status !== 'pending');

  const attendanceRecords = await Attendance.find({ student: studentId }).lean();

  // ---- Score (average % across graded work) ----
  const currentScore = average(
    gradedSubs.map((s) => (s.maxScore ? (s.score / s.maxScore) * 100 : s.score))
  );

  // ---- Attendance rate (present = full credit, late = half credit) ----
  const attendanceRate = attendanceRecords.length
    ? average(attendanceRecords.map((a) => (a.status === 'present' ? 100 : a.status === 'late' ? 50 : 0)))
    : 0;

  // ---- Submission rate (turned in, on-time or late, out of everything assigned) ----
  const submissionRate = submissions.length ? Math.round((nonPendingSubs.length / submissions.length) * 100) : 0;

  // ---- Engagement (documented composite heuristic, not a stored/faked value) ----
  const onTimeCount = nonPendingSubs.filter((s) => s.status !== 'late').length;
  const onTimeRate = nonPendingSubs.length ? (onTimeCount / nonPendingSubs.length) * 100 : 0;
  const engagementScore = Math.round(0.4 * submissionRate + 0.4 * attendanceRate + 0.2 * onTimeRate);

  const previousScore = student.metrics?.currentScore ?? 0;
  const scoreChange = Math.round(currentScore - previousScore);
  const riskLevel = Student.classifyRisk(currentScore);
  const atRiskReason = deriveAtRiskReason({ riskLevel, submissions, attendanceRate, currentScore });

  student.metrics = {
    ...student.metrics,
    currentScore: round1(currentScore),
    previousScore: round1(previousScore),
    scoreChange,
    attendanceRate: round1(attendanceRate),
    submissionRate,
    engagementScore,
    riskLevel,
    atRiskReason,
    lastRecalculatedAt: new Date(),
  };

  await student.save();
  await recalculateClassAverages(student.class);
  return student;
}

/** Recomputes metrics.classAverage across every active student in a class from their current scores. */
export async function recalculateClassAverages(classId) {
  const students = await Student.find({ class: classId, status: 'active', linkedUserId: { $ne: null } }).select('metrics.currentScore').lean();
  if (!students.length) return;
  const classAverage = round1(average(students.map((s) => s.metrics?.currentScore || 0)));

  await Student.updateMany({ class: classId, status: 'active' }, { $set: { 'metrics.classAverage': classAverage } });
}

/**
 * Rolls the class-wide concept mastery aggregates for a teacher. Reads
 * every active student's `conceptScores` map, groups by concept, and caches
 * a weekly-rolling baseline (`previousAvgScore`) so a "trend" arrow can be
 * shown without a dedicated time-series collection.
 */
export async function recomputeConceptAnalytics(teacherId) {
  const concepts = await Concept.find({ teacher: teacherId }).lean();
  const students = await Student.find({ teacher: teacherId, status: 'active', linkedUserId: { $ne: null } }).select('conceptScores').lean();

  const results = [];
  const now = new Date();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  for (const concept of concepts) {
    const scores = students
      .map((s) => s.conceptScores?.get?.(concept.key) ?? s.conceptScores?.[concept.key])
      .filter((v) => typeof v === 'number');

    const currentAvg = round1(average(scores));
    const studentsBelow60 = scores.filter((v) => v < 60).length;
    const assessmentCount = await Assignment.countDocuments({ teacher: teacherId, concept: concept._id, status: 'published' });

    const shouldRollBaseline = !concept.lastComputedAt || now - new Date(concept.lastComputedAt) > ONE_WEEK_MS;
    const trend = round1(currentAvg - (concept.previousAvgScore ?? currentAvg));

    if (shouldRollBaseline) {
      await Concept.updateOne({ _id: concept._id }, { $set: { previousAvgScore: currentAvg, lastComputedAt: now } });
    }

    results.push({
      id: concept.key,
      concept: concept.name,
      score: currentAvg,
      trend,
      studentsBelow60,
      assessmentCount,
      description: concept.description,
      _conceptId: concept._id,
    });
  }

  return results;
}

function deriveAtRiskReason({ riskLevel, submissions, attendanceRate, currentScore }) {
  if (riskLevel === 'good') return null;

  const sorted = [...submissions].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  const lastSubmission = sorted.find((s) => s.submittedAt);
  const daysSinceLastSubmission = lastSubmission
    ? Math.floor((Date.now() - new Date(lastSubmission.submittedAt).getTime()) / 86400000)
    : null;

  if (daysSinceLastSubmission === null && submissions.length > 0) {
    return 'No submission on record yet';
  }
  if (daysSinceLastSubmission !== null && daysSinceLastSubmission >= 5) {
    return `No submission in ${daysSinceLastSubmission} days`;
  }
  if (attendanceRate < 75) {
    return 'Attendance below 75% threshold';
  }
  if (currentScore < 60) {
    return 'Concept scores trending below passing threshold';
  }
  return 'Requires teacher intervention';
}

function average(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export function toObjectId(id) {
  return new Types.ObjectId(id);
}

export default {
  recalculateStudentMetrics,
  recalculateClassAverages,
  recomputeConceptAnalytics,
};
