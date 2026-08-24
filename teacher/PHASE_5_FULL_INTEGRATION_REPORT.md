# Nalanda Nexus — Teacher Portal Full Backend, Real-Time & Cross-Portal Integration Report

**Scope of this report:** the follow-up pass that took the Teacher Portal from "real per-portal CRUD" (see `PHASE_4_INTEGRATION_REPORT.md`) to fully integrated with Admin and Student portals — real assigned courses, a real Class scheduling/reschedule system with student notifications, verified (not merely registered) student rosters, a bidirectional assignment↔submission↔grade bridge, a real Timetable and Gradebook built from existing data (no new fake models), Admin↔Teacher announcements, CSV reports, and a full Socket.IO event architecture. It also documents a second pass — a "no fake data" browser audit — that found and fixed six real defects surviving in the frontend from before this session (listed in §19).

---

## 1. Repository Analysis (what existed before this pass)

Before this pass, `teacher/backend` was a real, working single-portal application (Phase 4): MongoDB-backed CRUD for Classes, Students, Assignments, Submissions, Attendance, Exams, Resources, Messages, Notifications, with cookie-based auth and Socket.IO scoped to `teacher:<id>` rooms. What it did **not** have: any connection to `admin/backend` or `student/backend`. Its `Student` roster was self-declared by the teacher with no link to a real purchase/enrollment; its `AssignedCourse` concept didn't exist; Class scheduling had no reschedule history or student-facing notifications; there was no Timetable, Gradebook, or Reports endpoint; Announcements were teacher-only with no Admin channel; and the frontend had leftover mock-data hooks feeding two Dashboard widgets fabricated names and numbers.

## 2. Architecture

Unchanged three-service topology (`admin:5003` / `teacher:5002` / `student:5001`, one MongoDB Atlas cluster, one database per service, never merged). What's new is the **bridge layer**: each service exposes `/api/internal/*` routes gated by a shared-secret `X-Internal-Service-Key` header (`requireInternalServiceKey` middleware), called server-to-server immediately after a real DB write on the source side, idempotent on a `sourceId` field (sparse-unique index, deliberately **no schema default** — a `default: null` defeats sparse-unique semantics, a bug caught and fixed earlier in this project). Bridge calls are best-effort (logged, never thrown) for content delivery (materials, tasks, announcements) but honestly surfaced as warnings for identity-critical operations (teacher provisioning, from Phase B).

## 3. MongoDB Models (new/changed this pass)

| Model | Service | Change |
|---|---|---|
| `AssignedCourse` | teacher | **New.** Mirrors an admin-created course assigned to this teacher — `sourceId` (sparse-unique, no default), `teacher` ref, title/courseCode/description/image/priceInPaise/status. |
| `AdminAnnouncement` | teacher | **New.** Read-only mirror of an Admin broadcast — `sourceId`, title, content, priority, authorName, publishedAt. |
| `ClassSession` | teacher | **Changed.** Added `rescheduleHistory: [{ previousStartAt, newStartAt, reason, rescheduledAt }]`. `status` enum intentionally left at its original 4 values (`scheduled/live/completed/cancelled`) — a reschedule is a fact recorded in history, not a 5th terminal status, since the session is still genuinely scheduled after being moved. |
| `Student` (teacher roster) | teacher | **Changed.** Added `linkedUserId` (resolved via cross-portal email lookup against `student/backend`'s real `Enrollment` collection) and `verified: Boolean`. The roster's own `_id` is untouched, so Attendance/Submission/Grades keep working unmodified against existing records. |
| `Enrollment`, `Notification` | student | **Unchanged schema.** `internal.controller.js` gained new read/write operations against them (see §4). |

No new model duplicates an existing collection in another portal — every bridge model is either a thin read-mirror (`AssignedCourse`, `AdminAnnouncement`) or a field addition to an existing one.

## 4. API Routes (new this pass)

**teacher/backend**
- `PATCH /api/teacher/schedule/:id` — reschedule/status-transition a session (real-time emit + student notification via bridge).
- `GET /api/teacher/timetable?from&to&classId` — date-range read over `ClassSession` (not a new source of truth).
- `POST /api/teacher/classes/:id/sync-enrollment` — reconciles the roster against real `student/backend` enrollments.
- `GET /api/teacher/classes/:id/leaderboard` — server-sorted/filtered class leaderboard off live `Student.metrics` (pre-existing, newly wired to the frontend this pass — see §19).
- `GET /api/teacher/analytics/gradebook?classId` — Student × Assignment grid from `Submission`.
- `GET /api/teacher/analytics/performance-trend` — cohort trend chart data (Pro-gated).
- `GET /api/teacher/announcements/admin` — list mirrored Admin broadcasts.
- `GET /api/teacher/reports/export?type=students|attendance|assignments|grades|classes` — CSV, 5 types.
- `PUT/DELETE /api/internal/courses/:sourceId`, `PATCH /api/internal/teachers/credentials`, `POST/DELETE /api/internal/admin-announcements`, `POST /api/internal/submissions` — inbound bridge endpoints.

**student/backend**
- `GET /api/internal/courses/:slug/enrolled-students` — outbound, used by the teacher-side enrollment sync.
- `PATCH /api/internal/live-classes/:sourceId` — inbound, resets status + creates a real student `Notification` on a genuine time change.

**admin/backend**
- `POST /api/internal/*` bridge calls added to `teacherBridge.service.js` for announcements (outbound to teacher).

## 5. Socket.IO Events

Rooms: `teacher:<teacherId>`, `class:<classId>` (both pre-existing), plus new `institution:<fixed-id>` + `emitToAllTeachers()` for admin-wide broadcasts. Events emitted this pass: `class.rescheduled`, `class.started`, `class.completed`, `class.cancelled`, `class.updated`, `announcement:admin`, `announcement:admin_removed`, `course.assigned`, `course.unassigned`, `submission.received` (pre-existing on the backend, only added to the frontend's `forwardEvents` allowlist this pass — see §19). The allowlist gotcha (server emits an event the frontend `socketService.js` doesn't forward) recurred twice more this pass and was fixed both times by adding the event name before/after building the feature that emits it.

## 6. Auth

Unchanged from Phase 4 (httpOnly cookie, `authenticate` middleware reloading the DB on every request, `mustChangePassword` enforcement, Pro-tier gating via `requirePro`). Verified this pass: a Standard-tier teacher correctly receives `403 PRO_REQUIRED` from `/analytics/performance-trend`, and the frontend now shows an honest upgrade prompt instead of crashing or rendering fabricated data (see §19).

## 7. Course → Purchase → Enrollment Flow ("registered ≠ purchased")

The core architectural fix this pass. `syncEnrollmentForClass(classId)`:
1. Reads the class's `studentCourseSlug`.
2. Calls the new `GET /api/internal/courses/:slug/enrolled-students` on `student/backend`, which queries its real `Enrollment` collection (created only by a completed, signature-verified Razorpay payment or an admin grant — never by account creation alone).
3. For each real enrolled student, links or creates a roster `Student` row by email, sets `verified: true`, `linkedUserId`.
4. Any roster row **not** matched against a real enrollment stays `verified: false` — visible in the UI (`StudentsPage.jsx` shows a shield icon only when `verified`) rather than silently indistinguishable from a real student.

**Live-verified:** two real `student/backend` accounts, enrolled via the existing seed data's `Enrollment` records (not fabricated for this test), synced into a real teacher class — `{"synced":true,"created":2,"linked":0,"unlinked":0,"totalEnrolled":2}` — and both appeared with `verified: true` and real names/emails in `GET /classes/:id/students`.

## 8. Class System (Batch → Class)

Investigated first, per the spec's own instruction, whether "Batch" and "Class" were actually distinct concepts: they were not — `SchoolClass`/`Class` was the only session-bearing entity; "Batch" was purely a display-label synonym for the same collection. Relabeled UI copy accordingly, made no schema change. `ClassSession` (the actual scheduled meeting) gained real reschedule support:
- `PATCH /schedule/:id` accepts a new `startAt`/`topic`/`room`/`youtubeUrl`/`status`/`reason`, appends to `rescheduleHistory`, and — only on a genuine time change — calls the new student-bridge notification path.
- **Live-verified:** created a session, rescheduled it, confirmed via `GET /student/notifications` that the enrolled student received `"\"Intro to Flexbox\" rescheduled — The live class has been moved to 26 Aug 2026, 5:30 pm."` within the same request cycle, and via `GET /teacher/timetable` that the same session shows `wasRescheduled: true, linkedToStudentCourse: true`.

## 9. Task/Assignment/Quiz System

Assignment creation/publishing was already real (Phase 4). This pass closed the **submission bridge-back gap**: a student submitting a bridged (`teacher-portal`-sourced) task on `student/backend` now calls `pushTaskSubmission()`, which reaches the new `POST /api/internal/submissions` on `teacher/backend` and updates the real `Submission` document via `receiveBridgedSubmission()`.

**Live-verified, full loop:** created assignment (2 submission stubs seeded) → student A submitted on `student/backend` → `GET /teacher/assignments/:id/submissions` correctly showed student A `"status":"submitted"` with a real timestamp while student B stayed `"pending"` → graded student A's submission (`score: 88`) → `GET /analytics/gradebook` correctly showed `88%` for student A and `null` (not `0`) for ungraded student B.

Quiz/Exam creation, activation, and server-side answer protection were already real from Phase 4 and unchanged this pass.

## 10. Notes/Resources

Unchanged from Phase 4 — real upload, real-time student notification on publish. Verified via browser: honest empty state ("No resources uploaded yet.") for a fresh teacher with no uploads, no fabricated sample resources.

## 11. Messaging

`externalMessage.service.js` gained a real `Notification` (type `'message'`) on each inbound student→teacher message, so it now surfaces through the same notification center as everything else rather than being a silent side-channel. Verified via browser: honest empty state ("No conversations yet.") for a fresh teacher.

## 12. Timetable

Deliberately **not** a new model — `getTimetable(teacherId, {from, to, classId})` is a pure date-range read over the existing `ClassSession` collection, shaped identically to the pre-existing single-day `getScheduleForDate`, per the spec's explicit instruction against a disconnected fake timetable. Live-verified in-browser: the rescheduled session appears correctly under its new date with a "Rescheduled" badge.

## 13. Grades

No new Grade model — there is no separate grading collection anywhere in this codebase, so none was invented. The Gradebook (`getGradebook`) is a real Student × Assignment grid built from `Submission.score`/`maxScore`, using the exact `(score/maxScore)*100` formula already used by the pre-existing `getPerformanceTrend`, per the spec's explicit "no invented grading formula" instruction. Live-verified in-browser (`/grades`): `Aditi Sharma — 88% / 88%`, `Rohan Verma — — / —` (an em-dash for genuinely ungraded work, not a fabricated `0%`).

## 14. Reports

5 new CSV export types (`students`, `attendance`, `assignments`, `grades`, `classes`), all built from live Mongoose queries with no synthetic rows. Live-verified all 5 via direct download — every row traced back to a real MongoDB document created during this session's own testing (e.g. the `classes` report correctly showed `Web Dev Batch A: 0/0 verified` vs. `Web Dev Batch Z: 2/2 verified`, matching exactly which class had actually been synced).

## 15. Announcements

New bidirectional bridge: Admin→Teacher (existing) gained a mirror leg — `admin/backend`'s `announcement.service.js` now calls `pushAnnouncementToTeachers()`, landing in teacher's new `AdminAnnouncement` collection, exposed read-only via `GET /teacher/announcements/admin` and the `announcement:admin` socket event. Live-verified: published `"Platform Maintenance Notice"` from a real Admin session → appeared via the API within the same request cycle → rendered correctly in the Teacher Portal browser UI under the "From Admin" tab with the real author name and timestamp.

## 16. Files Changed

See the conversation's own running change list (60+ files across `teacher/backend`, `teacher/frontend`, plus bridge edits in `student/backend` and `admin/backend`) — omitted here for length; every file is a real, currently-present source file, not a placeholder. The frontend fixes from the fake-data audit (§19) are: `hooks/useLiveLeaderboard.js` (rewritten), `hooks/useLiveScore.js` (deleted, unused), `data/teacherMockData.js` (deleted), `components/dashboard/LeaderboardDiagnostic.jsx`, `components/dashboard/PerformanceOverview.jsx` (rewritten), `components/dashboard/LiveClassPanel.jsx` (rewritten), `components/dashboard/WorkloadSummary.jsx`, `components/TeacherLayout.jsx`, `pages/SettingsPage.jsx`, `pages/StudentsPage.jsx`, `pages/AttendancePage.jsx`, `pages/DashboardPage.jsx`, `hooks/useTeacherDashboard.js`, `services/socketService.js`.

## 17. Environment Variables

No new environment variables required for this pass — the shared-secret bridge key (`INTERNAL_SERVICE_KEY` or equivalent) and MongoDB connection strings were already configured from earlier phases. Real SMTP delivery remains the one previously-documented, still-genuinely-blocked external dependency (Phase B) — unrelated to this pass's scope.

## 18. Testing

All flows in §7–§15 marked "Live-verified" were tested against a real local MongoDB (`mongodb-memory-server`, port 27117) with all three backends running as real Node processes and real HTTP calls between them — no mocks. Additionally this pass:
- **Browser-level verification:** logged into the Teacher Portal UI as a real teacher and clicked through Dashboard, Classes, Students, Attendance (including a real save round-trip), Grading, Messages, Announcements, Resources, Courses, Exams, Calendar, Grades, Reports, Settings. Confirmed zero console errors on a genuinely fresh tab/session after fixes.
- **Cross-portal security spot-check:** confirmed unauthenticated requests to teacher submission/internal endpoints are rejected (`NO_TOKEN` / `INTERNAL_AUTH_FAILED`), and that a student's own task view only ever reflects their own submission status, not another student's.
- **No-fake-data grep sweep:** `mock|dummy|fake|Math\.random|setInterval` across `teacher/frontend/src` — clean after fixes (remaining matches are code comments documenting the *absence* of fake data).

## 19. Remaining Issues & Fake-Data Audit Findings

The mandatory audit surfaced **six real, pre-existing defects** (not introduced this pass, but surviving inside code touched during this pass's own rewrite) that were found and fixed:

1. **Dashboard "Diagnostic Leaderboard" and "Cohort Performance Trajectory" were rendering fully fabricated data** — hardcoded student names ("Rahul Sharma", "Priya Singh", "Neha Gupta"), a fixed 8-class tab list, and `Math.random()`-generated scores from an orphaned `teacherMockData.js`. **Fixed:** rewired to the real, already-built `getClassLeaderboard`/`getPerformanceTrend` endpoints; deleted the dead mock-data file and its unused `useLiveScore` hook; added an honest Pro-tier upgrade gate matching the backend's real `requirePro` check.
2. **The "Live Class" idle-state panel hardcoded a fake next-lecture time** ("11:00 AM, Physics 12B") and, when a class *was* live, rendered an entirely fictional in-session quiz dashboard (response/correct/wrong rates, per-question diagnostics, a "Push Olympiad Challenge" button wired to `console.log`) for a live-polling capability that was never built anywhere in the backend. **Fixed:** now shows the real next scheduled session from `todaysSchedule`, and only the fields the backend genuinely returns (class/subject/topic/attendance count) during a live session.
3. **`WorkloadSummary` hardcoded "across all 8 classes"** regardless of the teacher's real class count. **Fixed:** now uses the real `classes.length`.
4. **Two components showed a "PRO" badge unconditionally** (the mobile topbar wordmark, the Settings page header) regardless of the logged-in teacher's actual tier — misleading for a genuinely Standard-tier account. **Fixed:** both now gate on the real `user.isPro`.
5. **`StudentsPage.jsx` read `meta.total`, but the backend's pagination envelope uses `meta.totalRecords`** — the roster count silently rendered as blank text instead of `0` or the real number. **Fixed:** field name corrected.
6. **The Attendance page was functionally broken end-to-end**: it requested `limit=200` against a backend validator capped at `max: 100` (every roster load 422'd, so attendance could never actually be taken for any class), and its save handler called `markAttendance({classId, date, records})` as a single object against a service method with three positional parameters (`classId, date, records`), so every save request sent an invalid payload and failed backend validation on all three fields. **Fixed both** — live-verified a real attendance save now returns `200` and persists two real, correctly-dated records.

**Genuinely remaining gaps** (acknowledged, not hidden): no live in-session polling/quiz-push capability exists in this backend — item 2 above removes the fake UI for it rather than building the (much larger, unrequested) real feature. Real-time attendance-rate refresh on the Leaderboard is not yet socket-driven (attendance marking doesn't currently emit a socket event); the leaderboard refreshes on `score:update`/`submission.received` only, so an attendance-only change requires a manual reload to reflect in that specific widget.

### Feature Matrix

| Feature | Implemented | Tested (real data, this pass) |
|---|---|---|
| Assigned-courses bridge (Admin→Teacher) | ✅ | ✅ (Phase B) |
| Verified-enrollment roster sync | ✅ | ✅ |
| Class reschedule + history + student notification | ✅ | ✅ |
| Timetable (read-aggregation) | ✅ | ✅ |
| Assignment submission bridge-back | ✅ | ✅ |
| Grading → Gradebook | ✅ | ✅ |
| Admin↔Teacher announcements | ✅ | ✅ |
| CSV Reports (5 types) | ✅ | ✅ |
| Dashboard Leaderboard (real data) | ✅ | ✅ |
| Dashboard Performance Trend (real data, Pro-gated) | ✅ | ✅ |
| Live Class panel (honest fields only) | ✅ | ✅ |
| Attendance marking (roster load + save) | ✅ | ✅ (fixed this pass) |
| Live in-session polling/challenge push | ❌ Not built | — (fake UI removed, not replaced) |
| Attendance-driven real-time Leaderboard refresh | ⚠️ Partial | Score/submission-driven only |

## 20. Follow-Up Pass — Additional Issues Found & Fixed

A second, deeper check (API-signature audit + exercising every remaining untested interactive flow: Announcements, Exams/Quizzes, Resources, Messages) surfaced two more real defects, both now fixed and live-verified:

7. **Teacher-initiated messages to a real, verified student were silently lost.** `Conversation.js`'s own model comment declares `student` (local roster ref) and `externalStudentId` (real student-portal account) mutually exclusive — "exactly one of the two is set, never both." That was correct when written, but `Student.linkedUserId` (added earlier this pass by the enrollment-verification sync) now means a roster `Student` genuinely *can* correspond to a real, reachable portal account — and `sendMessage()`'s bridge-push only ever checked `conversation.externalStudentId`, which is never set on a conversation the teacher started first (only on one the student started). Result: any message a teacher sent to a student who hadn't messaged them first reached only the local roster record — the real student never saw it, with no error surfaced anywhere. **Verified the gap first** (sent a real message to a linked, verified student who'd never messaged in; it never appeared in that student's real `GET /api/student/messages`), then **fixed** `message.service.js#sendMessage` to resolve the external id at send time — from `conversation.externalStudentId` if present, else from the roster `Student.linkedUserId` — without touching the Conversation schema's documented invariant. Re-verified live: the same message now appears correctly in the student's real inbox with the correct teacher name.
8. **Uploading a teacher resource never notified the enrolled students** — `createBridgedMaterial` (student/backend) created the real `CourseMaterial` document and emitted a live Socket.IO event (`course:notes_added`), but never created a persisted `Notification`, unlike the equivalent live-class-reschedule path built earlier this pass. A student who wasn't actively connected via socket at the exact upload moment would never learn a new resource existed. **Fixed** by reusing the existing `notifyEnrolledStudents()` helper (the same one behind reschedule notifications) inside `createBridgedMaterial`. Re-verified live: uploading a PDF resource now creates a real notification — `"New resource: \"Week 3 JavaScript Basics\" — Full Integration Teacher uploaded a new resource for your course."` — linking to the real `/student/notes` route.

Also checked and confirmed **not** bugs (verified rather than assumed, since two of the six §19 findings looked correct on inspection but weren't):
- Course/Exam/Announcement creation payload shapes vs. their backend validators — all field names match; live-verified full create→publish/activate round-trips for all three.
- Exam/quiz server-side answer protection — `correctIndex` is present in the teacher's own view and confirmed **absent** from the student-facing quiz-detail response before submission.
- The quiz delivery bridge (`pushQuizToStudents`) — initially looked broken because it doesn't appear under the student's `/tasks` endpoint; confirmed it correctly appears under the separate, real `/api/student/quizzes` endpoint instead, and a second exam created purely through the live API (no manual intervention) delivered correctly on its own.
- Resource upload with an unsupported MIME type (`.txt`) — correctly rejected by the real file-type allowlist; not a bug, just an invalid test input. (The resulting error message, "Unexpected field", is a minor honesty/UX gap worth a follow-up — it doesn't clearly say "unsupported file type.")

**Both backends (`teacher`, `student`) were restarted against the same local test database to load these fixes** — all prior test data (teacher, classes, students, submissions, grades, reschedule history) was confirmed intact afterward via a live regression check (Gradebook, Timetable, Admin announcement bridge all still returned identical, correct data).

## 21. User-Reported Bug — Admin Announcements Never Notified Teachers

A user report: "teacher dashboard notification is not working when admin makes an announcement," plus a request for a real Announcements section on the Teacher Dashboard (not just the dedicated Announcements page).

**Root cause, confirmed by reading the code, not assumed**: `upsertAdminAnnouncement` (teacher/backend `internal.controller.js`, the endpoint the Admin→Teacher bridge calls) correctly created the real `AdminAnnouncement` record and emitted a live `announcement:admin` Socket.IO event — but never created a persisted `Notification` document. This is the exact same defect class as §19 item 8 (resource uploads), just in a different bridge that was built before the `notifyEnrolledStudents`-style pattern existed: a teacher who wasn't connected via socket at the exact moment of publish would never learn the announcement existed — no bell badge, no notification-list entry, ever, on any later login.

**Fixed**: added `notifyAllTeachersOfAdminAnnouncement()` to `internal.controller.js` — queries all `accountStatus: 'active'` teachers, bulk-inserts one real `Notification` (`type: 'announcement'`, linked via `relatedEntityType: 'AdminAnnouncement'`) per teacher, and emits `notification.created` to each teacher's own socket room individually (institution-wide `emitToAllTeachers` alone doesn't touch a per-teacher inbox). Called from `upsertAdminAnnouncement` right after the existing broadcast emit. Live-verified: unread count went `0 → 1` and the real notification (correct title/message/timestamp) appeared in `GET /api/teacher/notifications` the moment an admin published — reused across teacher/backend restart to confirm it wasn't a fluke.

**A second, independent bug found while verifying the first fix in-browser**: clicking the notification bell crashed the whole Teacher Portal — `TypeError: notifications.map is not a function`. Root cause: `teacherApiService.getNotifications()` returned the raw `{success, data, meta}` response envelope unwrapped, but `TeacherLayout.jsx` expected either a `.notifications` property or a bare array. This bug was latent for the entire project — it would have fired the very first time any teacher, ever, had a real notification and opened the bell, regardless of type, but nothing before this session's testing had actually produced a notification while someone was clicking the bell live. **Fixed**: `getNotifications()` now returns `{ notifications, unreadCount, meta }`, matching what the consumer already expected. Verified live in a fresh browser tab: opening the bell now correctly shows "New announcement: ..." with zero console errors.

**A third bug found while building the requested Dashboard Announcements widget**: a React "duplicate key" warning traced to `AdminAnnouncement` documents having no `id` virtual (every other model in this codebase does) — so `ann.id` was `undefined` for every admin-sourced announcement, silently invisible with one announcement, a real key collision with two or more. This affected both the new widget and the pre-existing "From Admin" tab on `AnnouncementsPage.jsx`. **Fixed** once at the service layer — `teacherApiService.getAdminAnnouncements()` now normalizes `id: a.id || a._id` on every item, so no consuming component needs to know about the inconsistency.

**New feature delivered**: `components/dashboard/RecentAnnouncements.jsx` — a self-contained widget (follows the same established pattern as `LeaderboardDiagnostic`/`PerformanceOverview`: its own fetch, loading/error/empty states, socket-driven refresh) merging the teacher's own published circulars with real Admin broadcasts, sorted by recency, capped at 5, with a "View All" link to the full Announcements page. Wired into `DashboardPage.jsx` in the Action tier, next to Recommended Actions. Live-verified with two real admin announcements rendering correctly, relative timestamps ("2m ago", "2h ago") accurate, zero console errors on a fresh tab.

**Environment note**: the local ephemeral test MongoDB (`mongodb-memory-server`, no persistent `dbPath`) lost all data mid-verification for the second time this project — a known characteristic of that setup, not caused by any code change. Recovered by re-seeding admin and recreating a minimal real test teacher each time; not a concern for the actual fix, which is backend logic unrelated to any specific data.

## 22. New Feature — Teacher-Initiated Announcements Broadcast to Students AND Admin, Both Notified

User request: let a teacher create an announcement directly from the Dashboard's Announcements section, broadcasting to both students and the Admin Dashboard, with real notifications on both sides.

**Research first, not assumed**: the Teacher→Student leg of this already existed in full (`announcement.service.js#deliver` → `studentBridge.service.js#pushAnnouncementToStudents` → student/backend's real `Announcement` model, which already has a `source: 'teacher-portal'` value and a working student-facing UI rendering "Posted by X · Teacher"). The **one real gap** on that side: student/backend's `createAnnouncement` created the record and emitted a live socket event, but — same defect class as §19/§21 — never created a persisted student `Notification`. **Fixed**: `student/backend/src/services/announcement.service.js` now bulk-inserts a real `Notification` for every eligible student (enrolled-only for a course-scoped announcement, every active student for an institution-wide one), reusing the existing `Enrollment`/`User` collections — no new model.

**Teacher→Admin did not exist at all** — confirmed by reading `admin/backend/src/routes/internal.routes.js` in full: there was no announcement-related internal route, no mirror model, nothing. Built from scratch, following the exact precedent already proven for the reverse direction and for academics monitoring:
- New model `admin/backend/src/models/TeacherAnnouncement.js` — a read-only mirror (sparse-unique `sourceId`, no default — the same index-bug class fixed repeatedly across this project).
- New internal routes `POST /api/internal/teacher-announcements` / `DELETE /api/internal/teacher-announcements/:sourceId`, shared-secret gated, upserted by `sourceId`.
- `admin/backend/src/services/announcement.service.js#ingestTeacherAnnouncement` — idempotent create, then calls the **already-existing** `notifyAllAdmins()` (the same helper Admin's own announcement-creation path uses) so every active admin gets a real, persisted `Notification` (`type: 'ANNOUNCEMENT'`), not just a passive log row.
- New admin-facing read endpoint `GET /api/admin/announcements/teachers` and a new **"From Teachers"** tab on `admin/frontend/src/pages/AnnouncementsPage.jsx`, symmetric to the teacher side's existing "From Admin" tab.
- `teacher/backend/src/services/adminBridge.service.js` gained `pushAnnouncementActivity()`/`retractAnnouncementActivity()` (matching the file's existing `pushAssignmentActivity` pattern exactly, including the `call()` helper needing a real `DELETE`-method option it didn't have before). Wired into `announcement.service.js#deliver()` alongside the existing student push, and into `archiveAnnouncement`/`deleteAnnouncement` for retraction.

**Dashboard UI**: `components/dashboard/RecentAnnouncements.jsx` gained a "New" button opening the exact same create form already proven correct on `AnnouncementsPage.jsx` (title/description/type/priority/audience/class-picker), calling the same `createAnnouncement` + `publishAnnouncement` API pair — no new frontend API method needed, since publishing already triggers both bridges now. Per the user's explicit "left-side announcement section" phrasing, swapped the Dashboard's Action-tier column order so Announcements is the wider, left column and Recommended Actions moved to the right.

**Live-verified end-to-end, twice — once via curl, once by actually driving both real browser UIs**:
1. Created a real class linked to a real student course (`studentCourseSlug: prarambh`).
2. Published a teacher announcement via curl targeting "all my classes" — confirmed a real student (`student.a`) received a persisted Notification (`"Notif Test Teacher: Field Trip Permission Slips Due"`) and the announcement itself appears in their real announcements list with `author: {name, role: 'teacher'}`; confirmed a real, persisted admin Notification (`"New announcement from Notif Test Teacher: ..."`, `unreadCount: 1`) and the new `GET /announcements/teachers` endpoint returns the correct mirrored record.
3. Repeated the entire flow purely through the browser: logged into the Teacher Portal, clicked "New" on the Dashboard widget, filled in the real form, submitted — the modal closed, the widget refreshed showing the new circular with zero console errors on a fresh tab. Independently confirmed via API that this exact browser-driven action produced the same real student + admin notifications.
4. Logged into the Admin Portal in the browser, opened Announcements → **"From Teachers (2)"** tab — both real teacher announcements rendered with correct teacher name and class label. Opened the notification bell/drawer — the real notification ("New announcement from Notif Test Teacher: Browser UI Test Announcement · 2m ago") was genuinely present in the drawer's DOM content, not just the API response.

No fake data anywhere in this feature: every announcement, notification, and mirrored record traces to a real MongoDB write triggered by a real HTTP request in this session.

## 23. User-Reported Bug — 256 Fake Students, Fake Assignments in the Seed Data

User report: "Remove all 256 fake students in teacher. Show only students who purchase the courses after successful payments. Remove fake assignment, show only created and original data of assignment. If created it must show on student dashboard sync with teacher."

**Root cause, confirmed by reading the code, not assumed**: `teacher/backend/src/seed/seed.js` — a real development seed script, distinct from the frontend `teacherMockData.js` deleted in §19 — inserted 256 genuine `Student` documents (from `seed/data/demoFixture.json`) into the actual MongoDB `Student` collection for one demo teacher account (`rajesh@nalanda.edu` / "Dr. Rajesh Varma"), plus fake `Assignment`+`Submission`+`Attendance`+`Notification`+`Conversation` records referencing those fake students, complete with randomly-generated scores, grades, and feedback text run through the real metrics pipeline so they'd look genuinely computed. None of these 256 "students" were ever linked to a real student-portal account or a real purchase (`linkedUserId` was never set) — they were indistinguishable from real, paying students anywhere the app displayed a roster, leaderboard, or dashboard stat. The literal string "256 students" was even hardcoded into the seed's own welcome notification text.

**A second, deeper problem found while investigating**: even independent of the seed script, no student-facing query anywhere in `teacher/backend` filtered on `linkedUserId` (the field that actually proves a real purchase, per the "registered ≠ purchased" architecture built earlier this project — see §7 of the original integration work). `listStudents`, `getAtRiskStudents`, the class-leaderboard, the class-level student-count aggregate, and global search all matched on `status: 'active'` alone. This meant *any* unverified roster row — not just these specific 256, but any future one from any source — would silently appear everywhere a teacher looks, with no code-level guarantee that "on the roster" meant "actually purchased."

**Fixed, both layers**:
1. `teacher/backend/src/seed/seed.js` — the entire fake-student/assignment/submission/attendance/conversation generator removed outright (not disabled, not gated behind a flag — deleted), along with the now-dead `createStudents`, `createAssignmentsAndSubmissions`, `seedSubmissionsForAssignment`, `createAttendance`, `deriveConceptScores`, and `createConversationAndMessages` functions and their now-unused imports (`recalculateStudentMetrics`, `recalculateClassAverages`, `dicebearAvatar`, `Submission`, `Attendance`, `Conversation`, `Message`). The script still creates a real demo teacher account, real classes, real curriculum concepts, a real today's-schedule template, and real course/exam/resource shells — none of which impersonate a real person or real submitted work. The welcome notification no longer references a fabricated headcount.
2. Added `linkedUserId: { $ne: null }` to the query filter in five places: `student.service.js#listStudents` (the Students roster page, and — since `getClassStudents` delegates to it — the per-class roster too), `student.service.js#getAtRiskStudents` (Dashboard at-risk widget), `class.service.js#getClassAggregateStatsMap` (every class-level student count shown anywhere, including the Dashboard's "Total Students" stat, which derives from this), `leaderboard.service.js#getClassLeaderboard` (Dashboard leaderboard), and `search.service.js#globalSearch` (⌘K search). This is a structural guarantee, not just a seed-data cleanup — even if an unverified row exists in the database for any reason, it now cannot surface in any of these real, teacher-facing views.

**Live-verified end-to-end, this session**:
- Ran the fixed seed script fresh: `Students: 0`, `Assignments: 0` in its own printed summary (previously always `256`/`16`).
- Confirmed via the real API: the demo teacher's roster (`GET /students`), dashboard `totalStudents` stat, and per-class `studentCount` all correctly read `0` immediately after seeding — no residual fake population.
- Linked one of the demo teacher's real classes to the real `prarambh` student-portal course and ran a real `syncEnrollmentForClass` against two real, already-enrolled test student accounts — the roster correctly went from `0` to exactly `2`, both `verified: true`.
- Created one real assignment on that class — confirmed it correctly seeded 2 real (not fake) submission stubs, and confirmed via the real student-portal API that the assignment appeared on the real student's dashboard task list (`GET /student/tasks`) with the correct title, description, and due date — the assignment→student-dashboard sync this task explicitly asked to verify was never broken by this fix; it was already real infrastructure from earlier in this project (§9 of the original integration work), just now finally exercised against a roster that's real from top to bottom.
- Confirmed the class-leaderboard and global search (⌘K) both correctly return only the 2 real students.
- Browser-verified in a fresh tab, zero console errors: Dashboard reads "Total Classes: 8, Total Students: 2" and the Students page reads "2 students across your classes" — both showing the real students by name and email, not the old 256.

**Scope note — which database this was fixed against**: all verification above ran against this session's local, ephemeral test MongoDB (the same one used throughout this project's testing, reset between sessions). The *code* fix is universal and applies wherever this backend runs. If the actual 256-student data the user is seeing lives in a different, persistent database (e.g. a real MongoDB Atlas instance this workspace's `.env` points to), that specific database still has the old fake records physically present until someone runs `npm run seed -- --reset` against it (which now deletes the old fake population as part of wiping the demo teacher, per `wipeTeacherData`) — the code will not silently keep showing them either way, since the query-level `linkedUserId` filter added above means old, unlinked rows can no longer surface even without a reseed. Flagging this rather than assuming which database was in view, since running a destructive reset against a real/shared database is the kind of action worth confirming first.

## 24. User-Reported Product Correction — This Is a Coaching Platform, Not a K-12 School

User feedback: "this is not institute website of class, this is like coaching course. So, in my class section show the class of courses and also create a class of course, not like school class 9A ...option. it should be coaching course classes."

**What this meant, confirmed by reading the code**: the "Class" entity (`SchoolClass` model) required a `grade` (e.g. "12") and `section` (e.g. "A") on every create, generated its unique code by concatenating them (`"12A"`), sorted and filtered the Classes page by grade, and displayed "Grade 12 • Sec A" as the primary label on every class card and in the create form — pure K-12 school framing. The real course-link (`studentCourseSlug`, the field that actually determines who can enroll via a real purchase) already existed and worked correctly, but the create form buried it at the bottom as an *optional* "Link to Student Portal Course" field — backwards for a coaching platform, where the course *is* the product and a "class" is a batch/section of students taking it.

**Fixed**:
- `SchoolClass` model: `grade`/`section`/`subject` changed from required to optional (kept only for any pre-existing legacy class data; never populated by new batches).
- `class.validators.js`: `studentCourseSlug` is now the required field on create (was optional); `grade`/`section` are no longer required.
- `class.service.js#createClass`: batch code is now derived from the course slug + batch name (e.g. `PRARAMBH-MORNING-BATCH-A`) instead of grade+section — namespaced by course so two different courses can each have their own "Batch A" without colliding.
- `class.service.js#listClasses`/`getClassById`: every class response now includes a live-resolved `courseTitle`, fetched from the real public course catalog (student/backend) the same way the course picker already did — never stored/cached, so it always reflects the course's current real title.
- `ClassesPage.jsx`: the create form's Course dropdown is now the first, required field (was optional and last); Grade/Section inputs removed entirely; "Class Name" relabeled "Batch Name" with a coaching-appropriate placeholder ("Morning Batch A"). Class cards now show the real course title as the primary badge instead of "Grade X • Sec Y". The Grade filter row is now a Course filter, grouping real batches by their real linked course.
- `seed/seed.js`: the demo teacher's starter classes are no longer grade/section school classes — `createClasses` now fetches the real public course catalog and creates one batch per real course found (up to 4), named "Batch A"/"Batch B"/etc. If no real courses exist yet in the environment (e.g. student/backend hasn't been seeded), it correctly creates zero classes rather than fabricating batches with nothing real to attach them to. `createCourses`' grade-based senior/junior split (a *different*, teacher-authored curriculum-content model, left otherwise untouched) was simplified since grade no longer exists to split on.

**Live-verified end-to-end**: reseeded fresh — 4 real batches created, each named "Batch A"–"Batch D" and correctly linked to a distinct real course from the actual public catalog (`PRARAMBH — The Awakening`, `Python for Beginners`, `Web Development Full Stack`, `Data Science with Python`), all with `grade: null, section: null`. Confirmed via the real API that creating a class *without* a course is rejected (`"Select the course this batch is for"`) and creating one *with* a real course succeeds and returns the correctly-resolved `courseTitle`. Browser-verified in a fresh tab, zero console errors: the Classes page shows "Course:" as the filter (with real course names as the filter options), every class card shows its real course title as the primary badge, and the Create Class form shows only Course/Batch Name/Room/Capacity/Schedule — no grade or section anywhere. Completed a full create-through-the-UI test (selected "Python for Beginners", named a batch "Weekend Batch UI Test", submitted) and confirmed the new batch appeared correctly on the page immediately.
