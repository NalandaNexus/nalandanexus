# Nalanda Nexus — Admin Backend + Frontend Integration: Final Report

**Supersedes the previous version of this file** (Phase 1, admin/backend's initial MongoDB integration). This report covers Phase 2: making Admin fully real/dynamic/database-driven, removing Classes/Batches/Subjects entirely, real teacher provisioning, real Razorpay-connected payments, real course commerce + image upload synced to the public catalog, live read-only academic monitoring bridged from Teacher Portal, expanded CSV reports, audit logging, and removal of all remaining fake/demo data. Every claim below was checked against live, running code in this session — not inferred from a prior summary.

---

## 1. Architecture

```
Admin (React, :5175) ─┐                    Teacher (React, :5174) ─┐                Student (React, :5173) ─┐
                       │ JWT Bearer                                │ JWT Bearer                             │ JWT Bearer
                       ▼                                            ▼                                        ▼
Admin API (:5003) ────────────────── Teacher API (:5002) ────────────────── Student API (:5001)
      │  Mongoose                          │  Mongoose                          │  Mongoose
      ▼                                     ▼                                     ▼
MongoDB nalanda_admin              MongoDB nalanda_teacher              MongoDB nalanda_student
      (one Atlas cluster: nalanda0.mwt9w74.mongodb.net — same credentials, separate database names, never merged)

Cross-portal writes travel over small, shared-secret-authenticated HTTP bridges
(`X-Internal-Service-Key`, mounted at /api/internal/* on each backend), idempotent
on a `sourceId` field, never a client-trusted database merge:

  Admin  ──provision real login──▶  Teacher   (teacher creation)
  Teacher ──assignment/quiz/attendance snapshot──▶  Admin   (academic monitoring)
  Admin  ──publish approved course──▶  Student   (course catalog)
  Student ──signature-verified payment──▶  Admin   (payment ledger)
```

Each portal remains fully independent — no shared `User` collection, no merged database, no portal able to authenticate into another using its own token (confirmed: `JWT_SECRET` differs between admin and teacher backends; student uses an entirely different `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` scheme).

---

## 2. Removed: Classes, Batches, Subjects (Admin)

Fully deleted, both backend and frontend — models, services, controllers, routes, validators, socket events, permission constants, seed logic, and every UI page/nav entry/modal field that referenced them (`ClassesBatchesPage.jsx`, `SubjectsPage.jsx`, sidebar links, quick-search entries, leaderboard's "Top Classes" tab, student/teacher class-reference fields). Verified clean in this session: no remaining source-code reference anywhere in `admin/backend` or `admin/frontend` (only a stale doc mention and a stale pre-Phase-2 `frontend/dist/` production build artifact remain — see §11). Teacher Portal's own, unrelated `SchoolClass` model (its curriculum/section concept) was intentionally left untouched — it was never in scope.

---

## 3. Teacher Creation — Real Login, Not an Invitation Link

**Before this phase**: an invitation-link flow that only ever wrote to Admin's own database — teacher/backend's real `createTeacherAccount()` function existed but was never called from anywhere, so a newly "created" teacher could not actually log into the Teacher Portal.

**Now**: `POST /api/admin/teachers` generates a real random temp password (`crypto.randomBytes`-based, never predictable), bcrypt-hashes it into Admin's own governance `Teacher` record, and calls a new `POST /api/internal/teachers` on teacher/backend (shared-secret authenticated) which creates the actual working login via `createTeacherAccount({ mustChangePassword: true })`. A credentials email is sent (real `nodemailer` transport; see §11 for the SMTP caveat). Both outcomes — portal provisioning and email delivery — are tracked on the Teacher record (`portalProvisioned`, `credentialEmailSent`, `emailDeliveryStatus`) and surfaced to the caller as `warnings`, never silently swallowed, because a failure here means the teacher genuinely cannot log in.

**First-login enforcement is server-side, not cosmetic**: `mustChangePassword` on teacher/backend's `User` model is checked inside the shared `authenticate` middleware — every route outside `/api/teacher/auth/*` returns `403 PASSWORD_CHANGE_REQUIRED` until the password is changed.

**Verified live in this session** (not from memory — re-run end-to-end just now):
1. Created a real teacher via `POST /api/admin/teachers` → got back a real temp password.
2. Logged into teacher/backend with it → `mustChangePassword: true` in the response.
3. Called a normal protected route (`GET /api/teacher/dashboard`) → **403 `PASSWORD_CHANGE_REQUIRED`**, confirming the gate is real, not a frontend-only redirect.
4. Called `POST /api/teacher/auth/change-password` → succeeded, and the prior session was immediately revoked (`TOKEN_REVOKED` on reuse) — a real logout-everywhere on password change.
5. The old temp password → `401 INVALID_CREDENTIALS` (dead).
6. The new password → logs in with `mustChangePassword: false`, full access restored.
7. Confirmed `teacher.provisioned` audit-log entry recorded with `result: SUCCESS`.

Test records were soft-deleted afterward.

---

## 4. Real Razorpay-Backed Payments

student/backend already owns the real, HMAC-SHA256-signature-verified Razorpay flow (`crypto.timingSafeEqual`). It now pushes every order outcome (`PAID`/`FAILED`) to a new `POST /api/internal/payments` on Admin, idempotent on `sourceId` (student/backend's Order `_id` — no schema `default` on that field, avoiding the sparse-unique-index bug hit and fixed repeatedly elsewhere in this project). Admin's `Payment` model gained `source: 'manual'|'razorpay'`, `sourceId`, `razorpayOrderId`, `razorpayPaymentId`, `courseTitle`, and relaxed its `student` ref (bridged rows have no admin-owned Student document — they carry `externalStudentName`/`externalStudentEmail` instead, following the same pattern already used for cross-portal messaging).

**Verified live**: the Admin Payments page currently shows two real bridged transactions (a `PAID` and a `FAILED` Razorpay purchase of "PRARAMBH — The Awakening"), correctly tagged `Razorpay` (not `Manual`), with real `razorpayOrderId`/`razorpayPaymentId` values, and the page's disclaimer text now accurately describes the bridge instead of the old "not connected to Razorpay" placeholder. `payment.bridged` audit-log code was reviewed and the service module loads and serves live data correctly (proven by the Payments page itself, which runs through the same file) — it was not independently re-triggered by a fresh live purchase in this verification pass, since doing so requires real student/backend login credentials this session doesn't have. This is the one new audit-log addition not re-confirmed by a fresh live trigger (the other two, `teacher.provisioned` and `course.imageUploaded`, were).

---

## 5. Course Creation — Real Commerce Fields, Image Upload, Live Catalog Bridge

Admin's `Course` model gained `description`, `features[]`, `priceInPaise`, `image`, `slug` (unique) — additive to the existing governance fields (code, title, instructor, credits, status). Image upload uses `multer` (5MB limit, image MIME types only), served from `/uploads` with an explicit `Cross-Origin-Resource-Policy: cross-origin` header (Helmet defaults to `same-origin`, which would have silently broken the image in a real browser `<img>` tag while working fine under `curl` — caught and fixed before it could ship as a bug).

When a course reaches `APPROVED` status (the existing real governance workflow, not bypassed), it's pushed to `POST/PATCH /api/internal/courses` on student/backend, which upserts a real, purchasable `Course` by `sourceId`.

**Verified live**: created "Applied Machine Learning for Everyone" in Admin with a real uploaded image, approved it, and confirmed it appears in `GET /api/public/courses` — the same endpoint the Landing Page/Student catalog actually reads — with `isPurchasable: true`, the correct price (₹4,999 → `499900` paise, matching exactly), and `bannerImage` pointing at Admin's own `/uploads/courses/...` path, which loads with `HTTP 200` and the correct `Cross-Origin-Resource-Policy: cross-origin` header. `features` correctly maps to the public catalog's `skills` array.

**Honest limitation**: admin-authored courses become purchasable immediately but have no lesson/module content (`modules: []`) — an actual video/lesson content editor is a separate, larger feature nobody asked for; this makes the course exist and be buyable, matching the literal spec ask, without inventing an authoring system. Teacher Portal read access to Admin's catalog was explicitly out of scope (teacher/backend has its own, unrelated curriculum concept) and remains unbuilt — flagged, not silently dropped.

---

## 6. Academic Monitoring in Admin (Read-Only)

New lightweight read-model collections in Admin — `AssignmentActivity`, `QuizActivity`, `AttendanceSummary` (one row per class+date, not per student — Admin only needs the daily tally, never raw per-student attendance or quiz question content). Teacher/backend pushes snapshots via a new best-effort bridge (`adminBridge.service.js`) on assignment create/update/archive, submission grading, exam create/update/delete (question **count** only, never content), and daily attendance tallying. New `/api/internal/academics/*` routes on Admin, upserting by `sourceId`.

**Verified live**: the Academics page shows a real bridged assignment ("Binary Search Trees Lab", Class 9A, Dr. Rajesh Varma, due 8/25/2026, 0/32 submitted) with the page correctly labeled "Live activity bridged from the Teacher Portal — read-only, monitored here, graded there" — no "not tracked by Admin" placeholder remains anywhere.

---

## 7. Removed: All Remaining Fake Dashboard Data

A second, independent review of the codebase (not trusting an earlier claim that this was already done) found the Overview dashboard's KPI fallbacks, sparklines, leaderboard, recent-activity feed, and the Faculty-by-Status donut chart still had hardcoded/fabricated fallback values that rendered whenever real data was genuinely empty — exactly the state a freshly-seeded institution is in. All removed this session:

- `StatsGrid.jsx` / `StatCard.jsx`: deleted hardcoded KPI literals (`2840`/`124`/`86`/`2391`) and fake sparkline arrays — real zero now shows as zero.
- `RecentActivity.jsx`: deleted 5 fabricated activity rows, added a genuine empty state.
- `PerformanceLeaderboard.jsx`: deleted fabricated teacher/course leaderboard rows.
- `LearningActivityChart.jsx`: deleted a fabricated 4-range dataset, added a genuine "no activity yet" state.
- `TeacherStatusChart.jsx`: deleted `?? 98/18/6/2` fallbacks — a real (possibly all-zero) loaded state is now distinguishable from loading.
- `AdminLoginPage.jsx`: **removed a real, shipped security issue** — a hardcoded real admin password (`Admin@Nalanda2026!`) as the form's default state, a hardcoded demo email, a one-click "Fill Demo Admin" button (desktop and mobile), and a "Forgot Password" modal that displayed plaintext demo credentials. The modal now only shows legitimate "contact your System Operations Lead" guidance.

**Verified live**: the Overview dashboard currently renders entirely real, non-fake data (4 students, 6 faculty, 3 published courses, a real 5-teacher leaderboard with actual ratings, a real recent-activity feed of genuine admin actions with real timestamps) with no fabricated fallback numbers anywhere. The login page has no demo-fill affordance and no pre-filled credentials.

---

## 8. CSV Reports — Expanded, With Filtering

`report.service.js` gained three new report types alongside the existing `teachers`/`students`/`audit`:

| Type | Notable columns |
|---|---|
| `courses` | code, title, instructor, status, price (INR), catalog sync status |
| `payments` | student name/email (real or bridged-external), course, amount, **source** (Razorpay/Manual), Razorpay order/payment IDs |
| `enrollments` | student, course, progress %, status, enrolled/completed timestamps |

All six types now accept optional `from`/`to` (date-range on the relevant timestamp field) and `status` query filters. The frontend Reports page gained 3 new report cards (Course Catalog, Payments & Razorpay Transactions, Course Enrollment), using the same existing authenticated-blob-download mechanism as before — no new download code path.

**Verified live**: all 6 report types return `200` with correct real data and headers; `status=PAID`/`status=FAILED` filters on the payments report correctly narrow to 1 row each (2 unfiltered); a future `from` date correctly returns a header-only (empty) CSV for courses.

**New audit-log action types**, added at their real trigger points via the existing `recordAuditLog` helper:
- `teacher.provisioned` — logged separately from `teacher.created`, capturing the portal-provisioning outcome specifically (`SUCCESS`/`FAILURE`), since provisioning can fail independently of the governance record write. **Verified live** in the walkthrough above.
- `course.imageUploaded` — logged on course create/update whenever an image is present/changed. **Verified live**: created a course with a real uploaded image, confirmed the entry in the audit CSV export.
- `payment.bridged` — logged in `ingestBridgedPayment` for both new and duplicate-delivery-updated bridged payments, attributed to `actorName: "Razorpay Bridge"` (no admin behind a webhook-originated write). Code-reviewed and proven to load correctly (see §4); not re-triggered by a fresh live purchase in this pass.

---

## 9. Security

- Teacher/Admin JWT secrets are cryptographically distinct (verified by hash comparison) — a token issued by one portal cannot be verified by another, independent of any role claim inside it.
- All `/api/internal/*` bridge endpoints on all three backends **verified live this session** to reject requests with a missing or wrong `X-Internal-Service-Key` with `401`, regardless of payload.
- All `/api/admin/*` protected routes verified to reject missing-auth and garbage-token requests with `401`.
- The Razorpay signature check remains `crypto.timingSafeEqual`-based on student/backend — bridged Admin payment rows are never client-asserted, they only exist because that check already passed.
- No dev-bypass headers, no demo-fill credentials, no plaintext-password-in-error-message anywhere in the current codebase (grepped clean this session).

---

## 10. What Was Actually Tested, Live, This Session

Every flow below was exercised against a real (local) MongoDB instance with all three backends and the admin frontend genuinely running — not simulated, not assumed from a prior report:

- Teacher creation → real temp password → real Teacher Portal login → **403-enforced** forced password-change gate → reset → old password dead, new password works, session properly revoked mid-flow.
- Course creation with a real image upload → approval → appears in the real public course catalog with correct price/image/features, image loads cross-origin with the correct header.
- Real bridged Razorpay payments visible in Admin's Payments page with correct source tagging.
- Real bridged assignment activity visible in Admin's Academics page, labeled as live/read-only.
- All `/api/internal/*` endpoints across all three backends reject bad/missing shared secrets.
- All new CSV report types (`courses`, `payments`, `enrollments`) return correct real data; `status`/`from`/`to` filters work correctly.
- New audit-log action types `teacher.provisioned` and `course.imageUploaded` confirmed present in a live audit export after triggering their real code paths.
- Overview dashboard and login page confirmed to render with zero fake/fallback/demo data.
- No dangling Classes/Batches/Subjects references anywhere in live source code.

**Not performed** (same honest gaps as Phase 1, unchanged by this phase):
- Load testing at scale — this codebase has never been load-tested at any phase; nothing here changes that assessment.
- `payment.bridged` audit entry not re-triggered by a fresh live Razorpay purchase in this specific pass (see §4/§8) — code-reviewed and proven-loaded, not independently re-fired.
- Real SMTP delivery — `SMTP_PASS` remains blank in every `.env` in this workspace; the credentials-email mechanism is genuinely real (`nodemailer`) and will start delivering the moment real SMTP credentials are supplied, but that supply is outside this session's control.

---

## 11. Known, Acknowledged Gaps (Not Hidden)

| Item | Status |
|---|---|
| Real SMTP credentials | Not supplied in any `.env` in this workspace; email mechanism is real, currently stubs to console/log |
| Teacher Portal read access to Admin's course catalog | Out of scope — teacher/backend has its own, separate curriculum concept; would need a second bridge direction |
| Lesson/module content editor for admin-authored courses | Not built — admin-published courses are purchasable but empty of lesson content; a real content-authoring system is a separate, larger feature |
| Stale `admin/frontend/dist/` build artifact | A pre-Phase-2 production build (dated before the Classes/Batches removal) still sits in `admin/frontend/dist/` — not served by the dev server and not part of the running app, but would need a fresh `npm run build` before any production deploy |
| Load testing at scale | Never performed at any phase of this project |
| `payment.bridged` audit entry | Code-reviewed and proven to load; not re-confirmed by a fresh live-triggered purchase in this pass |

---

## 12. Feature Status Summary

| Area | Status |
|---|---|
| Classes/Batches/Subjects | ✅ Fully removed, backend + frontend, verified clean |
| Teacher creation | ✅ Real temp password, real portal login, server-enforced forced reset — verified live end-to-end |
| Course creation & commerce | ✅ Real image upload, real price, verified live in the public catalog, purchasable |
| Payments | ✅ Real bridged Razorpay ledger, correctly source-tagged, verified live |
| Academic monitoring | ✅ Real bridged read-only data (assignments/quizzes/attendance), verified live |
| Dashboard | ✅ Zero fake/fallback data, verified live |
| Login page | ✅ No demo credentials, no autofill, verified live |
| CSV reports | ✅ 6 types (3 new), date/status filtering, verified live |
| Audit logging | ✅ 3 new action types added at real trigger points, 2 of 3 re-confirmed live |
| Internal bridge auth | ✅ All endpoints reject bad/missing shared secret, verified live |
| Cross-portal token isolation | ✅ Distinct JWT secrets per portal, verified |

---

## 13. Urgent Fix Pass — Teacher Credential Email + Course-to-Teacher Bridge

A follow-up session addressing two flows real testing found broken: teacher credential emails and admin-created courses not reaching the Teacher Portal. Audited first, per the request — neither turned out to be "rebuild from scratch"; one was a genuinely missing capability, the other a real wiring bug in already-written code.

### Part 1 — Teacher Credential Email

**Root cause**: NOT a code defect. `admin/backend/.env`'s `SMTP_HOST`/`SMTP_USER`/`SMTP_FROM` are correctly set to the project's real Gmail account (`nalandanexus@gmail.com`), but `SMTP_PASS` is blank. `services/email.service.js` builds a real `nodemailer` transporter (since `SMTP_HOST` is set) and genuinely attempts delivery — it does not silently stub. Verified live: creating a teacher produced `emailDeliveryStatus: "failed"` in ~2.2 seconds, with the exact server log `[email] Failed to send email: Missing credentials for "PLAIN"` — nodemailer's own pre-flight rejection of an empty password, before ever contacting Gmail. The temp-password generation, hashing, real Teacher Portal provisioning, and honest delivery-status tracking (`credentialEmailSent`/`credentialEmailSentAt`/`emailDeliveryStatus`) were all already correct from the prior session and needed no changes.

**Real gap found and fixed**: there was no way to resend credentials to an already-created teacher. The only existing "Resend" action (`resendInvite`) is dead code — it's gated on `status === 'INVITED'`, a status no teacher has received since teacher creation was switched to the direct temp-password flow (all teachers are created `ACTIVE`). If the original credential email failed and the admin missed the one-time fallback password shown at creation, there was no recovery path.

**Fix — real, database-backed, end-to-end**:
- `teacher/backend/src/services/auth.service.js`: new `resetCredentials({ email, newPassword })` — finds the existing `User`, sets a new `passwordHash`, forces `mustChangePassword = true`, bumps `tokenVersion` (immediately revokes any existing session, exactly like `changePassword`).
- `teacher/backend`: new internal endpoint `PATCH /api/internal/teachers/credentials` (shared-secret authenticated, same `requireInternalServiceKey` middleware as the existing provisioning endpoint).
- `admin/backend/src/services/teacherBridge.service.js`: new `resetTeacherCredentials()` calling the above — same honest-status contract as `provisionTeacherAccount` (never assumes success).
- `admin/backend/src/services/teacher.service.js`: new `resendCredentials(id, actor, req)` — generates a genuinely new random temp password (never reuses the old one), hashes and saves it to admin's own record, calls the reset bridge, sends a fresh credentials email via the same template used at creation, records a new `teacher.credentials.resent` audit action, blocks the action for `SUSPENDED` teachers.
- New route: `POST /api/admin/teachers/:id/resend-credentials`.
- Admin frontend: the existing "Resend Invitation" menu item's dead `INVITED`-only gate was left untouched (harmless, unreachable); a new **"Resend Credentials"** action was added to `TeacherTable.jsx` and `TeacherProfileDrawer.jsx`, visible for `ACTIVE` teachers, wired through `adminApi.resendCredentials()`. When the resend email itself can't be delivered, the new temporary password is shown in a dedicated, non-auto-dismissing modal (a 4-second toast is the wrong place for a one-time-visible credential) instead of being silently lost.

**Verified live, this session**: created a teacher (email correctly failed, real fallback password shown) → called Resend Credentials → got a genuinely different new temp password → confirmed the **old** temp password now returns `401 INVALID_CREDENTIALS` → confirmed the **new** one logs in with `mustChangePassword: true` intact → confirmed both `teacher.provisioned` and `teacher.credentials.resent` audit entries recorded.

**BLOCKED**: actual email delivery to a real inbox requires a real Gmail App Password in `SMTP_PASS`, which does not exist in this workspace. The mechanism is genuinely real and requires no further code changes — supplying that one credential is the only remaining step.

### Part 2 — Admin Course → Teacher Portal Visibility

**Root cause**: a real, confirmed gap, not a bug in existing code — no bridge of any kind existed pushing an admin-authored course to its assigned teacher's portal. The prior session's plan had explicitly scoped this out ("Teacher Portal access to admin courses... explicitly scoped out of this pass"). Admin's `Course.instructor` field was validated and stored correctly, but nothing ever told teacher/backend about the assignment.

**Fix — a new one-way bridge, following the same pattern already proven for the reverse (academics) direction**:
- `teacher/backend/src/models/AssignedCourse.js` (new): a lightweight, read-only mirror — NOT the same as the pre-existing `Course.js` model (which is a teacher-*authored* curriculum concept with `SchoolClass` links and full CRUD; merging the two would have given a teacher edit/delete rights over an admin-owned commerce record). Upserted by `sourceId` (admin's Course `_id`, string, no schema default — the same sparse-unique-index bug class fixed repeatedly elsewhere in this project).
- `teacher/backend`: new internal endpoints `PUT /api/internal/courses/:sourceId` (assign/update — resolves the teacher by email since admin and teacher/backend share no ObjectId space; a single upsert with the teacher field naturally handles reassignment) and `DELETE /api/internal/courses/:sourceId` (unassign).
- `teacher/backend`: new teacher-facing read endpoint `GET /api/teacher/courses/assigned`.
- `admin/backend/src/services/teacherBridge.service.js`: new `pushCourseAssignment()` / `removeCourseAssignment()`.
- `admin/backend/src/services/course.service.js`: hooked into `createCourse`, `updateCourse` (new/changed/removed instructor), `setCourseStatus` (so a teacher sees real governance status, not just approved courses), and `deleteCourse` (unassigns on archive). Also added the missing "assigned teacher must be ACTIVE" check the original spec called for (previously only checked existence + not-deleted).
- Teacher frontend `CoursesPage.jsx` (fully rewritten): added a new **"Assigned by Admin"** section — real data from the endpoint above, read-only (no edit/delete/purchase controls, matching "teacher accesses because assigned, never buys"), showing image/title/code/description/price/status. While rewriting this page, also wired the **"My Course Modules"** section to the teacher's own already-existing-but-never-connected `GET/POST /api/teacher/courses` backend, replacing a hardcoded 4-item fake course array — the same kind of fake-data issue the "no fake data audit" step of this task explicitly asks to check for, sitting in the exact file being touched.

**Two real bugs found and fixed during live verification** (both would have silently broken the feature):
1. `internal.controller.js`'s `upsertAssignedCourse` passed only `req.body` to `assignCourse()`, never merging in `req.params.sourceId` — every assignment was upserted with `sourceId: null`. Caught by inspecting the raw MongoDB document after the first live test, not assumed correct from the HTTP 200.
2. Teacher frontend's `socketService.js` forwards socket events through a hardcoded allowlist (a deliberate design already documented in that file) — `course.assigned`/`course.unassigned` were never added, so the server-side emit fired correctly (independently verified with a raw `socket.io-client` test against the real session cookie) but the browser app never received it. Fixed by adding both event names to the allowlist.

**Verified live, this session, in a real browser** (not just via curl): created a real teacher, created a real course with a real uploaded image and that teacher assigned, confirmed it appeared in `GET /api/teacher/courses/assigned`; approved the course and confirmed the status change reached the teacher; reassigned the course to a second real teacher and confirmed the first teacher's list went empty while the second's populated (single-row reassignment, not duplication); logged into the Teacher Portal as the assigned teacher and confirmed the "Assigned by Admin" card renders the real title/code/description/price/status with no fake data anywhere on the page; **with the browser tab open and no manual refresh**, updated the course price from the admin side via a direct API call and watched it change live in the teacher's tab (₹3,499 → ₹4,599); cleared the instructor and watched the card disappear live, replaced by the real empty state.

**Pre-existing bug fixed as a necessary side effect, unrelated to this task**: `teacher/frontend/src/data/teacherMockData.js` had a `const fullName`/`const email` reassigned inside conditional branches — a `TypeError: Assignment to constant variable` that crashed the *entire* teacher frontend app on load (before React even mounted), blocking any browser-based verification. Fixed by changing both to `let`. This file backs several other still-mock pages (Dashboard, Announcements, etc.) that are out of scope for this task and were left untouched otherwise — the Dashboard page in particular still throws its own unrelated errors from fake data structures, which is a real, separate, larger gap worth flagging but not fixed here.

**Not fixed / explicitly out of scope**: every teacher/frontend page other than `CoursesPage.jsx` and `ForcedPasswordResetPage.jsx` still runs entirely on `teacherMockData.js`/hardcoded arrays despite several having real, working backend endpoints already built (Dashboard, Announcements, Attendance, Classes, Exams, Grading, Messages, Resources, Students all import `teacherApiService` zero times as of this session). This is a large, pre-existing gap discovered while auditing for this task's specific scope — flagging it explicitly rather than silently expanding this "urgent fix" into a full rewrite nobody asked for in this pass.

### Database

New collection: `teacher/backend`'s `assignedcourses` (model `AssignedCourse`, sparse-unique on `sourceId`). No schema changes to existing collections beyond what Phase 2 already added.

### APIs Added

```
POST   /api/admin/teachers/:id/resend-credentials        (admin/backend)
PATCH  /api/internal/teachers/credentials                 (teacher/backend, internal)
PUT    /api/internal/courses/:sourceId                    (teacher/backend, internal)
DELETE /api/internal/courses/:sourceId                    (teacher/backend, internal)
GET    /api/teacher/courses/assigned                      (teacher/backend)
```

### Real-Time Events Added

`course.assigned`, `course.unassigned` — emitted to the specific teacher's socket room (`teacher:<id>`), forwarded through the frontend's existing event-allowlist pub/sub.

### Remaining Issues

| Item | Status |
|---|---|
| Real SMTP delivery (both initial and resent credentials) | **BLOCKED** — `SMTP_PASS` is blank in `admin/backend/.env`. Reason: no real Gmail App Password has been supplied in this workspace at any point in this project. Required action: generate a Gmail App Password for `nalandanexus@gmail.com` and set `SMTP_PASS` — no code changes needed. |
| Most teacher/frontend pages still run on mock data | **Resolved in a later session** — see `teacher/PHASE_5_FULL_INTEGRATION_REPORT.md`, which rewired every remaining teacher/frontend page to real backend data. |

---

## 14. Follow-Up Audit Pass — New Remaining/Known Issues Check

A fresh check across the whole Admin Portal (API-signature audit, a full page-by-page browser click-through, and live-triggered end-to-end tests of the highest-risk flows) run after the Teacher Portal's own equivalent pass. Findings:

**Previously-acknowledged gap closed, re-verified live**: §11's `payment.bridged` audit entry was "code-reviewed and proven to load; not re-confirmed by a fresh live-triggered purchase." This pass ran a real, signature-verified (HMAC-SHA256, mock-mode Razorpay keys — see `student/backend/.env`'s `PAYMENTS_MOCK_MODE`, which still exercises the real verification code path) course purchase end-to-end: registered a brand-new student, created a real order, completed real signature verification, and confirmed the payment appeared correctly in Admin's ledger — `source: "razorpay"`, real `razorpayOrderId`/`razorpayPaymentId`, correct amount (₹5,000, not a paise/rupee unit bug), a genuine `payment.bridged` audit entry (actor: "Razorpay Bridge"), and correctly reflected in the live Payments CSV export. This closes the gap; the mechanism is fully real, not just code-reviewed.

**One real defect found and fixed** — a stale, misleading UI label: Settings → Invitation Parameters → "Email Dispatch Channel" unconditionally read **"Console (dev mode, no SMTP configured)"** whenever `notifications.emailEnabled` was true, regardless of the platform's actual SMTP state. This was written before real SMTP integration existed (§3/§13) and never updated — by this point in the project SMTP genuinely *is* configured (`SMTP_HOST`/`SMTP_USER`/`SMTP_FROM` real, only `SMTP_PASS` blank) and the backend genuinely attempts real Gmail delivery via `nodemailer`, not a console stub. An admin reading this label would have been told the opposite of what the system actually does. **Fixed**: `settings.controller.js#get` now derives a real `smtpStatus` (`NOT_CONFIGURED` / `INCOMPLETE` / `CONFIGURED`) from `env.smtp.host`/`env.smtp.pass` at request time (not persisted — it reflects live env state, not an admin preference) instead of the schema; `AdminSettingsPage.jsx` renders one of three honest, color-coded states instead of the one hardcoded string. Live-verified: now correctly reads **"SMTP host set, SMTP_PASS missing — delivery will fail"**, matching the real, already-documented root cause from §13.

**Checked and confirmed NOT bugs**: the Token TTL input appearing blank in a text-only page read was a scraping-tool limitation (`<input>` values aren't exposed as text content) — confirmed via direct DOM inspection it correctly holds the real value (`24`); "Connected Admin Sessions" (Socket.IO live count) and the SSE telemetry stream's `connectedAdmins` field transiently disagreeing by one tick is expected (two independently-polled live snapshots using the identical, correct `io.sockets.sockets.size` computation, just fetched at slightly different instants) — not a bug; the legacy `INVITED`-status teacher record and its still-clickable "Resend Invitation" action (§13 called this "dead code") is real, working, non-broken legacy code — just unreachable for any *newly*-created teacher since teacher creation switched to the direct temp-password flow; left untouched as out of scope.

**Full regression re-verification after two backend restarts** (both `admin/backend` and, from the sibling Teacher Portal pass, `teacher/backend`/`student/backend`, all restarted against the same local test MongoDB to load fixes): re-ran the complete teacher-creation flow end-to-end — real temp password generated, real Teacher Portal account provisioned (`portalProvisioned: true`), honest email-failure status surfaced (`emailDeliveryStatus: "failed"`), and the real temp password successfully logged into the Teacher Portal with `mustChangePassword: true` correctly forced. Test teacher and test student cleaned up afterward.

Every other page (Students, Teachers, Courses, Academics — all 4 tabs, Analytics/System Health, Announcements, Reports, System Logs) was clicked through fresh with zero console errors and real, correctly-sourced data throughout, including live cross-portal bridged data (an assignment, a quiz, and a daily attendance tally created from the Teacher Portal, all correctly visible read-only in Admin's Academics page).

## 15. New Feature — Teacher-Announcement Ingestion (Teacher → Admin, first time this direction existed)

Built as part of a Teacher Portal feature request (full detail in `teacher/PHASE_5_FULL_INTEGRATION_REPORT.md` §22): a teacher publishing an announcement now bridges into Admin for the first time. New on this side: model `TeacherAnnouncement` (read-only mirror, sparse-unique `sourceId`), internal routes `POST/DELETE /api/internal/teacher-announcements`, service `announcement.service.js#ingestTeacherAnnouncement` (idempotent, calls the existing `notifyAllAdmins()` so every active admin gets a real Notification), a new admin-facing `GET /api/admin/announcements/teachers`, and a new **"From Teachers"** tab on `AnnouncementsPage.jsx` symmetric to Admin's own broadcast list. Live-verified in the real Admin browser UI: both the tab list and the notification bell/drawer correctly showed a real teacher-published announcement with accurate teacher name and class label.
