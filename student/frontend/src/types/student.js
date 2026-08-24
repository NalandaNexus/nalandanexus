/**
 * @typedef {Object} StudentCourse
 * @property {string} id
 * @property {string} name
 * @property {string} subtitle
 * @property {number} progress - 0 to 100
 * @property {string} currentModuleId
 * @property {string} currentLessonId
 * @property {string} currentLessonTitle
 */

/**
 * @typedef {Object} StudentPerformance
 * @property {number} averageQuiz
 * @property {number} averageTask
 * @property {number} overallScore
 */

/**
 * @typedef {Object} StudentStreak
 * @property {number} current
 * @property {number} longest
 * @property {string} lastActiveDate
 */

/**
 * @typedef {Object} StudentProfile
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string|null} avatar
 * @property {StudentCourse} course
 * @property {StudentPerformance} performance
 * @property {StudentStreak} streak
 * @property {number} points
 * @property {number} topicsCompleted
 * @property {number} totalTopics
 * @property {number} quizzesCompleted
 * @property {number} totalQuizzes
 * @property {number} tasksCompleted
 * @property {number} totalTasks
 */

/**
 * @typedef {Object} StudentTask
 * @property {string} id
 * @property {string} title
 * @property {string} type - 'Reflection' | 'Quiz' | 'Task' | 'Activity'
 * @property {string} dueDateLabel - e.g. 'Due today', 'Tomorrow', 'Thu, Aug 20'
 * @property {string} dueIsoDate - YYYY-MM-DD
 * @property {string} urgency - 'high' | 'medium' | 'low'
 * @property {string} iconName - lucide icon key
 * @property {string} targetUrl
 * @property {boolean} isCompleted
 * @property {string} description
 * @property {number} pointsReward
 */

/**
 * @typedef {Object} PerformanceDataPoint
 * @property {string} day - 'Mon', 'Tue', etc.
 * @property {number} quiz - 0 to 100
 * @property {number} task - 0 to 100
 * @property {number} average - 0 to 100
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {number} rank
 * @property {string} name
 * @property {number} points
 * @property {boolean} isCurrentUser
 * @property {string} [avatar]
 */

export const STUDENT_ROLES = {
  STUDENT: 'student',
  MENTOR: 'mentor',
  ADMIN: 'admin',
};
