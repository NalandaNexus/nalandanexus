# Nalanda Student Portal — Backend API

Express + MongoDB (Mongoose) + JWT auth + Razorpay payments REST API powering the
Nalanda Nexus student frontend. Replaces the old mock/localStorage-only data layer
with a real, persistent, authenticated backend.

## Stack

- Node.js + Express (ESM / `"type": "module"`, matching the existing repo)
- MongoDB + Mongoose
- JWT access + refresh tokens (httpOnly cookies + Bearer header support), bcrypt password hashing
- Zod request validation
- Razorpay for course payments (order creation + signature verification)
- Socket.IO for leaderboard/notification pushes (no live per-click activity tracking — see below)
- helmet, cors, express-rate-limit, express-mongo-sanitize for hardening

> **Architecture note:** the original master spec called for TypeScript. This backend
> deliberately stays in modern ESM JavaScript to match the existing `student/backend`
> skeleton (which was already plain JS with `"type": "module"`), avoiding an extra build
> step while keeping the same layered structure (config/models/controllers/services/
> routes/middleware/validators/utils/sockets) the spec asked for. See the final
> integration report for the full list of architecture decisions.

## Getting started

```bash
cd student/backend
npm install
cp .env.example .env
# edit .env: set MONGODB_URI, JWT secrets, Razorpay keys (or PAYMENTS_MOCK_MODE=true for local dev)
npm run seed   # populates the course catalog, tasks, and quizzes
npm run dev    # http://localhost:5001
```

MongoDB Compass can connect directly to the same `MONGODB_URI` to inspect the
`nalanda_nexus` database — collections are created lazily on first write, so run the
app (or the seed script) once before expecting to see them in Compass.

## Environment variables

See `.env.example`. Never commit a real `.env` file. The frontend never receives any
of these values (`MONGODB_URI`, `JWT_*_SECRET`, `RAZORPAY_KEY_SECRET`, etc.) — the
only Razorpay value sent to the browser is the public `RAZORPAY_KEY_ID` (or a mock
placeholder), returned from `POST /api/payments/orders`.

## Testing without real Razorpay keys

Set `PAYMENTS_MOCK_MODE=true` (also implied automatically when `NODE_ENV=test`).
Order creation returns a deterministic fake `razorpay_order_id` instead of calling the
Razorpay API, and signature verification uses a fixed mock secret instead of your real
`RAZORPAY_KEY_SECRET`, so `npm test` can exercise the full purchase → enrollment flow
with no network access to Razorpay. Switch it off (and set real keys) before going live.

## API surface

All responses use the envelope `{ success, data, message }` or `{ success: false, error: { code, message } }`.

### Auth — `/api/auth`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | none | Create a student account + profile, auto-login |
| POST | `/login` | none | Email + password login |
| POST | `/refresh` | refresh cookie | Rotate access/refresh tokens |
| POST | `/logout` | none | Revoke the current refresh token |
| GET | `/me` | access token | Current user + student profile |
| POST | `/forgot-password` | none | Issue a one-time reset token (emailed; enumeration-safe response) |
| POST | `/reset-password` | none | Consume the reset token, set new password, revoke all sessions |
| POST | `/google` | none | Google Identity Services ID token -> verified server-side -> login or first-time account creation/linking |

### Public — `/api/public`
| Method | Path | Purpose |
|---|---|---|
| GET | `/courses` | Course catalog (purchasable + upcoming) |
| GET | `/courses/:slug` | Course detail (video URLs hidden unless enrolled) |
| POST | `/contact` | Landing page contact form |

### Payments (Razorpay) — `/api/payments` (student only)
| Method | Path | Purpose |
|---|---|---|
| POST | `/orders` | Create a Razorpay order for a course (price is server-resolved) |
| POST | `/verify` | Verify Razorpay signature → mark order paid → create Enrollment |
| GET | `/orders/:orderId` | Order status |
| POST | `/webhook` | Razorpay server-to-server webhook (defense in depth) |

### Student — `/api/student` (student only)
| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/profile` | View/update own profile (role/xp/level are backend-only) |
| POST | `/onboarding/complete` | Mark first-login onboarding done |
| GET | `/dashboard` | Consolidated dashboard payload |
| GET | `/notifications`, PATCH `/notifications/:id/read`, `/notifications/read-all` | Notifications |
| GET/POST/PATCH/DELETE | `/notes` | Personal notes |
| GET/POST | `/messages` | Persisted student<->mentor message thread |
| GET/POST | `/community/posts`, POST `/community/posts/:id/like` | Community feed (paginated) |
| GET | `/live-classes` | Upcoming + recorded live sessions |
| GET/POST | `/support-tickets` | Help & support requests |
| GET/PATCH | `/announcements`, `/announcements/:id/read` | Institute announcements with per-user read state |

### Courses / Learning — `/api/student/courses` (student only, enrollment-gated)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | My enrolled courses |
| GET | `/:slug/content` | Full syllabus incl. video URLs — requires active enrollment |
| POST | `/lessons/:lessonId/progress` | Mark a lesson complete, awards XP once |

### Tasks — `/api/student/tasks` (student only, enrollment-gated)
`GET /`, `GET /:taskId`, `POST /:taskId/submit`

### Quizzes — `/api/student/quizzes` (student only, enrollment-gated)
`GET /`, `GET /:quizId` (no correct answers included), `POST /:quizId/submit` (backend grades, awards XP once)

### Admin/teacher content authoring — `/api/admin` (role: `teacher`, `admin`, or `super_admin`)
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/announcements` | List all (incl. unpublished) / publish a new announcement (also pushes `announcement.created` in real time) |
| PATCH/DELETE | `/announcements/:id` | Edit / remove an announcement |
| GET/POST | `/live-classes` | List all / schedule a live class |
| PATCH/DELETE | `/live-classes/:id` | Edit / remove a live class |

No self-service admin signup exists (`registerStudent` always creates `role: 'student'`); `npm run seed` creates a
dev-only admin account (`admin@nalanda.test` / `AdminPass123!`, non-production only) so these routes are reachable
without hand-editing the database.

### Internal service bridge — `/api/internal` (shared secret, not a user session)

Lets the **teacher backend** (a separate service/database — see its README's "one of three independent portal
backends" note, now actually true after both were fixed to stop defaulting to a shared `test` database) deliver a
published announcement here, so it reaches students the same way a native admin-authored one does. A teacher has no
login in this database, so these routes are authenticated by `X-Internal-Service-Key` matching `INTERNAL_SERVICE_KEY`
(see `middleware/internalService.js`), not a JWT — and are unreachable by any student/teacher/admin session.

| Method | Path | Purpose |
|---|---|---|
| POST | `/announcements` | Deliver a bridged announcement (idempotent on `sourceId` — the teacher portal's own Announcement `_id`) |
| PATCH | `/announcements/:sourceId` | Update a previously-bridged announcement |
| DELETE | `/announcements/:sourceId` | Retract one (teacher archived/deleted the source) — idempotent |

Delivered announcements are visually identical to native ones (`GET /api/student/announcements`, `announcement.created`
socket push) except `author` is taken from `externalAuthorName` (no local `User` to reference) and `source`/`sourceId`
are set for traceability. **Known constraint, not fixed here:** this model has no per-class/course audience — every
bridged announcement reaches *all* connected students regardless of which classes the teacher targeted, because this
portal has no class/roster concept to filter by (`StudentProfile` carries only free-text `grade`/`board`/`school`).

### Leaderboard — `/api/leaderboard?period=thisWeek|thisMonth|allTime`

## Real-time (Socket.IO)

Clients connect with a JWT access token in `socket.handshake.auth.token`; each connection joins a
private `user:<id>` room (see `src/sockets/index.js`). Events:

| Event | Emitted from | Scope | Purpose |
|---|---|---|---|
| `notification.created` | `xp.service.awardXp` | Per-user | New notification (points/streak/course) pushes into the bell instantly |
| `leaderboard.updated` | `xp.service.awardXp` | Broadcast | Any XP change re-pushes a fresh "this week" snapshot; clients re-fetch via REST |
| `announcement.created` | `announcement.service.createAnnouncement` | Broadcast | A newly-published announcement appears without a refresh — fired identically whether authored natively via `/api/admin/announcements` or delivered by the teacher-backend bridge via `/api/internal/announcements` |

## Security checklist (see final report for the full audit)

- Passwords: bcrypt, 12 salt rounds, never returned in any response
- JWT: short-lived access token + rotated refresh token family, reuse detection revokes the whole session family
- Object-level authorization: every student/course/task/quiz/notification/note endpoint scopes queries to `req.user._id` — never trusts `req.body.userId`
- Course purchase gate: `requireEnrollment` middleware blocks lesson/task/quiz access without an **active** Enrollment record
- Quiz grading + XP/streak/level: 100% server-computed, never trusts client-submitted scores
- Payment verification: HMAC-SHA256 signature check (Razorpay's own algorithm), constant-time compare
- Rate limiting on auth endpoints, helmet, mongo-sanitize, strict zod validation on every mutating route
- No live per-action student activity tracking (explicitly out of scope)
