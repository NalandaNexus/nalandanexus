# Nalanda Nexus Teacher Portal — Backend Build & Frontend Integration Report

**Scope of this report:** turning the Teacher Portal from a static, hardcoded-mock-data React prototype into a real, MongoDB-backed, authenticated, authorized full-stack application. This covers the backend built from scratch, and the frontend rewired page-by-page to call it — with an honest accounting of what was verified, what wasn't (and why), and every gap that remains.

---

## 1. What changed, in one paragraph

The `teacher/frontend` folder existed; `teacher/backend` was an empty stub (a few hundred bytes across `package.json`, a placeholder `src/index.js`, and one stub route file). Every number, list, and interaction in the frontend came from a single 718KB, ~29,900-line `src/data/teacherMockData.js` file. That file has been deleted. In its place: a full Express + MongoDB backend (16 resource areas, ~120 source files) and a frontend where every page fetches real data, shows real loading/error/empty states, and writes real data back through forms that actually persist.

---

## 2. Architecture

**Backend** — Node.js (ES modules) + Express 4 + Mongoose 8, structured in strict layers:

```
routes/  → validators/ → controllers/ → services/ → models/
```

Routes wire `authenticate` → `requireRole('teacher')` → an `express-validator` chain → a thin controller. Controllers never touch MongoDB directly — they call a service function and send its result back in a standard envelope (`{ success, message, data, meta? }` on success; `{ success: false, message, error: { code, details? } }` on failure). Every service function that reads or writes a specific record starts by proving the requesting teacher owns it, and returns `404` — not `403` — when they don't, so a teacher can't tell the difference between "doesn't exist" and "not yours" by probing IDs.

**Frontend** — React 18 + React Router 7 + Tailwind, unchanged as a stack. What changed is that every page went from reading a static import to calling `teacherApiService` (a thin fetch wrapper around the REST API) inside `useEffect`, tracking `isLoading`/`error`/data state explicitly, and rendering three real states: a skeleton while loading, an `EmptyState` with a Retry button on error, and an honest empty state when a query legitimately returns nothing.

**Real-time** — Socket.IO, authenticated off the same `httpOnly` session cookie the REST API uses.

---

## 3. MongoDB collections

| Collection | Purpose |
|---|---|
| `User` | Auth identity — email, password hash, `tokenVersion` (for revocation), `avatarUrl` |
| `Teacher` | Professional profile linked 1:1 to a `User` — title, department, subject, preferences, Pro tier |
| `SchoolClass` | A class/batch a teacher runs (name, subject, grade, section, schedule, capacity) |
| `Student` | A student's roster entry, with cached `metrics` (currentScore, attendanceRate, engagementScore, riskLevel) recalculated after every write that could change them |
| `Concept` | A syllabus topic/domain (e.g. "Ray Optics") used to tag assignments and roll up mastery analytics |
| `Assignment` | A piece of work assigned to a class, optionally tagged with a `Concept` |
| `Submission` | One student's work against one assignment — status lifecycle `pending → submitted/late → graded`, or `missing` once the due date passes ungraded |
| `Attendance` | One (student, class, date) attendance record, unique-indexed to make re-marking idempotent |
| `ClassSession` | A scheduled/live/completed timetable slot — backs Calendar and Live Classes |
| `Exam` | A quiz/test/exam with a status lifecycle `draft → scheduled → active → completed` |
| `Course` | A course grouping, linked to one or more classes |
| `Resource` | An uploaded file (slide deck, worksheet, etc.) with a download counter |
| `Conversation` / `Message` | Teacher↔student messaging threads |
| `Notification` | Teacher-facing alerts (grading complete, attendance risk, new message), also pushed live |
| `AuditLog` | Append-only record of sensitive actions (profile changes, session cancellations, etc.) |

Every list/detail/analytics endpoint queries or aggregates these directly at request time. Nothing is pre-computed and frozen except the small set of cached `Student.metrics` fields, which are explicitly recalculated by `metrics.service.js` immediately after any write that could invalidate them (a grade, an attendance mark) — never left stale.

---

## 4. Authentication flow

1. `POST /auth/login` verifies email + bcrypt password hash, then sets the session token as an `httpOnly`, `sameSite` cookie — never returned in the JSON body, never touched by frontend JS.
2. Every subsequent request relies on that cookie (`credentials: 'include'`); a `Bearer` header also works as a fallback.
3. `authenticate` middleware re-loads the `User`/`Teacher` documents from the database on **every** request rather than trusting the JWT payload — a deactivated account or a bumped `tokenVersion` takes effect immediately.
4. `POST /auth/logout-all` bumps `tokenVersion`, invalidating every previously issued token for that account at once, with no server-side session store needed.
5. `POST /auth/change-password` (wired into the new Settings page) re-issues a fresh token after a successful change.

## 5. Authorization model

Role gating (`requireRole('teacher')`) on every teacher route, plus **ownership checks on every single read or write of a teacher-scoped record** — `assertClassOwnership`, `assertStudentOwnership`, etc. — implemented once per resource in its service file and called before any query touches that record. A request for another teacher's class, student, assignment, submission, exam, course, resource, or session returns `404`, indistinguishable from a non-existent ID, closing the usual IDOR hole where a `403` confirms the record exists.

---

## 6. API endpoints

16 resource groups, ~70 endpoints total. Full request/response shapes for every one are in `backend/API_DOCUMENTATION.md`. Groups: `Auth`, `Profile`, `Classes`, `Students`, `Assignments`, `Submissions`, `Attendance`, `Dashboard`, `Analytics`, `Notifications`, `Courses`, `Exams`, `Resources`, `Messages`, `Search`, and `Schedule` (new — see §7).

---

## 7. Frontend integration — page by page

| Page | Real data source | Notes |
|---|---|---|
| Dashboard | `GET /dashboard/overview` (single aggregate) | Page-level loading skeleton + error/retry gate added — previously child components would have crashed on `null` data |
| Classes | `GET/POST/PATCH /classes` | Create-class modal added; honors a `?classId=` deep link with scroll-to-highlight |
| Students | `GET /students` (paginated, debounced search) | Removed a duplicate drawer instance bug (see §12); honors `?sort=score-asc` |
| Attendance | `GET/POST /attendance` | Full roster fetch across pagination, per-student present/late/absent toggles, bulk save |
| Grading (Assignments) | `GET/POST/PATCH /assignments`, `PATCH /submissions/:id/grade` | Create-assignment modal honors `?createConceptId=` from the "reteach" flow |
| Exams | `GET/POST/PATCH/DELETE /exams` | Status-advancement button drives the real lifecycle |
| Grades | `GET /classes` | Per-class real averages/attendance; Export CSV disabled with a tooltip (no export endpoint exists) |
| Messages | `GET/POST /messages/conversations` | Real-time via `message.created`; added a "start new conversation" flow that didn't exist even as a mock |
| Resources | `GET/POST/DELETE /resources` | Real file upload/download with a download counter |
| Calendar | `GET/POST/DELETE /schedule` (new) | Date navigator, create/cancel session |
| Live Classes | `GET /schedule/live`, `GET /schedule` | 30s poll for "did a session go live" (no push event exists for this — see §9) |
| Reports | `GET /dashboard/overview` (reused) | Rebuilt from three fabricated numbers into three real ones plus a concept-mastery table; PDF export disabled with a tooltip |
| Settings | `GET/PATCH /profile`, `PATCH /profile/preferences`, `POST /profile/avatar`, `POST /auth/change-password` | Previously a fake "Save" button with a `setTimeout`; now four real, independently-saving sections |

Shared components built to support these: `Modal`/`FormField` (generic modal shell), `CreateSessionModal` (Calendar + Live Classes), `StudentPickerModal` (Messages), plus honest loading-skeleton and `EmptyState` treatments applied to every list/table in the app.

---

## 8. Mock data removed

- **`src/data/teacherMockData.js` — deleted entirely** (718KB, ~29,900 lines). Nothing in the frontend imports it anymore; this was confirmed by a repo-wide search before deletion and by a clean production build afterward.
- No `data || demoData`-style fallback exists anywhere — every page either shows the real value, a loading skeleton, or an explicit error/empty state.
- Specific fabricated numbers/UI that were removed rather than "made honest with a caveat": Reports' "74% Syllabus Coverage" (no curriculum/syllabus model exists in the schema at all — there was no honest number to put there, so the card is gone, not relabeled), "87.5% Attendance" and "+5% improvement" (now real, computed values), LiveClassPanel's fake "31 of 34 responded" / "On Question 3" / a "Push Challenge Problem" button that reported fake success, LiveSchedulePage's copy about "today's scheduled 4:00 PM lecture," GlobalSearchModal's hardcoded suggestion pills ("Rahul Sharma," "Priya Singh" — names that would never match a real roster), the dashboard's hardcoded "256 students in 8 classes" copy, AvgScoreModal's fixed "+5% this week" badge, and ConceptBreakdown's hardcoded default concept ("optics").
- Where a control's *backend capability* genuinely doesn't exist yet (CSV/PDF export, course-scoped diagnostics), the control is kept visible but disabled with an explanatory tooltip, rather than silently removed or left clickable-but-broken.

---

## 9. Real-time features (Socket.IO)

The backend emits exactly three events, verified by grepping every `emitToTeacher`/`emitToClass` call site in the service layer: `score:update` (after a submission is graded), `notification.created` (whenever any notification is created), `message.created` (when a message is sent). The frontend's socket listener whitelist previously listed two events the backend never sends and was **missing** `message.created` entirely — fixed (see §12).

Deliberately **not** real-time: whether a class session has just gone live. There's no code path that emits such an event, so rather than fake it, the Live Classes page polls `GET /schedule/live` every 30 seconds. This is documented in both `README.md` and the code comment at the poll site, not left as an unexplained design choice.

---

## 10. Database verification — what was and wasn't possible here

**No MongoDB instance is reachable in this sandbox**, so nothing here was verified against live data, and that limitation is not being hidden. What *was* verified without one:

- Every backend source file passes `node --check`; the full module graph (server → every model/service/controller/route/socket setup) was actually executed with `node`, not just read — this caught and fixed a real startup-crashing bug (`cookie` package's ESM default-export mismatch) before this document was written.
- `npm run test:smoke` boots the real Express app and confirms routing, auth gating (401 before any DB touch), and request validation (422 before reaching a controller) all work — 16/16 checks passing.
- A full production frontend build (`npm run build`) — 2550 modules, no errors.
- Every model field referenced anywhere in services/controllers/seed was manually cross-checked against its Mongoose schema.
- A manual, file-by-file read of every service for ownership/IDOR correctness (see §12 for what that surfaced).

**What genuinely was not verified** and needs a real database to confirm: login success and the full cookie round-trip in a real browser, any query or aggregation actually executing against live data, Socket.IO events actually arriving at a connected client, and file upload success end-to-end.

**How to verify it yourself:** start MongoDB (local `mongod`, or point `MONGODB_URI` in `backend/.env` at Atlas) → `npm run seed` (creates a demo teacher, 8 classes, 256 students, and realistic history — every seeded number is run back through the same recalculation logic the live app uses, not written pre-computed) → `npm run dev` → log in from the actual frontend → open MongoDB Compass against that same `MONGODB_URI` and watch documents change as you use the app. `dropDatabase()` was never called anywhere in this work, seed or otherwise.

---

## 11. Testing performed

- Backend wiring smoke test: 16/16 passing (health check, 404 handling, security headers, CORS, auth gating on every resource including the new `/schedule` group, request validation ordering).
- Frontend production build: clean, 2550 modules transformed, only a benign chunk-size advisory (no errors).
- Manual code review pass across every service (backend) and every page (frontend) for correctness, ownership checks, and consistency with the rest of the codebase's conventions.
- **Not performed:** an end-to-end teacher journey (log in → create a class → enroll students → grade an assignment → see the dashboard update) against a live database, since none was available here. This is the single most important remaining verification step and is squarely a "run it yourself" item, not something skipped by choice.

---

## 12. Bugs found and fixed along the way

Backend (surfaced by static review + actually executing the module graph):

1. `sockets/index.js` imported `cookie` as a default export — the installed version has none, so this crashed the server at startup. Fixed.
2. `assignment.service.js` compared a submission's "missing" status against a field (`submission.dueDate`) that doesn't exist on that model, mislabeling nearly every ungraded submission "missing" regardless of the real due date. Fixed to use the parent assignment's due date.
3. `course.service.js` let a course be linked to another teacher's classes with no ownership check, and computed student-count/completion-rate from those classes regardless — a real cross-tenant data leak. Fixed.
4. `exam.service.js`/`resource.service.js` — hardened with the same ownership-check + explicit field-whitelist treatment for consistency.
5. `message.routes.js` — `POST /messages/conversations` had no validator for `studentId`. Fixed.
6. `resource.service.js` — deleting a resource removed the DB record but left the actual file on disk, still downloadable at its old URL forever. Fixed.
7. `assignment.service.js#updateAssignment` (found during frontend wiring) used an unchecked `Object.assign` instead of a field whitelist, the same bug class as #3/#4. Fixed.
8. `analytics.service.js#getConceptPerformance` (found during frontend wiring) stripped the real MongoDB `_id` off every concept row, keeping only a human-readable key — any flow trying to create an assignment "for" that concept would fail validation. Fixed to expose both; traced the same wrong-field bug into `dashboard.service.js`'s recommended-actions builder and fixed it there too.

Frontend (surfaced during wiring):

9. `socketService.js`'s event whitelist listed two events the backend never sends and was missing `message.created`, the one it actually does — Messages' live-update behavior would have silently never worked. Fixed.
10. Both the Dashboard and Students pages independently rendered their own instance of the student drill-down drawer, instead of sharing the one lifted into the shared layout — clicking a student from one could desync from the other. Fixed by routing both through `useOutletContext()`.
11. `PendingTasks.jsx` seeded its list from `useState(initialTasks)`, which only applies once on mount — a live-refetched task list would never actually update on screen after first load. Fixed.
12. `ClassHealthTable.jsx` had a fallback `navigate()` call to a route (`/classes/:id`) that doesn't exist in the router, which would have silently redirected to the dashboard. Fixed to the real route plus a query param, and `ClassesPage` was given the handler for it.
13. `LiveClassPanel`'s own honest "no live class" empty state was unreachable because `DashboardPage` only rendered the component at all when a class was already live. Fixed by always rendering it and letting the component's own state decide.

---

## 13. Known, documented gaps (not bugs — real product limitations)

- **Live in-class polling** (response rate, per-question correctness, early finishers) has no feature behind it anywhere in the original frontend or backend — `liveClassState`'s five polling fields are always `null`/empty rather than fabricated, on both the Dashboard's live panel and the new Live Classes page.
- **No CSV/PDF export** exists anywhere in the backend. The Gradebook and Reports pages' export buttons are visibly present but disabled, with a tooltip explaining why, rather than faking a download.
- **No course-scoped analytics** — concept mastery and score breakdowns are teacher-wide only. The Courses page's "View Diagnostics" button reflects that honestly (disabled + tooltip) instead of linking to a breakdown that doesn't actually filter by course.
- **Leaderboard has no explicit `rank` field** — the frontend derives it from array position, as it already did against the old mock array.
- **"A session just went live" has no push event** — the Live Classes page polls every 30 seconds instead (see §9).
- **Theme preference** (`dark`/`light`) is a real, persisted field on the Teacher's preferences, but the entire UI is hardcoded to one dark palette with no light-mode stylesheet — the Settings page shows this control disabled with a tooltip rather than implying it does something it can't.
- **Phase 7 (full end-to-end teacher journey against a live database) was not performed** — see §11. This is the top item to do next.

---

## 14. Delivery

Two archives were sent in this conversation and also written directly to your machine:

- `C:\Users\adars\Downloads\Nalanda\teacher\backend\` — the complete new backend (`.env` was **not** included or overwritten; only `.env.example`).
- `C:\Users\adars\Downloads\Nalanda\teacher\frontend\` — the fully rewired frontend source (`node_modules/` and the old `dist/` build were left untouched).

A few files couldn't be cleanly deleted by this tooling (only overwritten), so they were moved rather than left in place: the old 718KB `teacherMockData.js` and the backend's original stub `src/index.js` (superseded by `src/server.js`/`src/app.js`), plus the delivery archives themselves and their temp-extraction folders. All of it is sitting in `C:\Users\adars\Downloads\Nalanda\teacher\_to_delete\` — safe to delete whenever you like.

**To run it:** in `backend/`, copy `.env.example` to `.env`, set a real `JWT_SECRET` and `MONGODB_URI`, `npm install`, then `npm run seed` and `npm run dev`. The frontend's existing `node_modules` should still work as-is (no new dependencies were added), so `npm run dev` there should just work; run `npm install` first only if you see a missing-module error.
