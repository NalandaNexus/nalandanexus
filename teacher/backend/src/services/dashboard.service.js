import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { listClasses } from './class.service.js';
import { getAtRiskStudents } from './student.service.js';
import { getTodaysSchedule, getActiveLiveSession } from './schedule.service.js';
import { getAvgScoreBreakdown, getConceptPerformance } from './analytics.service.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Assembles the single aggregate payload the dashboard hook
 * (useTeacherDashboard) expects. Kept as one endpoint — rather than forcing
 * the frontend to make 8+ round trips — because that's the shape the
 * existing, already-well-built dashboard UI was designed around; every
 * field inside it is still a real, independently computed query result
 * (no field here is invented or hardcoded).
 */
export async function getDashboardOverview(teacherId) {
  const [classes, atRiskStudents, todaysSchedule, liveClassState, avgScoreBreakdown, conceptPerformance] = await Promise.all([
    listClasses(teacherId),
    getAtRiskStudents(teacherId),
    getTodaysSchedule(teacherId),
    getActiveLiveSession(teacherId),
    getAvgScoreBreakdown(teacherId),
    getConceptPerformance(teacherId),
  ]);

  const [coreStats, workloadSummary, classHealth, recommendedActions, pendingTasks] = await Promise.all([
    getCoreStats(teacherId, classes, todaysSchedule),
    getWorkloadSummary(teacherId, classes),
    getClassHealth(classes),
    getRecommendedActions(teacherId, conceptPerformance, atRiskStudents),
    getPendingTasks(teacherId),
  ]);

  return {
    classes,
    coreStats,
    avgScoreBreakdown,
    atRiskStudents,
    recommendedActions,
    pendingTasks,
    workloadSummary,
    classHealth,
    todaysSchedule,
    liveClassState,
    conceptPerformance,
  };
}

async function getCoreStats(teacherId, classes, todaysSchedule) {
  const totalClasses = classes.length;
  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const avgScore = totalStudents ? Math.round(classes.reduce((s, c) => s + c.averageScore * c.studentCount, 0) / totalStudents) : 0;

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [newClasses, newStudents, publishedAssignments, toGradeCount] = await Promise.all([
    SchoolClass.countDocuments({ teacher: teacherId, createdAt: { $gte: weekAgo } }),
    Student.countDocuments({ teacher: teacherId, createdAt: { $gte: weekAgo }, linkedUserId: { $ne: null } }),
    Assignment.countDocuments({ teacher: teacherId, status: { $ne: 'archived' } }),
    Submission.countDocuments({ teacher: teacherId, status: { $in: ['submitted', 'late'] } }),
  ]);

  const avgScoreTrend = await getAvgScoreWeeklyTrend(teacherId);
  const nextSession = todaysSchedule.find((s) => s.status === 'upcoming' || s.status === 'live_now');

  return {
    totalClasses: { value: totalClasses, trend: newClasses > 0 ? `+${newClasses} this week` : 'No change this week', label: 'Total Classes' },
    totalStudents: { value: totalStudents, trend: newStudents > 0 ? `+${newStudents} this week` : 'No change this week', label: 'Total Students' },
    assignments: { value: publishedAssignments, trend: `${toGradeCount} to grade`, label: 'Assignments' },
    avgScore: { value: avgScore, trend: avgScoreTrend, label: 'Avg. Score' },
    todaysClasses: {
      value: todaysSchedule.length,
      trend: nextSession ? `Next: ${nextSession.subject} ${nextSession.time}` : 'No sessions scheduled',
      label: "Today's Classes",
    },
  };
}

async function getAvgScoreWeeklyTrend(teacherId) {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);

  // $lookup + $match against the real student so a graded submission that
  // belongs to an unverified/never-purchased roster row (still physically
  // present from the pre-purchase-verification seed data, just no longer
  // shown in any list view) can't inflate this trend - the same
  // linkedUserId gate applied everywhere else Student is queried.
  const [thisWeek, lastWeek] = await Promise.all([
    Submission.aggregate([
      { $match: { teacher: oid(teacherId), status: 'graded', gradedAt: { $gte: weekAgo } } },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentDoc' } },
      { $match: { 'studentDoc.linkedUserId': { $ne: null } } },
      { $group: { _id: null, avg: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } } } },
    ]),
    Submission.aggregate([
      { $match: { teacher: oid(teacherId), status: 'graded', gradedAt: { $gte: twoWeeksAgo, $lt: weekAgo } } },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentDoc' } },
      { $match: { 'studentDoc.linkedUserId': { $ne: null } } },
      { $group: { _id: null, avg: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } } } },
    ]),
  ]);

  const a = thisWeek[0]?.avg;
  const b = lastWeek[0]?.avg;
  if (a === undefined || b === undefined) return 'Not enough graded work yet to trend';
  const delta = Math.round(a - b);
  if (delta === 0) return 'Flat vs last week';
  return `${delta > 0 ? '+' : ''}${delta}% this week`;
}

async function getWorkloadSummary(teacherId, classes) {
  const activeClassIds = classes.map((c) => c.id);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [submissionsToGrade, quizzesToReview, classesWithAttendanceToday, todaysSchedule] = await Promise.all([
    Submission.countDocuments({ teacher: teacherId, status: { $in: ['submitted', 'late'] } }),
    Exam.countDocuments({ teacher: teacherId, status: 'completed' }),
    Attendance.distinct('class', { teacher: teacherId, date: { $gte: todayStart } }),
    getTodaysSchedule(teacherId),
  ]);

  const attendanceRecordsPending = Math.max(0, activeClassIds.length - classesWithAttendanceToday.length);
  const upcomingClassesCount = todaysSchedule.filter((s) => s.status === 'upcoming' || s.status === 'live_now').length;

  const totalMinutes = submissionsToGrade * 5 + quizzesToReview * 10 + attendanceRecordsPending * 5;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    submissionsToGrade,
    quizzesToReview,
    attendanceRecordsPending,
    upcomingClassesCount,
    estimatedTotalTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    breakdownLabel: "Today's Workload",
  };
}

function getClassHealth(classes) {
  return classes.map((c) => ({
    id: c.id,
    className: c.name,
    score: c.averageScore,
    attendance: c.attendanceRate,
    engagement: c.engagementRate,
    atRiskCount: c.atRiskCount,
    status: c.riskLevel === 'act_now' ? 'Action' : c.riskLevel === 'watch' ? 'Watch' : 'Good',
    students: c.studentCount,
  }));
}

async function getRecommendedActions(teacherId, conceptPerformance, atRiskStudents) {
  const actions = [];

  const worstConcept = [...conceptPerformance].filter((c) => c.studentsBelow60 > 0).sort((a, b) => a.score - b.score)[0];
  if (worstConcept) {
    actions.push({
      id: `act-concept-${worstConcept.id}`,
      title: `Reteach ${worstConcept.concept}`,
      subtitle: `${worstConcept.studentsBelow60} students are below 60% in ${worstConcept.concept}`,
      urgency: worstConcept.score < 60 ? 'critical' : 'high',
      type: 'reteach',
      // The real Concept _id (not the human key in `.id`) — this is what
      // createAssignment's conceptId field actually needs downstream.
      conceptId: worstConcept.conceptId,
      actionLabel: 'Create Revision Session',
      actionSecondary: `View ${worstConcept.studentsBelow60} Students`,
    });
  }

  if (atRiskStudents.actNow.length > 0) {
    const top = atRiskStudents.actNow[0];
    actions.push({
      id: `act-student-${top.id}`,
      title: `Check in with ${top.name}`,
      subtitle: top.atRiskReason || 'Score has dropped significantly and needs immediate attention',
      urgency: 'critical',
      type: 'student_checkin',
      studentId: top.id,
      actionLabel: 'View Student Profile',
      actionSecondary: 'Send Message',
    });
  }

  const gradingBacklog = await Submission.countDocuments({ teacher: teacherId, status: { $in: ['submitted', 'late'] } });
  if (gradingBacklog > 0) {
    actions.push({
      id: 'act-grading-backlog',
      title: 'Clear grading backlog',
      subtitle: `${gradingBacklog} submissions are waiting to be graded`,
      urgency: gradingBacklog > 10 ? 'critical' : 'high',
      type: 'grading',
      actionLabel: 'Go to Grading Studio',
      actionSecondary: 'View Assignments',
    });
  }

  return actions.slice(0, 3);
}

async function getPendingTasks(teacherId) {
  const tasks = [];

  const toGradeAssignments = await Submission.aggregate([
    { $match: { teacher: oid(teacherId), status: { $in: ['submitted', 'late'] } } },
    { $group: { _id: '$assignment', count: { $sum: 1 } } },
  ]);

  if (toGradeAssignments.length) {
    const assignments = await Assignment.find({ _id: { $in: toGradeAssignments.map((t) => t._id) } }).lean();
    for (const a of toGradeAssignments) {
      const assignment = assignments.find((x) => String(x._id) === String(a._id));
      if (!assignment) continue;
      tasks.push({
        id: `task-grade-${a._id}`,
        title: `Grade ${assignment.title}`,
        subtitle: `${a.count} submission${a.count > 1 ? 's' : ''} pending`,
        urgency: a.count > 10 ? 'critical' : a.count > 3 ? 'high' : 'medium',
        estimatedTime: `${Math.max(5, a.count * 3)} min`,
        actionLabel: 'Review',
        type: 'grading',
        path: '/grading',
      });
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const classesToday = await getTodaysSchedule(teacherId);
  const markedClassIds = new Set((await Attendance.distinct('class', { teacher: teacherId, date: { $gte: todayStart } })).map(String));
  for (const session of classesToday) {
    if (session.classId && !markedClassIds.has(String(session.classId))) {
      tasks.push({
        id: `task-attendance-${session.classId}`,
        title: `Take attendance — ${session.className}`,
        subtitle: `${session.time} • ${session.topic}`,
        urgency: session.status === 'live_now' ? 'critical' : 'medium',
        estimatedTime: '5 min',
        actionLabel: 'Mark Attendance',
        type: 'attendance',
        path: '/attendance',
      });
    }
  }

  return tasks.slice(0, 8);
}

export default { getDashboardOverview };
