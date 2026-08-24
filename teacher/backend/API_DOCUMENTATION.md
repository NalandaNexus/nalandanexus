# Nalanda Teacher Backend — API Documentation

Base URL: `http://localhost:5002/api/teacher` in development (`PORT`/`CLIENT_URL` are configurable — see `.env.example`).

## Conventions

**Response envelope.** Every response is JSON with this shape:

```jsonc
// success (2xx)
{ "success": true, "message": "Human-readable message", "data": { /* or [] or null */ }, "meta": { /* only on paginated list endpoints */ } }

// error (4xx/5xx)
{ "success": false, "message": "Human-readable message", "error": { "code": "MACHINE_READABLE_CODE", "details": [ /* only on validation errors */ ] } }
```

**Auth.** All routes except `POST /auth/login` require a valid session, sent either as the `nalanda_teacher_token` `httpOnly` cookie (set automatically by the login response — this is what the frontend uses) or an `Authorization: Bearer <token>` header (useful for curl/Postman). Unauthenticated requests get `401` with one of these codes: `NO_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `ACCOUNT_NOT_FOUND`. Requests from a deactivated account get `403 ACCOUNT_INACTIVE` / `403 TEACHER_INACTIVE`.

**Pagination.** List endpoints that accept `page`/`limit` query params (default `page=1`, `limit=20`, max `limit=100`) return a `meta` block: `{ page, pageSize, totalRecords, totalPages, hasNextPage, hasPrevPage }`.

**IDs.** Every `:id`-style route param is validated as a well-formed MongoDB ObjectId before anything else runs; a malformed one gets `400 INVALID_ID`/validation error rather than reaching the database. A well-formed ID belonging to another teacher's data gets `404`, not `403` — existence of another teacher's records is never revealed.

**Common error codes:** `VALIDATION_ERROR` (422, with `error.details` as `[{ field, message }]`), `ROUTE_NOT_FOUND` (404), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500). Resource-specific `_NOT_FOUND` codes are noted per endpoint below.

---

## Auth — `/auth`

### `POST /auth/login`
Rate-limited (20 attempts / 15 min per IP by default). No auth required.

Body: `{ "email": string (required), "password": string (required), "rememberMe": boolean (optional) }`

Success `200`: sets the session cookie, `data: { user: <TeacherProfile> }` (see Profile shape below). Failure: `401 INVALID_CREDENTIALS` for any wrong email/password/role (deliberately generic, so the response can't be used to enumerate valid faculty emails), `403 ACCOUNT_INACTIVE`, `403 TEACHER_PROFILE_MISSING`.

### `POST /auth/logout`
Auth required. Clears the session cookie. `data: null`.

### `POST /auth/logout-all`
Auth required. Bumps `tokenVersion`, invalidating every previously issued token for this account (all devices/tabs). Clears the current cookie too. `data: null`.

### `GET /auth/me`
Auth required. `data: { user: <TeacherProfile> }` — use on app load to check for an existing session and hydrate the logged-in user.

### `POST /auth/change-password`
Auth required. Body: `{ "currentPassword": string (required), "newPassword": string (required, min 8 chars, must contain a number) }`. Re-issues the session cookie. `400 INVALID_CURRENT_PASSWORD` if `currentPassword` doesn't match.

---

## Profile — `/profile`

### `GET /profile`
Auth required. `data: <TeacherProfile>` where `TeacherProfile` is:
```jsonc
{
  "id": "...", "teacherId": "TCH-0001", "name": "...", "email": "...", "phone": "...",
  "avatarUrl": "...", "title": "...", "department": "...", "subject": "...",
  "qualification": "...", "experienceYears": 12, "bio": "...",
  "tier": "free" | "pro", "isPro": boolean, "accountStatus": "active" | "inactive",
  "preferences": { "emailNotifications": true, "pushNotifications": true, "weeklyDigest": true, "theme": "dark" | "light" },
  "createdAt": "..."
}
```

### `PATCH /profile`
Auth required. Body (all optional): `name, phone, title, department, subject, qualification, experienceYears, bio`. `data: <TeacherProfile>`.

### `PATCH /profile/preferences`
Auth required. Body (all optional): `emailNotifications, pushNotifications, weeklyDigest, theme`. `data: <TeacherProfile>`.

### `POST /profile/avatar`
Auth required. `multipart/form-data` with a single field `avatar` (image: png/jpeg/webp/gif, ≤`MAX_UPLOAD_MB`). `data: <TeacherProfile>` with the new `avatarUrl`. `400 FILE_REQUIRED` if no file attached.

---

## Classes — `/classes`

### `GET /classes?status=active|archived|all`
Auth required. Default `status=active`. `data: [<ClassSummary>]` where each item is:
```jsonc
{
  "id": "...", "code": "12A", "name": "Class 12A", "subject": "...", "grade": "12", "section": "A",
  "academicSession": "2026-2027", "room": "...", "schedule": "Mon, Wed, Fri 03:00 PM", "capacity": 40,
  "status": "active",
  "studentCount": 32, "averageScore": 78.4, "attendanceRate": 91.2, "engagementRate": 82.0,
  "riskLevel": "good" | "watch" | "act_now",
  "createdAt": "..."
}
```
All the numeric fields are computed live from the current student roster via a single aggregation — never stored/stale.

### `GET /classes/:id`
Auth required, owner only. `data: <ClassSummary>`. `404 CLASS_NOT_FOUND`.

### `POST /classes`
Auth required. Body: `{ name, subject, grade, section }` required; `room, schedule, capacity, academicSession` optional. `code` is derived server-side as `grade+section` uppercased. `201`, `data: <ClassSummary>`. `409 CLASS_CODE_TAKEN` if that grade+section already exists for this teacher.

### `PATCH /classes/:id`
Auth required, owner only. Body (all optional): `name, subject, room, schedule, capacity, status`. `data: <ClassSummary>`.

### `DELETE /classes/:id`
Auth required, owner only. Archives (does not hard-delete, to preserve historical grade/attendance records). `data: { id, status: "archived" }`.

### `GET /classes/:id/students?page&limit`
Auth required, owner only. Same shape as `GET /students` (below), scoped to this class. `data: [<StudentSummary>]`, paginated `meta`.

### `GET /classes/:id/leaderboard?sortBy&sortOrder&filterBy&search`
Auth required, owner only. `sortBy`: `score | improvement | engagement | submissionRate | attendance` (default `score`). `sortOrder`: `asc | desc` (default `desc`). `filterBy`: `all | below_75 | low_attendance | low_submission | declining` (default `all`). `search`: name/email substring. `data: [<LeaderboardEntry>]`, pre-sorted — **no explicit `rank` field is returned; derive rank from array position.**
```jsonc
{ "id": "...", "name": "...", "email": "...", "avatar": "...", "score": 82, "scoreChange": 3, "engagementScore": 74, "attendanceRate": 88, "submissionRate": 90, "riskLevel": "good" }
```

---

## Students — `/students`

### `GET /students?classId&riskLevel&search&page&limit&sortBy&sortOrder`
Auth required. `classId`: a class ID or `all`. `riskLevel`: `all | act_now | watch | good`. `search`: name/email substring (regex-escaped server-side). `sortBy`: `name | score | attendance` (default `name`); `sortOrder`: `asc | desc` (default `asc`). `data: [<StudentSummary>]`, paginated `meta`.
```jsonc
{
  "id": "...", "name": "...", "email": "...", "avatar": "https://api.dicebear.com/...",
  "classId": "...", "className": "...", "rollNumber": "12A-07",
  "score": 78, "previousScore": 75, "scoreChange": 3, "classAverage": 76.4,
  "attendanceRate": 91, "submissionRate": 85, "engagementScore": 80,
  "riskLevel": "good" | "watch" | "act_now", "atRiskReason": "..." | undefined,
  "status": "active" | "inactive"
}
```

### `GET /students/:id`
Auth required, owner only. `data: <StudentSummary> & { conceptScores: { [conceptKey]: number }, submissions: [...], attendanceHistory: [...], scoreTimeline: [...] }` — the full drill-down payload (last 20 submissions, last 14 attendance records, up to 5 score-timeline points from graded work). `404 STUDENT_NOT_FOUND`.

### `POST /students`
Auth required. Body: `{ name, email, classId }` required (the class must belong to the requesting teacher); `phone, rollNumber, guardianName, guardianPhone, guardianEmail` optional. `201`, `data: <StudentDetail>`.

### `PATCH /students/:id`
Auth required, owner only. Body (all optional): `name, phone, rollNumber, guardianName, guardianPhone, guardianEmail, status, classId` (re-validated for ownership if changed). `data: <StudentDetail>`.

### `DELETE /students/:id`
Auth required, owner only. Sets `status: inactive` (soft delete). `data: { id, status: "inactive" }`.

---

## Assignments — `/assignments`

### `GET /assignments?classId&status`
Auth required. `status` defaults to everything except `archived`. `data: [<AssignmentSummary>]`:
```jsonc
{
  "id": "...", "title": "...", "description": "...", "instructions": "...",
  "classId": "...", "className": "...", "course": "...", "conceptId": "...",
  "dueDate": "...", "maxScore": 100, "attachments": [], "status": "draft" | "published" | "archived",
  "total": 32, "submitted": 20, "toGrade": 8, "avgScore": 76,
  "createdAt": "...", "updatedAt": "..."
}
```
`total`/`submitted`/`toGrade`/`avgScore` are always computed live from `Submission` documents at read time — never stored on the assignment itself.

### `GET /assignments/:id`
Auth required, owner only. `data: <AssignmentSummary>`. `404 ASSIGNMENT_NOT_FOUND`.

### `POST /assignments`
Auth required. Body: `{ title, classId, dueDate }` required; `description, instructions, course, conceptId, maxScore, status` optional (`status` defaults to `published`). If created as `published`, a `pending` Submission stub is created for every currently-enrolled student in that class immediately (this is what makes "missing" counts honest — see the model doc-comment on `Submission`). `201`, `data: <AssignmentSummary>`.

### `PATCH /assignments/:id`
Auth required, owner only. Body (all optional): `title, dueDate, description, instructions, maxScore, status`. Transitioning `status` from non-`published` to `published` triggers the same submission-stub creation as above. `data: <AssignmentSummary>`.

### `DELETE /assignments/:id`
Auth required, owner only. Archives. `data: { id, status: "archived" }`.

### `GET /assignments/:id/submissions`
Auth required, owner only. `data: [<SubmissionRow>]`:
```jsonc
{ "id": "...", "studentId": "...", "studentName": "...", "studentEmail": "...", "status": "pending" | "missing" | "submitted" | "late" | "graded", "submittedAt": "..." | null, "score": number | null, "maxScore": 100, "feedback": "..." | null, "gradedAt": "..." | null }
```
`status` reads as `"missing"` for a `pending` submission only once the assignment's real due date has passed (fixed during review — see README's "Issues found and fixed" list).

---

## Submissions — `/submissions`

### `GET /submissions/:id`
Auth required, owner only. `data`: the submission with `student` and `assignment` populated (`name/email/avatarUrl` and `title/maxScore/dueDate` respectively). `404 SUBMISSION_NOT_FOUND`.

### `PATCH /submissions/:id/record`
Auth required, owner only. Records that work was turned in outside the system (e.g. a paper submission the teacher is logging by hand — there is no live student-facing submission intake in this backend; see the scope note in `src/models/User.js`). Body: `{ content?: string, attachments?: [...] }`. Sets `submittedAt` to now and `status` to `late` or `submitted` depending on the assignment's due date. `data: <Submission>`.

### `PATCH /submissions/:id/grade`
Auth required, owner only. Body: `{ score: number (required, 0 ≤ score ≤ submission.maxScore), feedback?: string }`. `400 SCORE_OUT_OF_RANGE` if `score` exceeds the submission's `maxScore`. On success: recalculates the student's cached metrics from real data, emits `score:update` over Socket.IO to the class room, and — if this was the last ungraded submission for the assignment — creates a `grading`-type notification. `data: <Submission>`.

---

## Attendance — `/attendance`

### `GET /attendance?classId&studentId&date&limit`
Auth required. All filters optional; results always scoped to the requesting teacher. `data: [<AttendanceRow>]` (capped at `limit`, default 200):
```jsonc
{ "id": "...", "studentId": "...", "studentName": "...", "classId": "...", "className": "...", "status": "present" | "absent" | "late", "date": "YYYY-MM-DD", "remarks": "..." | null }
```

### `POST /attendance`
Auth required, class owner only. Body: `{ classId, date, records: [{ studentId, status: "present"|"absent"|"late", remarks? }] }`. Every `studentId` is verified to actually belong to that class before anything is written — `400 STUDENT_NOT_IN_CLASS` (with the offending IDs) otherwise. Upserts on the unique `(student, class, date)` index, so re-marking the same day corrects the existing record rather than duplicating it. Recalculates each affected student's cached attendance rate; a student hitting 3 consecutive absences triggers an `attendance`-type notification automatically. `data: [<AttendanceRow>]` for that class/date.

### `GET /attendance/analytics/:classId?days=30`
Auth required, owner only. `data: [{ date: "YYYY-MM-DD", present, absent, late, total, attendanceRate }]`, one row per day with at least one record in the last `days` days.

---

## Dashboard — `/dashboard`

### `GET /dashboard/overview`
Auth required. The single aggregate payload the main Dashboard page is built around (one round trip instead of 8+, matching the shape the existing UI expects) — every field is still an independently real, computed value:
```jsonc
{
  "classes": [<ClassSummary>],
  "coreStats": {
    "totalClasses": { "value": 8, "trend": "+1 this week", "label": "Total Classes" },
    "totalStudents": { "value": 256, "trend": "...", "label": "Total Students" },
    "assignments": { "value": 16, "trend": "8 to grade", "label": "Assignments" },
    "avgScore": { "value": 77, "trend": "+2% this week" | "Not enough graded work yet to trend", "label": "Avg. Score" },
    "todaysClasses": { "value": 4, "trend": "Next: Physics 03:00 PM" | "No sessions scheduled", "label": "Today's Classes" }
  },
  "avgScoreBreakdown": { /* see GET /analytics/avg-score-breakdown */ },
  "atRiskStudents": { "all": [...], "actNow": [...], "watch": [...], "totalCount": 12 },
  "recommendedActions": [ /* up to 3, see below */ ],
  "pendingTasks": [ /* up to 8, see below */ ],
  "workloadSummary": { "submissionsToGrade": 8, "quizzesToReview": 2, "attendanceRecordsPending": 1, "upcomingClassesCount": 2, "estimatedTotalTime": "1h 10m", "breakdownLabel": "Today's Workload" },
  "classHealth": [ { "classId", "name", "score", "attendance", "engagement", "risk", "students" } ],
  "todaysSchedule": [ /* see below */ ],
  "liveClassState": { /* see below — has a documented gap */ },
  "conceptPerformance": [ /* see GET /analytics/concepts */ ]
}
```

`recommendedActions` items: `{ id, title, subtitle, urgency: "critical"|"high", type: "reteach"|"student_checkin"|"grading", actionLabel, actionSecondary, ...contextIds }` — derived from the worst-performing concept, the top at-risk student, and the grading backlog, in that priority order.

`pendingTasks` items: `{ id, title, subtitle, urgency: "critical"|"high"|"medium", estimatedTime, actionLabel, type: "grading"|"attendance", path }` — one per assignment with ungraded work, plus one per today's session without attendance taken yet.

`todaysSchedule` items: `{ id, time, duration, subject, className, classId, topic, status: "upcoming"|"live_now"|"completed", attendanceWarning: string|null, expectedStudents, room }` — `status` is computed from wall-clock time against the session's start/duration, not trusted from a stored value.

`liveClassState`: `{ isActive: false }` when nothing is live, otherwise `{ isActive: true, sessionId, classId, className, subject, topic, activeStudents, totalStudents, responseRate: null, correctRate: null, wrongRate: null, questions: [], earlyFinishers: [] }`. **The last five fields are always empty** — there is no live-quiz/response-capture feature anywhere in the frontend or the original backend this was built from, so they are honestly empty rather than fabricated. See the README's "Known product gaps" section.

---

## Schedule — `/schedule`

Backs the Calendar and Live Classes pages. `ClassSession` documents are the same records `dashboard.service.js` reads for `todaysSchedule`/`liveClassState` above — this is the CRUD surface for them.

### `GET /schedule?date=YYYY-MM-DD`
Auth required. `date` optional, defaults to today. Returns that calendar day's sessions, same shape as `todaysSchedule` in the dashboard overview, plus the raw `startAt`/`durationMinutes` alongside the formatted `time`/`duration` strings:
```jsonc
{
  "id": "...", "time": "09:00 AM", "startAt": "...", "duration": "45 min", "durationMinutes": 45,
  "subject": "...", "className": "...", "classId": "...", "topic": "...",
  "status": "upcoming" | "live_now" | "completed", "attendanceWarning": "..." | null,
  "expectedStudents": 32, "room": "..." | null
}
```
`400 INVALID_DATE` if `date` doesn't parse.

### `POST /schedule`
Auth required, class owner only. Body: `{ classId, startAt, durationMinutes?, subject?, topic?, room? }` (`startAt` ISO 8601, required; `durationMinutes` 5–300, defaults to 45). Creates a `ClassSession` (a Calendar/Live-Schedule timetable slot). `201`, `data`: the same shaped row as above.

### `DELETE /schedule/:id`
Auth required, owner only. Soft-cancels (`status: "cancelled"`) rather than hard-deleting, preserving history. `data: { id, status: "cancelled" }`. `404 SESSION_NOT_FOUND`.

### `GET /schedule/live`
Auth required. `data: { isActive: false }` when nothing is currently live, otherwise the same shape documented under `liveClassState` above (including the same honestly-empty live-polling fields). The frontend's Live Classes page polls this every 30s — there is no push event for "a session just went live" (see README.md's "Real-time (Socket.IO)" section for the full list of what actually is pushed).

---

## Analytics — `/analytics`

### `GET /analytics/avg-score-breakdown`
Auth required. `data: { classAverage, top10Percent, middle60Percent, bottom30Percent, studentsBelow60, studentsAbove90, interpretation: string }` — a plain-English one-liner summarizing the distribution. All zeros with an explanatory `interpretation` if the teacher has no active students yet (not a fabricated distribution).

### `GET /analytics/concepts`
Auth required. `data: [{ id, conceptId, concept, score, trend, studentsBelow60, assessmentCount, description, classAverage }]` — one row per concept the teacher has defined, mastery averaged across their active roster's `conceptScores`. `trend` is against a weekly-rolling baseline cached on the `Concept` document. `id` is the human-readable key (e.g. `"optics"`) used for UI selection; `conceptId` is the real `Concept` document `_id` — use `conceptId`, not `id`, anywhere a real ObjectId is required (e.g. `POST /assignments`'s `conceptId` field).

### `GET /analytics/performance-trend?range&classId&studentIds` — **Pro only**
Auth required + `403 PRO_REQUIRED` if the teacher's `tier` isn't `pro` (mirrors the "Advanced analytics" copy already in the sidebar). `range`: `thisWeek | thisMonth | thisTerm` (default `thisWeek`). `classId` optional. `studentIds`: comma-separated, optional (adds a per-student line). `data: { points: [{ label, classAvg, [studentId]: number }], students: [{ id, name }] }`. Buckets with no graded work in them are omitted entirely rather than filled with a zero/flat line.

---

## Notifications — `/notifications`

### `GET /notifications?unread=true&page&limit`
Auth required. `data: [<Notification>]`, `meta` includes `unreadCount` alongside the usual pagination fields.
```jsonc
{ "id", "type": "submission"|"grading"|"attendance"|"announcement"|"system"|"subscription"|"student_activity"|"message", "title", "message", "isRead", "relatedEntityType", "relatedEntityId", "createdAt" }
```

### `GET /notifications/unread-count`
Auth required. `data: { count: number }`.

### `PATCH /notifications/:id/read`
Auth required, owner only. `data: <Notification>`. `404 NOTIFICATION_NOT_FOUND`.

### `PATCH /notifications/read-all`
Auth required. `data: { modifiedCount: number }`.

### `DELETE /notifications/:id`
Auth required, owner only. `data: { id }`. `404 NOTIFICATION_NOT_FOUND`.

---

## Courses — `/courses`

### `GET /courses`
Auth required. `data: [<Course>]`:
```jsonc
{ "id", "title", "category", "classIds": [...], "modules": 12, "rating": 4.8, "status": "active"|"draft"|"archived", "students": 64, "completionRate": 42, "createdAt" }
```
`students`/`completionRate` are computed live from the linked classes' rosters/submissions, not stored.

### `POST /courses`
Auth required. Body: `{ title }` required; `category, modulesCount, classIds` optional. Every ID in `classIds` must belong to the requesting teacher (`404 CLASS_NOT_FOUND` otherwise — this check was added during review; see README). `201`, `data: <Course>`.

### `PATCH /courses/:id`
Auth required, owner only. Body (whitelisted, all optional): `title, category, modulesCount, status`. `data: <Course>`.

### `DELETE /courses/:id`
Auth required, owner only. Archives. `data: { id, status: "archived" }`.

---

## Exams — `/exams`

### `GET /exams`
Auth required. `data: [<Exam>]`: `{ id, title, classId, className, type: "quiz"|"test"|"exam", totalQuestions, durationMinutes, scheduledAt, status: "draft"|"scheduled"|"active"|"completed", createdAt }`. There is no question-bank or student-facing exam-taking flow anywhere in the given product, so this intentionally stays a create/list/update/delete "assessment shell" rather than inventing one.

### `POST /exams`
Auth required. Body: `{ title, classId }` required (class ownership checked); `type, totalQuestions, durationMinutes, scheduledAt` optional. `status` is derived (`scheduled` if `scheduledAt` given, else `draft`). `201`, `data: <Exam>`.

### `PATCH /exams/:id`
Auth required, owner only. Body (whitelisted, all optional): `title, type, totalQuestions, durationMinutes, scheduledAt, status`. `data: <Exam>`.

### `DELETE /exams/:id`
Auth required, owner only. Hard-deletes (exams have no downstream grade/attendance data tied to them the way classes do). `data: { id }`.

---

## Resources — `/resources`

### `GET /resources`
Auth required. `data: [<Resource>]`: `{ id, title, type: "pdf"|"slide"|"doc"|"video"|"image"|"other", fileUrl, fileSize, sizeLabel, classId, subject, downloads, createdAt }`.

### `POST /resources`
Auth required. `multipart/form-data`: file field `file` (pdf/doc/pptx/png/jpeg/mp4, ≤`MAX_UPLOAD_MB`) plus body fields `title` (required), `subject`, `classId` (optional; ownership checked if provided). `type` is inferred from the file's MIME type. `201`, `data: <Resource>`. `400 FILE_REQUIRED` if no file attached.

### `POST /resources/:id/download`
Auth required, owner only. Increments `downloadsCount` and returns the resource (so the client can then follow `fileUrl`, served statically at `/uploads/resources/<filename>`). `data: <Resource>`. `404 RESOURCE_NOT_FOUND`.

### `DELETE /resources/:id`
Auth required, owner only. `data: { id }`. Deletes both the database record and the underlying file on disk (best-effort — a file that's already missing doesn't fail the request).

---

## Messages — `/messages`

### `GET /messages/conversations`
Auth required. `data: [<Conversation>]`: `{ id, studentId, name, avatar, lastMessage, lastMessageAt, unread: boolean, unreadCount }`.

### `POST /messages/conversations`
Auth required. Body: `{ studentId }` (required, must belong to the requesting teacher — validator added during review; see README). Returns the existing conversation with that student if one exists, otherwise creates it. `201`, `data: { id }`.

### `GET /messages/conversations/:id`
Auth required, owner only. `data: [<Message>]`: `{ id, senderRole: "teacher"|"student", text, createdAt, readAt }`.

### `POST /messages/conversations/:id/messages`
Auth required, owner only. Body: `{ text }` (required, ≤4000 chars). Persists as `senderRole: "teacher"` and marks it unread-for-student (there is no live student-side inbox in this backend to push into — see the scope note in `src/models/User.js` — so this is ready for whenever the student portal is wired up to read it). Emits `message.created` to the teacher's own connected clients. `201`, `data: <Message>`.

### `PATCH /messages/conversations/:id/read`
Auth required, owner only. Marks the conversation read for the teacher. `data: { id }`.

---

## Search — `/search`

### `GET /search?q=...`
Auth required. Empty/missing `q` returns `data: []`. Otherwise searches students (name/email), classes (name/subject), concepts (name/description), and assignments (title) owned by the requesting teacher — capped at 5/3/3/3 results respectively — server-side, rather than shipping the full roster to the client to filter locally. `data: [{ type: "student"|"class"|"concept"|"assignment", id, title, subtitle, data: {...} }]`.

---

## Announcements — `/announcements`

Covers class updates, school/department events, and convocation notices — one model, distinguished by `type`, sharing the same lifecycle and audience-targeting shape (see `src/models/Announcement.js`). There is no `Institution`/`Department` collection anywhere in this schema, so "entire institution" targeting doesn't exist — the broadest audience a teacher has is `all_my_classes`, resolved server-side from the classes they actually teach at creation time (never trusted from the client).

### `GET /announcements?type&status&classId&search&from&to&page&limit`
Auth required. `data: [<Announcement>]`, paginated.
```jsonc
{
  "id", "title", "description",
  "type": "ANNOUNCEMENT"|"CLASS_UPDATE"|"EVENT"|"CONVOCATION"|"ACADEMIC"|"URGENT",
  "priority": "low"|"normal"|"high"|"urgent",
  "audience": "classes"|"all_my_classes",
  "classIds": ["..."], "classes": [{ "id", "name", "code" }],
  "eventDate", "startTime", "endTime", "venue", "registrationLink",
  "attachmentUrl", "attachmentName", "bannerUrl",
  "publishAt", "expiresAt",
  "status": "draft"|"scheduled"|"published"|"expired"|"archived",
  "publishedAt", "createdAt", "updatedAt"
}
```

### `GET /announcements/:id`
Auth required, owner only. `data: <Announcement>`. `404 ANNOUNCEMENT_NOT_FOUND`.

### `POST /announcements`
Auth required. Accepts `application/json` or `multipart/form-data` (when attaching a file, field name `attachment`). Body: `{ title, description, type, audience }` required; `priority, classes (required if audience="classes"), eventDate, startTime, endTime, venue, registrationLink, publishAt, expiresAt, status: "draft" }` optional. Every id in `classes` must belong to the requesting teacher (`403 CLASS_NOT_OWNED` otherwise) or `all_my_classes` is resolved server-side. Status is derived automatically: `draft` if explicitly requested, `scheduled` if `publishAt` is in the future, otherwise `published` immediately (which also fires delivery — see "Real-time delivery" below). `201`, `data: <Announcement>`.

### `PATCH /announcements/:id`
Auth required, owner only. Same body shape as create, all fields optional; only `draft`/`scheduled` announcements can be edited (`400 ANNOUNCEMENT_NOT_EDITABLE` otherwise — publish/archive/delete are separate dedicated endpoints with their own lifecycle checks, not part of this one). `data: <Announcement>`.

### `POST /announcements/:id/publish`
Auth required, owner only. Immediately publishes a `draft` or `scheduled` announcement (idempotent if already published). Fires delivery. `data: <Announcement>`.

### `POST /announcements/:id/archive`
Auth required, owner only. `data: <Announcement>`.

### `DELETE /announcements/:id`
Auth required, owner only. Deletes the record and its attachment file on disk (best-effort). `data: { id }`.

### Server-side scheduled publishing
`src/jobs/announcementScheduler.job.js` runs an in-process sweep every 60s (`runScheduledSweep()` in `announcement.service.js`) that publishes any `scheduled` announcement whose `publishAt` has passed and expires any `published` one whose `expiresAt` has passed — purely from timestamps in MongoDB, independent of any browser tab or socket connection staying open. Known limitation: this is per-process; horizontally scaling this API to multiple instances would need a shared job runner instead (not needed at this project's scale — see the comment in that file).

### Real-time delivery
On every publish (immediate or via the scheduled sweep), the backend emits `announcement:published` to the publishing teacher's own room (multi-device sync) and to every targeted class's room, and creates a `Notification` (`type: "announcement"`) for the teacher so their own bell/badge reflects it even if no client was connected at the moment it went live. `announcement:expired` and `announcement:deleted` are emitted the same way.

**Cross-portal delivery to students** happens through a separate mechanism, not the Socket.IO class-room emit above: this backend is teacher-only — `Student` records here are roster entries, not login-capable accounts (see the scope note in `src/models/User.js`), so there is no student-authenticated socket connection in this codebase for that class-room emit to actually reach. Instead, `deliver()` in `announcement.service.js` calls `services/studentBridge.service.js`, which pushes the announcement to the **student backend** — a separate service with its own database — over HTTP, authenticated with a shared secret (`STUDENT_BACKEND_SERVICE_KEY`, see `.env.example`). The student backend persists it and pushes it live to every connected student over **its own** Socket.IO server (`announcement.created`), verified end-to-end: publish here → real row in the student database (`source: "teacher-portal"`) → a logged-in student's `GET /api/student/announcements` returns it with correct author attribution. Archiving or deleting a published announcement here retracts it there the same way. This call is best-effort (never blocks or fails the publish it's attached to) and is a documented no-op if `STUDENT_BACKEND_URL` is unset. **Known, real constraint:** the student portal's Announcement model has no per-class/course audience — every bridged announcement reaches *all* connected students, not just the specific classes targeted here, because the student portal has no class/roster concept to filter by. See the module comment in `studentBridge.service.js` and the student backend's own README ("Internal service bridge") for the full picture.

---

## Collections reference

| Model | Purpose |
|---|---|
| `User` | Auth identity (email/password/role). Only `teacher` (and reserved `admin`) accounts are ever created by this codebase — students are not logins here (see scope note in `src/models/User.js`). |
| `Teacher` | Professional profile linked 1:1 to a `User`; the ownership anchor almost every other collection references. |
| `SchoolClass` | A taught batch/cohort (e.g. "Class 12A"). Distinct from `Course`. |
| `ClassSession` | One discrete scheduled meeting of a class (today's timetable / live studio), distinct from `SchoolClass.schedule`'s recurring text pattern. |
| `Student` | Roster entry owned by a teacher; not a login. Carries denormalized/cached `metrics.*`, recalculated synchronously after any write that could change them. |
| `Concept` | A curriculum topic (e.g. "Optics") used to tag assignments and roll up mastery analytics. |
| `Assignment` | Title/due date/etc. Counts (submitted/toGrade/avgScore) are always derived live from `Submission`, never stored here. |
| `Submission` | One row per (assignment, student), created as `pending` when an assignment is published — see the model file for why. |
| `Attendance` | One row per (student, class, date); corrections upsert rather than duplicate. |
| `Notification` | Persisted teacher-facing notifications, also pushed live over Socket.IO when created. |
| `Course` | Curriculum module, can span multiple classes. Student count/completion rate derived live. |
| `Exam` | Lightweight assessment shell (no question bank/taking flow — see Exams section above). |
| `Resource` | Uploaded teaching material metadata; the file itself lives on disk. |
| `Conversation` / `Message` | Teacher↔student messaging threads. |
| `AuditLog` | Best-effort audit trail of write actions (`logAudit` never throws — see `src/services/audit.service.js`). |
| `Announcement` | Class updates, events, and convocation notices — one model, `type`-discriminated. Audience resolved/validated server-side against the teacher's own classes at write time. |

See `README.md` for the auth flow, real-time events, security measures, and — importantly — exactly what has and hasn't been verified against a real database.
