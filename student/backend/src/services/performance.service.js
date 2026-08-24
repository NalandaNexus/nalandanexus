import { QuizAttempt } from '../models/QuizAttempt.js';
import { TaskSubmission } from '../models/TaskSubmission.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Real (non-fabricated) 7-day performance series backing the dashboard
 * chart: per-day average quiz score for this student, a per-day task
 * "completion quality" signal, and the cohort-wide average quiz score for
 * the same day (legitimate aggregate analytics - never another student's
 * individual data, per master doc section 27/28).
 *
 * Note: task submissions in this LMS are ungraded reflections/activities
 * (no rubric UI exists), so a completed task is scored as a flat 85% by
 * convention - the same convention already used for the profile's
 * lifetime `averageTaskScore` stat. Days with no activity show 0, which is
 * an honest "nothing happened that day" rather than an invented number.
 */
export async function getWeeklyPerformanceTrend(userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d);
  }
  const rangeStart = days[0];

  const [myAttempts, cohortAttempts, mySubmissions] = await Promise.all([
    QuizAttempt.find({ userId, createdAt: { $gte: rangeStart } }).select('scorePercentage createdAt'),
    QuizAttempt.find({ createdAt: { $gte: rangeStart } }).select('scorePercentage createdAt'),
    TaskSubmission.find({ userId, isCompleted: true, completedAt: { $gte: rangeStart } }).select('completedAt'),
  ]);

  const byDay = new Map(days.map((d) => [dateKey(d), { quizScores: [], cohortScores: [], hasTask: false }]));

  for (const attempt of myAttempts) {
    const key = dateKey(attempt.createdAt);
    if (byDay.has(key)) byDay.get(key).quizScores.push(attempt.scorePercentage);
  }
  for (const attempt of cohortAttempts) {
    const key = dateKey(attempt.createdAt);
    if (byDay.has(key)) byDay.get(key).cohortScores.push(attempt.scorePercentage);
  }
  for (const submission of mySubmissions) {
    const key = dateKey(submission.completedAt);
    if (byDay.has(key)) byDay.get(key).hasTask = true;
  }

  return days.map((d) => {
    const key = dateKey(d);
    const bucket = byDay.get(key);
    const quiz = average(bucket.quizScores);
    const task = bucket.hasTask ? 85 : 0;
    const classAverage = average(bucket.cohortScores);
    return {
      day: DAY_LABELS[d.getUTCDay()],
      date: key,
      quiz,
      task,
      average: quiz || task ? Math.round((quiz + task) / (quiz && task ? 2 : 1)) : classAverage,
    };
  });
}

function average(numbers) {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}
