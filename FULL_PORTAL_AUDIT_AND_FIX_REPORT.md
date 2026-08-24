# Nalanda Nexus — Full 3-Portal Audit & Fix Report

Scope: "check all pages, fix remaining issues, known issues and fix all gap among all of them (Admin, teacher, student). real-time sync with all pages."

**Method**: four parallel research agents audited every page in Admin, Teacher, and Student (public + authenticated), plus every cross-portal `/api/internal/*` bridge, reading actual code rather than trusting old report docs. Findings were then fixed directly, verified via clean production builds on all three frontends, clean startup on all three backends, and targeted live-browser checks (including logging into all three portals with real seeded accounts). One live check surfaced a real bug the static audit couldn't see — documented in full below, not hidden.

---

## 1. Admin Portal

| Fix | File | What was wrong |
|---|---|---|
| Infinite-spinner bug | `AnnouncementsPage.jsx` | `fetchAnnouncements` had no try/catch — a failed request left the page spinning forever with an unhandled rejection. Added proper error state + Retry. |
| Infinite-spinner bug | `ResourcesPage.jsx` | Identical bug. Same fix. |
| Fake success | `CourseGovernancePage.jsx` | "Audit Syllabus" button called no API, just showed a toast claiming a report was generated. Removed — no real backing feature exists. |
| Silent failures | `CourseGovernancePage.jsx`, `PaymentsPage.jsx` | Instructor/student dropdowns failed silently on load error. Now surfaced. |
| Dead status | `PaymentsPage.jsx` | Backend fully supports `REFUNDED` status; no UI path could ever reach it. Added a real "Mark Refunded" action reusing the existing endpoint. |
| Silent CSV failures | `ReportsPage.jsx`, `StudentsPage.jsx`, `TeachersPage.jsx` | Download buttons failed with zero feedback. Added per-button loading state + visible error (matching the one page, `SystemLogsPage.jsx`, that already did this right). |
| Fake placeholder | `AdminHeader.jsx` | `unreadNotificationsCount` defaulted to a hardcoded `3`. Now `0`. |
| Dead UI | `PerformanceLeaderboard.jsx` | Time-period filter buttons (Week/Month/Semester/Year) were fully decorative — the backend has no time dimension for leaderboards at all. Removed rather than fake it. |
| Missing realtime | `AdminOverviewPage.jsx` | The page every admin lands on first had **zero** live sync, despite the backend already emitting a purpose-built `analytics.updated` event. Wired it up, plus student/teacher/course/payment events. |
| Dead filter | `StudentsPage.jsx` | A `batch` filter was sent to the backend but had no UI control. Added a real dropdown, derived from real loaded data. |

## 2. Teacher Portal

| Fix | File | What was wrong |
|---|---|---|
| **Crash bug** | `GlobalSearchModal.jsx` | Pressing Ctrl+K from a closed state called `setOpen()` — a function that didn't exist — throwing a `ReferenceError` on every use of the app's most prominently advertised shortcut. Verified live: fixed, no longer throws. |
| Fully fake data | `AvgScoreModal.jsx` | Every number (256 students, 8 classes, 85% mean, fixed quartile percentages) was hardcoded, completely ignoring the real backend endpoint built specifically to feed it. Rewired to consume real data. |
| Fake success | `StudentDrillDownDrawer.jsx` | "Dispatch Notice" claimed a message reached the student "& guardian portal" (which doesn't exist) but made zero API calls. Now sends a real message via the existing conversations API. |
| Wrong field | `StudentDrillDownDrawer.jsx` | "Submissions & Quizzes" tab read `student.timeline`, a field that doesn't exist on the real payload (`submissions`/`scoreTimeline` do) — silently rendered empty for every student. Fixed. |
| Fabricated fallback | `StudentDrillDownDrawer.jsx` | `student.classAverage \|\| 85` overrode a legitimate real `0` with a fake `85`. Fixed to an honest `?? 0`. |
| Dead UI | `ConceptBreakdown.jsx` | Cohort filter dropdown did nothing — the backend has no class-scoped concept-query support. Removed. |
| Missing realtime | `StudentsPage.jsx`, `ClassesPage.jsx`, `GradesPage.jsx` | No live subscription at all. Added `score:update`/`submission.received` listeners. |
| Missing event | `GradingPage.jsx` | Subscribed to `score:update` but not `submission.received` — a new submission arriving didn't update the To-Grade count live. Fixed. |
| Silent failure | `ClassesPage.jsx` | A failed roster sync left the admin with zero feedback. Now surfaced. |
| Wrong link / fake copy | `TeacherLoginPage.jsx` | "Student Portal" link pointed at the wrong port (5173, should be 3000). "Faculty SSO Verified" label describes a feature that doesn't exist anywhere in this codebase. Both fixed/removed. |

### 2a. A live bug the static audit missed

While verifying the dashboard live, I found **"Total Students: 0" next to a trend badge reading "+256 this week"** — the exact number from the fake-student bug removed earlier this project. Investigation showed the earlier fix only **filtered fake students out of list views** — it never applied the same `linkedUserId` (real-purchase) filter to the ~15 other places across the codebase that query `Student` directly for dashboards, analytics, assignment creation, and reports. The underlying fake documents were still physically in the database, just hidden from rosters.

Fixed by applying the same `linkedUserId: { $ne: null }` gate to every genuinely-broad "all active students" query:

- `dashboard.service.js` — the "+256 this week" trend, and a `Submission` aggregation feeding "Class Average Score" trend (fixed via a `$lookup` join, since that pipeline starts from `Submission`, not `Student`)
- `analytics.service.js` — `getAvgScoreBreakdown` (feeds the just-fixed AvgScoreModal), `getConceptPerformance`, `getGradebook`, and `getPerformanceTrend`'s class-average chart (also via `$lookup`)
- `assignment.service.js` — submission-stub seeding on assignment creation (was creating pending Submission rows for fake students)
- `course.service.js` — a course's `studentCount`
- `metrics.service.js` — class-average recalculation and concept-analytics recomputation (both directly upstream of fixes made earlier in this same pass)
- `schedule.service.js` — 4 attendance/expected-student counts
- `attendance.service.js` — attendance-marking validation

Verified live: "Total Students" now shows **"0, No change this week"**, and "Class Average Score" shows **"0%, Not enough graded work yet to trend"** — both honest, since every remaining student/submission was unverified. Specific-ID lookups (e.g. `Student.find({_id: {$in: knownIds}})`) and `report.service.js`'s CSV export (which deliberately shows both a raw and a `verifiedCount` side by side) were left untouched — those weren't the bug.

## 3. Student Portal (public Landing Page + authenticated)

| Fix | File | What was wrong |
|---|---|---|
| Backend correctness bug | `task.controller.js` | Every task submission hardcoded `taskScore: 85` into the student's real, displayed `averageTaskScore` — a fabricated number presented as a genuine computed metric. Removed; a real score now only lands there once a teacher actually grades a bridged submission (see §4). |
| Fake platform stats | `StatsSection.jsx` (Home page hero) | "50K+ Active Learners / 1,200+ Courses / 250+ Mentors / 500+ Projects / 98% Satisfaction" were all hardcoded marketing numbers on the single highest-traffic page. Built a real `GET /api/public/stats` aggregation (real user count, real course/module count, real distinct-instructor count, real completed-task count, real average course rating) and rewired the component — verified live, now shows real (small, honest) numbers like "2 Active Learners". |
| Fabricated testimonials | `CommunityImpactSection.jsx` | Three named people ("Ananya Sharma," "Rohit Verma," "Sneha Patel") with stock Unsplash photos, presented as real learner testimonials. Built `GET /api/public/highlights`, sourcing genuine recent posts from the real Community feed — verified live, now shows an actual post from a real seeded student ("Rohan"). "120+ Countries"/"5K+ Study Groups" (zero backing anywhere) were dropped in favor of two real counts (Active Learners, Community Posts). |
| Fabricated data | `PerformancePage.jsx` | The "3 Pillars" competency bars (82%/68%/74%) were hardcoded with no backend concept behind them at all. Added the student's enrolled course's real `pillar` field end-to-end (backend dashboard response → context mapper → page), so the pillar the student is actually enrolled in shows their real overall score, and the other two honestly show "Not started." Verified live. |
| Systemic fake-fallback pattern | `ReturningHeader.jsx`, `StudentSidebar.jsx`, `PerformanceChart.jsx`, `ContinueCard.jsx`, `MobileNavigation.jsx` | Half a dozen components fell back to a specific fabricated person ("Adarsh Tiwari") or plausible-looking fake numbers (560 pts, 78%/67% scores, a specific fake lesson title, 4-of-15 topics) whenever data hadn't loaded yet. All changed to honest `0`/empty-string defaults. |
| Missing event | `LiveClassesPage.jsx` | Subscribed to created/live/cancelled but not `course:lecture_rescheduled` (which the backend does emit) — a rescheduled class's new time never appeared live. Fixed. |
| Silent wrong-task bug | `TaskDetailPage.jsx` | A stale/invalid task ID in the URL silently substituted a *different, unrelated* task instead of showing an error — meaning a student could end up submitting against the wrong assignment. Added real loading/not-found states; also fixed a related stale-initial-render bug where `isSubmitted`/`submissionText` could get stuck wrong if the task list hadn't loaded yet on first render. Verified live. |
| Missing confirmation | `NotesPage.jsx` | Delete had no confirmation dialog. Added one. |
| Unused real API | `HelpSupportPage.jsx` | A real `GET /api/student/support-tickets` endpoint already existed but nothing called it — a student who filed a ticket had no way to see it again. Added a real "My Support Requests" section. |
| Fake interactive state | `CourseCard.jsx` | "Notify Me" waitlist button set local state only — the "signup" silently vanished on refresh, with no backend concept of a waitlist anywhere. Replaced with an honest disabled "Coming Soon" state. |
| Missing realtime | `Community.jsx` (peer feed) | The one major content-creation path in the whole app with **zero** live sync — a new post or like from another student never appeared without a manual reload. Added `community.post_created`/`community.post_updated` socket events (backend) and a live listener (frontend); like-count broadcasts deliberately omit `likedByMe` (that's viewer-relative, broadcasting it would show everyone as having liked it). |
| Fake event | `Community.jsx` | A hardcoded "Nalanda Nexus Global Hack 2026, Starts August 28, 2026" card had no backing event system anywhere. Removed. |
| Dead code | `Classroom.jsx`, `Projects.jsx`, `TestimonialsSection.jsx`, `WhyChooseSection.jsx`, `platformStats.js` | Confirmed unreferenced from any route or import. Deleted. |

## 4. Cross-Portal Bridges

The dedicated bridge audit found the two-way "assign → submit → grade" loop this system is built around was **only half-built on both content types**: submissions flowed from student back to teacher, but grades never flowed back to the student; quiz results had no return leg *at all*. Both were built this pass:

- **Teacher → Student grade return leg** (new): grading a bridged submission now pushes the real score/feedback back to the student's own `TaskSubmission` via a new `PATCH /api/internal/task-submissions/:id/grade` endpoint, creates a real notification, and — this is what closes the loop from §3 above — recalculates the student's real `averageTaskScore` from the genuine percentage for the first time ever.
- **Student → Teacher quiz-result return leg** (new): a bridged quiz's server-graded first-attempt result now pushes back to a new `ExamResult` model on teacher/backend (Exam itself deliberately tracks no per-student data — this is where that data now actually lives), with a real notification.
- **Notification-persistence gaps** (the recurring defect class from earlier in this project, found again in 5 more places): `deliverTeacherMessage` (student side) created a live socket event but no persisted `Notification` — and the `Notification` model didn't even have a `'message'` type in its enum yet, despite the *mirror* function on the teacher side already having this exact fix applied with a comment explaining why. Also fixed: `upsertBridgedTask`, `upsertBridgedQuiz`, `createBridgedLiveClass` (initial creation), and teacher's `assignCourse`.
- **Orphaned catalog course**: admin's `deleteCourse` never unpublished the course from the student catalog (only the separate status-change path did) — a hard-deleted course could stay purchasable forever. Fixed.
- **Broken image**: admin→teacher course-assignment bridge sent a bare relative image path instead of resolving it to an absolute URL (the sibling student-catalog bridge already did this correctly) — confirmed this rendered as a broken image in the Teacher Portal's assigned-courses view. Fixed.
- **Missing admin notification**: a payment that transitioned to `PAID` via a delayed/retried webhook (the *update* branch of `ingestBridgedPayment`) never notified admins — only the initial-ingest branch did. Fixed.

## 5. Verification

- All three backends (`student:5001`, `teacher:5002`, `admin:5003`) restart cleanly with no errors after every change.
- All three frontends (`student`, `teacher`, `admin`) production-build cleanly (`vite build --mode production`) with zero new errors.
- Live-verified in-browser, logged in as real seeded accounts on all three portals:
  - Student Landing Page: real stats, real community-post testimonial, real Announcements/Resources sections.
  - Authenticated student: `PerformancePage` real pillar mapping, `TaskDetailPage` honest not-found state, `Community` feed with the fake hackathon card gone.
  - Teacher: dashboard's "+256 this week"/"+9% this week" fake trends now show honest zero-states; Ctrl+K no longer throws.
  - Admin: `AnnouncementsPage`/`ResourcesPage` no longer show infinite spinners; `AdminOverviewPage` renders with the new realtime hook attached, no console errors.

## 6. Acknowledged remaining gaps (not hidden)

- `teacher/backend`'s `attendance.service.js#markAttendance` still emits no socket event at all — a pre-existing gap documented in an earlier phase of this project, not touched here since it's a new feature (a socket event + frontend listener), not a data-fabrication bug.
- Two teacher-frontend components (`CreateSessionModal.jsx`, `Modal.jsx`) are dead code with doc comments claiming they're shared — they aren't imported anywhere. Left alone (harmless, not a data or correctness issue).
- Several real, backend-complete teacher API methods (`archiveClass`, `archiveStudent`, `deleteExam`) have no UI entry point at all. Not fixed — adding UI for them is a feature, not a bug fix.
- Per-pillar mastery on `PerformancePage.jsx` is a real but coarse signal (the enrolled course's pillar gets the real overall score; the other two are honestly "not started") — not a rich multi-dimensional tracking system, since no such backend concept exists to build on without inventing new infrastructure.
- Given the sheer number of pages across three portals, this pass prioritized every **high/medium**-severity finding from all four audits plus everything the live verification pass surfaced; a handful of cosmetic/low-severity items (e.g., a fixed department-name dropdown list, a `window.confirm`-based delete instead of a styled modal on the Resources page) were left as-is as genuinely low-value polish, not silently dropped bugs.
