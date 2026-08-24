/**
 * @typedef {'act_now' | 'watch' | 'good' | 'neutral'} RiskLevel
 * 
 * @typedef {Object} ConceptProficiency
 * @property {string} concept
 * @property {number} score
 * @property {number} classAverage
 * @property {number} trend
 * @property {number} studentsBelow60
 * 
 * @typedef {Object} StudentSubmission
 * @property {string} id
 * @property {string} title
 * @property {string} submittedAt
 * @property {'submitted' | 'late' | 'missing' | 'graded'} status
 * @property {number|null} score
 * @property {number} maxScore
 * 
 * @typedef {Object} AttendanceDay
 * @property {string} date
 * @property {'present' | 'absent' | 'late'} status
 * 
 * @typedef {Object} Student
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} avatar
 * @property {string} classId
 * @property {string} className
 * @property {number} score
 * @property {number} previousScore
 * @property {number} scoreChange
 * @property {number} classAverage
 * @property {number} attendanceRate
 * @property {number} submissionRate
 * @property {number} engagementScore
 * @property {RiskLevel} riskLevel
 * @property {string} [atRiskReason]
 * @property {Array<StudentSubmission>} submissions
 * @property {Array<AttendanceDay>} attendanceHistory
 * @property {Record<string, number>} conceptScores
 * @property {Array<{ time: string, score: number, classAvg: number }>} scoreTimeline
 * 
 * @typedef {Object} ClassRoom
 * @property {string} id
 * @property {string} name
 * @property {string} subject
 * @property {string} term
 * @property {number} studentCount
 * @property {number} averageScore
 * @property {number} attendanceRate
 * @property {number} engagementRate
 * @property {RiskLevel} riskLevel
 * @property {string} schedule
 * 
 * @typedef {Object} TaskItem
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {'critical' | 'high' | 'medium'} urgency
 * @property {string} estimatedTime
 * @property {string} actionLabel
 * @property {string} type
 * 
 * @typedef {Object} ScheduleItem
 * @property {string} id
 * @property {string} time
 * @property {string} subject
 * @property {string} className
 * @property {string} topic
 * @property {'live_now' | 'upcoming' | 'completed'} status
 * @property {string} [attendanceWarning]
 * @property {number} expectedStudents
 * 
 * @typedef {Object} LiveClassState
 * @property {boolean} isActive
 * @property {string} classId
 * @property {string} className
 * @property {string} subject
 * @property {string} topic
 * @property {number} responseRate
 * @property {number} correctRate
 * @property {number} wrongRate
 * @property {number} activeStudents
 * @property {number} totalStudents
 * @property {Array<{ id: string, label: string, correctRate: number, status: 'good' | 'attention' }>} questions
 * @property {Array<{ id: string, name: string, finishedEarlyMins: number }>} earlyFinishers
 */

export {};
