# Nalanda Nexus — Landing Page + Backend Integration Report

Scope actually implemented from the 64-section master prompt: language-selector removal, real backend-driven Popular Courses, real backend-driven public Announcements, and full dynamicization of the Course Detail (Prarambh) page. Every item below is reported honestly — nothing hidden, gaps called out explicitly in Section 7.

## 1. Architecture Summary

The Landing Page is **not** a separate app — it is `student/frontend`'s own public route tree (`/`, `/courses/:slug`, `/resources`, `/learn`, …), sharing the same React app, `AuthContext`, and `apiClient` as the authenticated Student Portal. It talks to the **same single backend**, `student/backend` (:5001), and the **same MongoDB database** the Student Portal already uses — no second database, no duplicate Course/Announcement collection was created for the Landing Page.

Admin/Teacher portals keep their own existing mirror models (`AdminAnnouncement` in teacher/backend, `TeacherAnnouncement` in admin/backend, built in an earlier phase) for their own cross-portal notification bridges — those are untouched. The Landing Page does not go through that bridge at all; it reads directly from student/backend's own native `Announcement` collection, which is exactly where admin-authored announcements already land natively. No new duplicate collection was introduced.

Public course/announcement data is intentionally unauthenticated (`attachUserIfPresent` only, never a hard auth gate) since anonymous visitors must see it; personalization (`isEnrolled`) layers on top only when a request happens to carry a valid session.

## 2. Database Changes

**`student/backend/src/models/Course.js`** — additive only, two new fields:
```js
isFeatured: { type: Boolean, default: false, index: true },
isPopular:  { type: Boolean, default: false, index: true },
```
Admin-controlled, real fields — never a frontend `.slice()` standing in for "popularity."

**`student/backend/src/seed/seed.js`** — the Prarambh course document now sets `isFeatured: true, isPopular: true` explicitly (the only course currently flagged; every other seeded course defaults to `false`).

No schema change was needed for `Announcement` — its existing `courseIds` field's established "empty array = institution-wide" convention was reused as the public/private boundary, instead of inventing a new `targetAudience` enum the spec described but the real schema never had.

## 3. API Changes

| Endpoint | Change |
|---|---|
| `GET /api/public/courses` | Added optional `?popular=true` / `?featured=true` query filters — real server-side `Course.find({isPopular:true})`, not a client-side slice. Response objects now include `isFeatured`/`isPopular`. |
| `GET /api/public/courses/:slug` | Unchanged response shape; now actually consumed with a dynamic slug on the frontend instead of a hardcoded `'prarambh'`. |
| `GET /api/public/announcements?limit=N` | **New.** Public, unauthenticated. Returns published, non-expired, institution-wide announcements (`courseIds: []`), sorted `publishAt` desc, `limit` clamped 1–20. |

## 4. Realtime Events

**Decision: no new public/unauthenticated Socket.IO namespace was built.** The existing socket server requires a valid JWT in the connection handshake (`io.use(...)` middleware) and has no public namespace anywhere in the codebase today — an anonymous Landing Page visitor's browser can never hold a socket connection at all. Adding one would be genuinely new unauthenticated attack surface that wasn't explicitly requested, and the master prompt's own fallback clause (section 47) explicitly permits a safe refetch approach instead.

Implemented instead: `AnnouncementsSection` fetches on mount with an honest `loading | success | empty | error` state machine and a manual **Retry** button. Popular Courses also refetches on every page load (no stale caching layer) so admin-side flag changes appear on next visit/refresh.

## 5. Frontend Changes

- **Language selector removed cleanly**: `Navbar.jsx` and `MobileMenu.jsx` — removed the `Globe` import, the `isLangOpen` state, the icon button, and the `LanguageSelectorModal` render/prop wiring. Mobile quick-tools grid changed `grid-cols-4` → `grid-cols-3` to match the remaining 3 buttons (Search, Theme, Sound). `LanguageSelectorModal.jsx` deleted after confirming (via grep) no remaining importers.
- **`courseService.js`**: added `listPopularCourses()`; `toDisplayCourse()` now carries `isFeatured`/`isPopular` through to display components.
- **`ExploreCourses.jsx`**: "Popular Courses" now renders real `listPopularCourses()` results instead of `courses.slice(0, 5)`.
- **New `announcementService.js` + `AnnouncementsSection.jsx`**: wired into `Home.jsx` directly above `ExploreCourses`, left-aligned per the design brief (`max-w-2xl` inner panel, not full-bleed).
- **`CourseDetail.jsx` — fully dynamicized** (previously the entire page was hardcoded to a single course):
  - Reads `:slug` via `useParams()` instead of a module-level `const COURSE_SLUG = 'prarambh'` — this also fixes the enroll button's login-redirect and purchase call, which were previously hardcoded to `/courses/prarambh` regardless of which course the visitor was actually looking at.
  - Added real **loading** and **"Course not found"** states (previously an invalid slug would have silently rendered stale/blank content).
  - The hardcoded 6-item "What You'll Learn" module array — confirmed via live API response to be an exact duplicate of the real `course.skills` array — replaced with a render driven directly by `course.skills`. Icon/color assignment cycles presentationally; no fabricated per-skill descriptions were invented to fill the old card layout.
  - Hero title/subtitle/tagline/description now come from real `course.title` / `course.subtitle` / `course.tagline` / `course.description` instead of hardcoded "PRARAMBH" / "THE AWAKENING" strings.
  - Banner image now `course.bannerImage` (real, DB-driven) instead of a hardcoded path.
  - Specs strip: **DURATION** and **LEVEL** now read `course.duration` / `course.difficulty` (previously hardcoded values that only happened to match by coincidence, since the page was Prarambh-only). **"LIVE SESSIONS: 24+ Classes"** replaced with **"LESSONS: {course.totalLessons} Lessons"** — this also fixes a real pre-existing data inconsistency where the hardcoded "24+ Classes" directly contradicted the DB's actual `totalLessons: 13`.
  - The Sanskrit shloka and the bespoke Hindi marketing paragraph — genuinely bespoke copy with no generic DB equivalent — are now gated to render only when `slug === 'prarambh'`, so other real courses don't inherit Prarambh-specific flavor text.

## 6. Testing Results

| Area | Check | Result |
|---|---|---|
| Language selector | Absent from desktop navbar | **PASS** |
| | Absent from mobile navbar + mobile menu | **PASS** |
| | Mobile quick-tools grid renders 3 clean columns, no layout breakage | **PASS** (verified via DOM query: `grid-cols-3`, 3 children: Search/Light/Sound On) |
| | No dangling imports/dead code after deletion | **PASS** |
| Popular Courses | `GET /api/public/courses?popular=true` returns only DB-flagged course(s) | **PASS** (curl-verified) |
| | Landing Page section renders exactly the flagged course, no `.slice()` | **PASS** (browser-verified) |
| | `isFeatured`/`isPopular` persisted on schema + seed | **PASS** |
| Announcements | `GET /api/public/announcements` returns real unauthenticated feed | **PASS** (curl-verified, 2 real seeded items) |
| | Landing Page section renders real announcements with correct type badge + timestamp | **PASS** (browser-verified) |
| | Loading/empty/error states honest | **PASS** (loading/success observed live; empty/error confirmed by code review of the explicit state machine) |
| Realtime sync | Public socket namespace | **N/A** — deliberately not built; see Section 4 |
| Course Detail | `/courses/prarambh` — real title/subtitle/tagline/skills/duration/difficulty/lessons | **PASS** |
| | `/courses/python-for-beginners` — real generic data, no Prarambh-only flourish leaking, honest "0 Lessons" (no fabricated content) | **PASS** |
| | `/courses/does-not-exist` — honest not-found state, no crash | **PASS** |
| | Skills grid driven by real `course.skills`, no fabricated per-skill copy | **PASS** |
| Resources section | Real backend model/API/access-control/search/pagination | **FAIL / NOT BUILT** — see Remaining Issues |
| Build | `vite build --mode production` | **PASS**, no errors |
| Console/network sanity | Fresh tab: no errors from new code paths; only a pre-existing, unrelated anonymous `POST /api/auth/refresh` 401 (silent "am I logged in" probe that predates this work) | **PASS** |

## 7. Remaining Issues (not hidden)

1. ~~Resources section was not rebuilt.~~ **RESOLVED** — see Section 8: a real `Resource` model, admin upload UI, cross-portal bridge, public paginated/searchable API, and live Socket.IO push were built.
2. ~~No new public Socket.IO namespace.~~ **RESOLVED** — see Section 8: an unauthenticated, broadcast-only `/public` namespace was added and now also covers the Announcements section.
3. **No Admin UI toggle for `isFeatured`/`isPopular` yet.** They're real, DB-driven, and settable via the data layer/seed — the core "not hardcoded in JSX" requirement is met — but there's no checkbox in Admin's course editor yet. A small, clearly-scoped follow-up if wanted.
4. **"LEARNING RESOURCES: Workbook + Assignments" and "CERTIFICATE: Upon Completion"** on the Course Detail specs strip remain static text — no equivalent Course schema field exists and none was requested; inventing new commerce fields for these felt out of scope for this pass.
5. Verification ran against the local ephemeral `mongodb-memory-server` for student/backend (port 27117), and against the real Atlas `nalanda_admin` database for admin/backend (its existing configured `.env`, unchanged by this work) — the two test resources created during Section 8's live verification were deleted afterward, leaving no test data behind.

## 8. Addendum — Resources Section + Public Realtime Sync

Built in direct response to the two gaps above, per explicit follow-up request: "admin upload data like magazine, events images and resources of program through admin dashboard and Realtime sync with update as upload."

**Architecture**: Admin authors a `Resource` (title, type: magazine/event/program, description, file) through a new **Resources** page in the Admin Dashboard (multipart upload, reusing the existing `multer` disk-storage pattern already proven for course cover images). On create/update/delete, admin/backend bridges the change — best-effort, idempotent on `sourceId`, same shared-secret pattern as every other cross-portal bridge in this system — into a new `Resource` collection on student/backend, which is what the public API and Landing Page actually read. Admin never deletes silently: `catalogSyncStatus` (`synced`/`failed`) is tracked per resource, same convention as the Course bridge.

**Realtime**: student/backend's Socket.IO server now exposes a second namespace, `io.of('/public')`, defined without the existing `io.use(...)` JWT middleware (which only guards the default namespace). It never registers a handler for any incoming client event — it only ever pushes `resource.upserted` / `resource.deleted` / `announcement.created`, all of which mirror data already exposed by `GET /api/public/*`. An anonymous connection here can observe public data sooner; it cannot read, write, or trigger anything it couldn't already GET. The frontend adds a second, standalone `connectPublicSocket()` (distinct from the existing JWT-gated `connectSocket()` singleton, which returns `null` for anonymous visitors) used by both the Resources page and the Announcements section.

**Database**: new `Resource` model on both admin/backend (authoring copy: `title`, `description`, `type`, `file`, `fileName/Type/SizeBytes`, `isPublished`, `catalogSyncedAt/Status`) and student/backend (public copy: same shape plus `source`/`sourceId` for bridge idempotency, `fileUrl` as an absolute URL back to admin/backend's static file server).

**API**: `GET /api/public/resources?type=&search=&page=&pageSize=` — real server-side filtering, text search, and pagination (`meta.page/pageSize/total/totalPages`), not a client-side slice. Admin-side CRUD at `/api/admin/resources` (auth + `resources.manage` permission), and the bridge ingest at `POST/PATCH/DELETE /api/internal/resources` on student/backend.

**Frontend**: `student/frontend/src/pages/Resources.jsx` fully rewritten — real fetch, type-filter tabs (Magazines/Event Photos/Program Resources), search, pagination, and a live socket listener that refetches on `resource.upserted`/`resource.deleted` with no page reload. `AnnouncementsSection.jsx` on the Home page gained the same live listener for `announcement.created`, closing gap #2 for both sections that originally had it. `admin/frontend/src/pages/ResourcesPage.jsx` is new — upload modal (title/type/description/file), grid view with thumbnails, live refresh via the existing `useRealtimeEvents` hook, delete.

**Testing results**:

| Check | Result |
|---|---|
| Admin uploads a magazine PDF via the new Resources page → bridges to student/backend | **PASS** (curl + live browser verified) |
| `GET /api/public/resources` returns real data with working `type` filter and pagination `meta` | **PASS** |
| Uploaded file is servable cross-origin (`Cross-Origin-Resource-Policy: cross-origin`) from admin/backend's static server | **PASS** |
| Landing Page `/resources` renders real uploaded resource, correct type badge, file size, working "Open" link | **PASS** |
| Anonymous browser tab connects to `/public` namespace without a JWT | **PASS** (`connected: true`, `nsp: /public`) |
| A new admin upload pushes `resource.upserted` to an already-open Landing Page tab, which refetches and renders it — **with no page reload** | **PASS** (live-observed) |
| Deleting a resource in Admin pushes `resource.deleted`, item disappears from the open Landing Page tab live | **PASS** (live-observed) |
| Type filter tabs correctly filter, honest empty state for a type with no items | **PASS** |
| Admin Resources page: sidebar nav, route, upload modal, empty state | **PASS** |
| `vite build --mode production` — both student/frontend and admin/frontend | **PASS**, no errors |
| Test data cleanup | **PASS** — both verification resources deleted after testing, public API confirmed empty again |
