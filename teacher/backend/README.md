# Nalanda Faculty & Teacher Portal — Backend API

Express.js + MongoDB/Mongoose REST API service supporting the Nalanda Teacher & Faculty Web Application. It is one of three independent portal backends in the Nalanda Nexus monorepo (student / teacher / admin), each with its own database and its own Express app — this service only ever authenticates **teacher** accounts.

Every number and record this API returns is computed from real MongoDB data at request time (or cached and explicitly recalculated right after the write that could change it — see "Cached metrics" below). There is no seeded-then-frozen demo data baked into the API layer itself; the only place synthetic data is generated is the optional dev seed script described below.

## Tech stack

- Node.js (ES modules) + Express 4
- MongoDB + Mongoose 8
- JWT session tokens carried in an `httpOnly` cookie
- Socket.IO for real-time score/leaderboard/notification/message push
- Multer for local-disk file uploads (avatars, resources, assignment attachments)
- helmet, express-rate-limit, express-mongo-sanitize, express-validator for hardening/validation

## Prerequisites

- Node.js 18+
- A running MongoDB instance — either local (`mongod` on `127.0.0.1:27017`) or a connection string to MongoDB Atlas / any hosted MongoDB

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```
   At minimum, set a real `JWT_SECRET` and point `MONGODB_URI` at your database. See the comments in `.env.example` for every variable. In development, a missing `JWT_SECRET` falls back to an insecure dev-only value with a console warning rather than crashing — **this fallback is refused outright in production** (`assertEnv()` in `src/config/env.js` throws if `NODE_ENV=production` and `JWT_SECRET` is unset).

3. Seed a demo teacher account (optional, but recommended for first run — the app has no self-serve signup, so you need at least one account to log in with):
   ```bash
   npm run seed
   ```
   This creates one teacher (`rajesh@nalanda.edu` / `Faculty@Nalanda2026!` by default — override via `SEED_TEACHER_EMAIL` / `SEED_TEACHER_PASSWORD`), 8 classes, 256 students, assignments with submissions, two weeks of attendance history, today's class schedule (with one session live right now), courses, exams, resources, a sample conversation, and a couple of notifications. Every score/risk-level/attendance-rate you'll see afterward is computed by the same `metrics.service.js` the live app uses — the seed script generates raw submissions/attendance and runs them through real recalculation, it does not write pre-computed numbers directly. Re-running `npm run seed` is a no-op if that teacher already has data; pass `--reset` to wipe and regenerate: `npm run seed -- --reset`.

4. Run the development server:
   ```bash
   npm run dev
   ```
   The API listens on `PORT` (default `5002`) and expects the frontend at `CLIENT_URL` (default `http://localhost:5174`) for CORS.

## Available scripts

| Script | What it does |
|---|---|
| `npm start` | Runs the server once with plain `node` (production-style). |
| `npm run dev` | Runs the server with `nodemon` (auto-restart on file changes). |
| `npm run seed` | Populates one demo teacher account with realistic data (see above). |
| `npm run seed -- --reset` | Wipes that demo teacher's data first, then reseeds. |
| `npm run test:smoke` | Boots the real Express app (no DB connection) and checks that routing, auth gating, request validation, and error handling are wired correctly. See "Verification performed" below for exactly what this does and doesn't prove. |

## Project structure

```
src/
  config/       env.js (env var loading/validation), db.js (Mongoose connection)
  models/       one Mongoose schema per collection (see API_DOCUMENTATION.md for the list)
  middleware/   auth.js, errorHandler.js, rateLimiter.js, validate.js, upload.js
  validators/   express-validator chains, one file per resource
  services/     all business logic and database access — controllers never touch a model directly
  controllers/  thin HTTP glue: parse req -> call a service -> send a response
  routes/       route -> middleware -> validator -> controller wiring, one file per resource
  sockets/      Socket.IO server setup + auth + emit helpers
  jobs/         in-process background jobs (announcement scheduling sweep)
  seed/         dev seed script + wiring smoke test
  app.js        Express app assembly (no DB/socket/listen side effects — safe to import for tests)
  server.js     the actual entrypoint: connects to MongoDB, starts Socket.IO, starts listening
uploads/        local-disk file storage for avatars/resources/assignments (served at /uploads/*)
```

**Layering rule this codebase follows throughout:** routes wire `authenticate` → `requireRole('teacher')` → validators → controller; controllers never query MongoDB directly, they call a service; every service function that reads or writes a specific record starts by proving the requesting teacher owns it (`assertXOwnership`, returning 404 — not 403 — for someone else's record, so IDs can't be used to probe what exists).

## Auth flow

1. `POST /api/teacher/auth/login` verifies email + password (bcrypt), then sets the session token as an `httpOnly`, `sameSite` cookie (`nalanda_teacher_token` by default) — never returned in the JSON body, never meant to be stored in `localStorage`.
2. Every subsequent request must be made with `credentials: 'include'` so the browser attaches that cookie. A `Bearer` token in the `Authorization` header also works, as a fallback for server-to-server calls or API testing tools.
3. `authenticate` middleware re-loads the User (and Teacher, for role `teacher`) document from the database on **every** request — it never trusts the JWT payload for anything beyond identity — so a deactivated account or a bumped `tokenVersion` takes effect immediately, not just after the token naturally expires.
4. Logging out of one session clears that cookie; `POST /api/teacher/auth/logout-all` bumps `tokenVersion`, which invalidates every previously issued token for that account at once (no server-side session store needed).

## Real-time (Socket.IO)

The Socket.IO server authenticates each handshake by parsing the same `httpOnly` cookie the REST API uses, so the frontend's existing `socketService.connect()` call works without changes. It emits:

- `score:update` — after a submission is graded, to the affected class's room
- `notification.created` — whenever a notification is created for a teacher (grading-complete, attendance alerts, new message, etc.)
- `message.created` — when a teacher sends a message (reflects it back to their own connected clients)
- `announcement:published` / `announcement:expired` / `announcement:deleted` — announcement/event/convocation lifecycle changes, to the publishing teacher's own room and to every targeted class's room (see "Announcements" in `API_DOCUMENTATION.md`)

A connection with no valid session is still accepted (so the socket can connect before login completes) but is not joined to any teacher/class room until it authenticates.

There is deliberately no `session.went_live` (or similar) push event — no code path emits one. The frontend's Live Classes page (`GET /schedule/live`) polls on a 30s timer instead of pretending to be real-time here; see "Known product gaps" below.

## Background jobs

`src/jobs/announcementScheduler.job.js` runs a 60-second in-process sweep (started from `server.js`, stopped on graceful shutdown) that publishes scheduled announcements and expires published ones purely from timestamps stored in MongoDB — not dependent on any client connection. See the "Server-side scheduled publishing" note in `API_DOCUMENTATION.md`'s Announcements section for the scaling caveat (per-process, fine at this project's scale).

## Cross-portal announcement delivery

This backend has no student-authenticated accounts (see `src/models/User.js`'s scope note), so a published announcement reaching actual students happens via `src/services/studentBridge.service.js` — an authenticated (shared-secret) HTTP call to the separate student backend, which persists and pushes it over its own Socket.IO server. Configured by `STUDENT_BACKEND_URL` / `STUDENT_BACKEND_SERVICE_KEY`; best-effort and a documented no-op if unset. See the "Real-time delivery" note under Announcements in `API_DOCUMENTATION.md` for the full flow and its one real limitation (broadcast-only — no per-class filtering on the student side).

## Database isolation

`MONGODB_URI` **must** include an explicit database name in its path (`/nalanda_teacher`). This cluster is shared with the student and admin backends; omitting the db name makes the driver default to a database literally named `test`, which this backend and the student backend were both silently landing in until this was caught and fixed. Never remove that path segment.

## File uploads

Avatars, resources, and assignment attachments are stored on local disk under `uploads/<kind>/` and served back at `/uploads/<kind>/<filename>`. Each upload kind has its own MIME allowlist and a size limit (`MAX_UPLOAD_MB`, default 10MB) — see `src/middleware/upload.js`. If cloud object storage is ever wired up, only that file and the stored `fileUrl` values need to change; nothing else references the filesystem directly.

## Security measures

- Passwords hashed with bcrypt (cost factor 12), never logged or returned
- JWT in an `httpOnly` cookie (not readable by frontend JS), `sameSite` + `secure` in production
- `tokenVersion` for immediate, stateless session revocation
- Ownership checks on every read/write of a teacher-scoped record, returning 404 (not 403) for another teacher's data
- `express-mongo-sanitize` strips `$`/`.`-prefixed keys from `req.body`/`query`/`params` to block operator injection
- `express-validator` on every write endpoint; malformed ObjectIds in URL params are rejected before touching the database
- `helmet` default header set; general + auth-specific rate limiting (`express-rate-limit`)
- Centralized error handler normalizes every error (thrown `ApiError`s, Mongoose validation/cast errors, duplicate-key errors, malformed JSON, Multer errors, JWT errors) into one consistent envelope and never leaks a stack trace to the client

## Verification performed — and not performed

Being direct about this rather than implying more than is true:

**What was verified**, without a live MongoDB (none was reachable in the environment this backend was built in — see below):
- Every source file passes `node --check` (syntax validity).
- The full module graph loads cleanly: `src/server.js` (and, transitively through it, every model, service, controller, route, and the Socket.IO setup) was actually executed with `node`, not just statically read. This caught and fixed a real bug — the `cookie` package's ESM build has no default export, which was crashing the entire app at startup — before this document was written.
- `npm run test:smoke` boots the real Express app and exercises everything in the request pipeline that must resolve *before* a database call happens: the health check, 404 handling, helmet headers, CORS, and — most importantly — that protected routes (including `/schedule`, added during frontend integration) reject unauthenticated/invalid-token requests (401) and that bad request bodies are rejected by validation (422) *before* reaching a controller. All 16 checks pass.
- With `server.js` run directly against no MongoDB, the connection-retry-with-backoff logic and graceful shutdown (`SIGTERM`/`SIGINT`) were both observed working as designed.
- Every model field referenced by the seed script, services, and controllers was manually cross-checked against the corresponding Mongoose schema for name/type agreement.
- A manual, file-by-file read of every service for logic correctness and IDOR safety, which surfaced and fixed several real issues before delivery — see the "Issues found and fixed during review" list below.

**What was not verified**, and needs to be done by you against a real MongoDB before this is considered production-ready:
- Actually running `npm run seed` and confirming the data it produces looks right end-to-end.
- Any real read/write/aggregation query executing successfully against live data (query *shapes* were reviewed carefully, but MongoDB can still reject a query the driver accepts syntactically, e.g. an index that doesn't exist yet, or an aggregation edge case only live data would surface).
- Login success and the full cookie round-trip in a real browser.
- Socket.IO events actually arriving at a connected frontend client.
- File upload success end-to-end (multer wiring was reviewed, not exercised with a real multipart request).
- Load/performance characteristics of any query or aggregation.

**Recommended next steps, in order:** start MongoDB (local `mongod`, or point `MONGODB_URI` at Atlas) → `npm run seed` → `npm run dev` → log in as the seeded teacher from the actual frontend → open MongoDB Compass against the same `MONGODB_URI` and spot-check that documents in each collection look right as you use the app → work through the frontend's screens one by one.

### Issues found and fixed during review

These were caught by actually running the app and by a manual read-through of every service, not by a live database test (none was available) — listed here rather than silently fixed, per the standing instruction to surface everything found:

1. **`src/sockets/index.js` — app-breaking.** Imported `cookie` as a default export; the installed `cookie` v2 has no default export under ESM, so this threw at module load and would have prevented the entire server from starting. Fixed to use the named `parseCookie` export.
2. **`src/services/assignment.service.js` — wrong data shown.** `listSubmissionsForAssignment` computed a submission's "missing" status by comparing against `submission.dueDate`, a field that doesn't exist on the `Submission` model (only `Assignment` has a `dueDate`). In practice this always evaluated true, so every not-yet-graded submission was mislabeled "missing" regardless of whether the actual due date had passed. Fixed to compare against the parent assignment's real `dueDate`.
3. **`src/services/course.service.js` — cross-tenant data leak.** `createCourse` linked a course to whatever `classIds` were posted with no check that the requesting teacher owns those classes; `shapeCourse()`'s student-count/completion-rate aggregates don't themselves filter by teacher, so a course could be made to display another teacher's real roster size and completion rate. Fixed by validating ownership of every `classId` before saving, and by switching `updateCourse` from a blind `Object.assign` to an explicit field whitelist (it was accidentally safe before only because of a field-name mismatch between the API and the schema — not something to rely on).
4. **`src/services/exam.service.js` / `src/services/resource.service.js` — hardening.** Applied the same explicit-whitelist / ownership-check treatment for consistency, even though the exam one was already safe by the same accidental field-name mismatch and the resource one had no current endpoint that could exploit it.
5. **`src/routes/message.routes.js` — missing validation.** `POST /messages/conversations` had no validator for `studentId`, so a missing value would have reached `Student.findOne({ _id: undefined, ... })` and depended on MongoDB driver behavior for an `undefined` filter value instead of failing predictably. Added an explicit validator, matching every other "create" route in this API.
6. **`src/routes/index.js` — documented, not changed.** `teacher.routes.js` is mounted at the bare `/` prefix and applies its `authenticate` gate to every path under it, which means an unauthenticated request to an unrecognized `/api/teacher/*` route returns 401 rather than 404 (auth is checked before route existence). This is a side effect of the mount order, not a deliberate design — but it's fail-safe (no anonymous route probing), so it was left as-is and documented in code plus pinned by a smoke-test case rather than "fixed."
7. **`src/services/resource.service.js` — deleted files stayed downloadable.** `deleteResource` removed the database record but never removed the file from `uploads/resources/`, which is served statically — so a "deleted" resource's file remained reachable forever at its original URL. Fixed to also remove the file from disk (best-effort: a file that's already missing doesn't fail the delete).

The following were found and fixed during Phase 4 (wiring the frontend to these APIs — connecting real pages surfaced a few issues static review of the backend alone hadn't):

8. **`src/services/assignment.service.js` — unsafe field assignment.** `updateAssignment` used `Object.assign(assignment, updates)` on the raw request body instead of a whitelist, the same class of bug already fixed in `course.service.js`/`exam.service.js` (#3/#4 above) — a client could set any field on the document, not just the ones `PATCH /assignments/:id` is documented to accept. Fixed to the same explicit-whitelist pattern (`title, dueDate, description, instructions, maxScore, status`).
9. **`src/services/analytics.service.js` — real ID silently stripped.** `getConceptPerformance` returned each concept's human-readable `id` key (e.g. `"optics"`, used for UI selection) but discarded the actual Mongo `_id` entirely. Any frontend flow that tried to pass that `id` on to `POST /assignments`'s `conceptId` field (which validates it as a real ObjectId) would fail with `422`. Fixed to expose both: `id` (key) and `conceptId` (real ObjectId) — see the updated `GET /analytics/concepts` entry in `API_DOCUMENTATION.md`.
10. **`src/services/dashboard.service.js` — same ID confusion, one level up.** `getRecommendedActions`'s "reteach" action used `worstConcept.id` (the key) as if it were the ObjectId `conceptId` a downstream "create assignment" flow needs. Fixed to `worstConcept.conceptId`, once that field existed (see #9).

`src/routes/schedule.routes.js`, `src/controllers/schedule.controller.js`, and `src/validators/schedule.validators.js` are also new in Phase 4 — `src/services/schedule.service.js` already existed (used internally by the dashboard overview) but had no REST surface of its own, so the Calendar and Live Classes frontend pages had nothing real to call. This isn't a bug fix, it's a gap that was in-scope to fill: the `ClassSession` model and the schedule-computation logic were already real, just not exposed as CRUD endpoints. See the new "Schedule" section in `API_DOCUMENTATION.md`.

## Known product gaps (not backend bugs — documented so they aren't mistaken for oversights)

- **Live-class in-session polling** (`LiveClassPanel`'s per-question response rate, correct/wrong split, early finishers): there is no live-quiz/response-capture feature anywhere in the frontend or the original backend this was built from, so `GET /api/teacher/dashboard/overview`'s `liveClassState` returns real, honest values for everything derivable from actual records (whether a class is live right now, its roster size, today's attendance-based "active students" count) and `null`/empty for the in-session polling fields rather than inventing a feature that doesn't exist elsewhere in the product. See `src/services/schedule.service.js#getActiveLiveSession`.
- **Class leaderboard rank**: `GET /api/teacher/classes/:id/leaderboard` returns students pre-sorted by the requested metric; it does not add an explicit `rank` field, so the frontend should derive rank from array position (`index + 1`) as it likely already does against the old mock data's array order.
- **No report/audit export** (CSV or PDF): there is no export endpoint anywhere in this API. The Gradebook and Reports pages' "Export" buttons are shown disabled with an explanatory tooltip in the frontend rather than wired to a fake download or silently removed.
- **No course-level analytics**: `GET /analytics/concepts` and `GET /analytics/avg-score-breakdown` are computed across a teacher's *entire* active roster, not scoped to a single course or class. The Courses page's "View Diagnostics" button is shown disabled with a tooltip for the same reason, rather than pointing at a breakdown that doesn't actually filter by course.
- **"Session just went live" has no push event**: see "Real-time (Socket.IO)" above — the frontend polls `GET /schedule/live` every 30s instead.

See `API_DOCUMENTATION.md` for the full endpoint reference.
