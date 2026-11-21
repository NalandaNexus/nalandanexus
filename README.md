# Nalanda Nexus Platform

An integrated educational ecosystem consisting of three dedicated portals, each organized with separate `frontend` and `backend` services:

---

## Architecture Overview

```
Nalanda/
├── student/
│   ├── frontend/             # Complete Student Web Application (React + Vite + Tailwind)
│   │   ├── src/              # Parambh, Quizzes, Notes, Live Classes, Character Auth
│   │   ├── public/           # Multimedia assets, video, diagrams
│   │   ├── package.json
│   │   └── vite.config.js    # Runs on Port 5173
│   └── backend/              # Student API Service (Node / Express)
│       ├── src/              # Auth, student profiles, courses, tasks routes
│       └── package.json      # Runs on Port 5001
│
├── teacher/
│   ├── frontend/             # Faculty & Instructor Portal (React + Vite + Tailwind)
│   │   ├── src/              # Courses, Assignment Grading, Live Studio, Cohort Analytics
│   │   ├── package.json
│   │   └── vite.config.js    # Runs on Port 5174
│   └── backend/              # Teacher API Service (Node / Express)
│       ├── src/              # Submissions, evaluation, scheduling routes
│       └── package.json      # Runs on Port 5002
│
└── admin/
    ├── frontend/             # Master Institutional Admin Portal (React + Vite + Tailwind)
    │   ├── src/              # User provisioning, Course Governance, Telemetry & Logs
    │   ├── package.json
    │   └── vite.config.js    # Runs on Port 5175
    └── backend/              # Master Admin API Service (Node / Express)
        ├── src/              # Audit logs, role controls, system health routes
        └── package.json      # Runs on Port 5003
```

---

## Port Allocation

| Portal | Frontend Port | Backend API Port |
| :--- | :--- | :--- |
| **Student** | `http://localhost:5173` | `http://localhost:5001` |
| **Teacher** | `http://localhost:5174` | `http://localhost:5002` |
| **Admin** | `http://localhost:5175` | `http://localhost:5003` |

---

## Running the Applications

### 1. Student Portal
```bash
# Frontend
cd student/frontend
npm run dev

# Backend
cd student/backend
npm install
npm run dev
```

### 2. Teacher Portal
```bash
# Frontend
cd teacher/frontend
npm install
npm run dev

# Backend
cd teacher/backend
npm install
npm run dev
```

### 3. Admin Portal
```bash
# Frontend
cd admin/frontend
npm install
npm run dev

# Backend
cd admin/backend
npm install
npm run dev
```

---

## Onboarding a teacher

An administrator creates a teacher in **Admin → Teachers → Create Teacher**.

| | |
| :--- | :--- |
| **Required** | Full name, email, subject *or* department, and at least one course (PRARAMBH / GARUD / YODDHA — read live from the student catalogue) |
| **Optional** | Mobile number, designation, profile photo |
| **Generated** | Teacher ID (`TCH-0001`, also accepted as the username at login) and a temporary password that only the teacher ever sees, in their email. |

The teacher is emailed their **email, Teacher ID and a temporary password**, and must choose a new password the first time they sign in. The email is sent only after the Teacher service has created (or re-linked) the login and read it back to confirm it accepts exactly that password, so the email and the login cannot disagree. The password is never stored in plain text, logged, or returned by an API. Admin shows whether the email was accepted by the provider (and, if not, the provider's own reason); **Resend login details** issues a new temporary password and the old one stops working.

A teacher who was deleted and is created again with the same email is **restored** (same record and Teacher ID), and the Teacher service re-links and reactivates their existing login rather than refusing it. Refusing it is what used to send teachers a password their login never had.

**Forgot password.** The Teacher Portal's sign-in page lets a teacher request a single-use reset link (valid for 1 hour, at most one email a minute) at the Teacher Portal's `/setup-password` page. The answer is the same whether or not the address has an account. Using the link replaces the password and signs the account out everywhere.

**Course-wise visibility.** A teacher sees every student enrolled in each course assigned to them — and only those — under *Courses → View students*. It updates by itself: the student portal already sends a student's record after every purchase, coupon, free enrolment and profile edit, and the teacher portal applies it as it arrives. Assigning a course loads the students already enrolled. Grades, attendance and progress stay with the batch's own teacher; the course roster is read-only.

Settings (all optional except the email key):

| Service | Variable | Purpose |
| :--- | :--- | :--- |
| admin | `SENDGRID_API_KEY` | Without it no email is sent (status shows *Email not configured*). |
| admin | `SMTP_FROM` | Must be a **verified sender** in SendGrid, or every send is rejected (403). |
| admin | `TEACHER_PORTAL_URL` | Leave unset: the Teacher service reports its own `CLIENT_URL`. Override only for a custom domain. |
| teacher | `CLIENT_URL` | Must be the address the Teacher Portal frontend is served from — the emails link there. |
| teacher | `ADMIN_BACKEND_URL` | Admin's API address. "Forgot password" emails are sent through Admin, authenticated with the shared `STUDENT_BACKEND_SERVICE_KEY`. |

**Deploy order:** student → teacher → admin. The teacher service still accepts the older provisioning calls, so an Admin that has not been updated yet keeps working while the others roll out.

---

## Module videos

Every module (and, optionally, every lesson) of every course has **one primary video**, managed from **Admin → Module Videos** (any course) and **Teacher → Module Videos** (assigned courses only, checked on the server for every request). A video is one of:

| Source | How it reaches students |
| :--- | :--- |
| **Uploaded file** (MP4, MOV, WEBM, MKV; up to `MAX_VIDEO_UPLOAD_MB`) | The browser uploads it straight to private object storage in 10 MiB+ parts (resumable, 3 at a time, retried). The student service then checks the stored size and the file's real first bytes. Students only see it once it is verified, and stream it with HTTP range requests on a signed URL that lasts 2 hours. |
| **YouTube link** (watch, youtu.be, Shorts, live, embed) | Privacy-enhanced embed, built from the validated video id. |
| **Google Drive link** | Drive's own player, built from the validated file id. The file must be shared with the students, normally *Anyone with the link*; the editors check and explain this. |

- **Source of truth:** `Course.modules[].video` (and `…lessons[].video`) in the student database; the student service is its only writer. `VideoUpload` records each stored file from upload to deletion, and `CourseVideoEvent` is the history (one year), including failures, which Admin lists under *Video problems across all courses*.
- **Live updates:** after every change the student service tells enrolled students (Socket.IO course room), every signed-in admin, and the teachers assigned to that course. Each portal then re-reads through its own API, so a notice never carries content or URLs. Pages also re-read on reconnect and when the tab regains focus.
- **Replacing or removing** never interrupts the current video: the old one keeps playing until the new one is saved (or verified). A replaced file is deleted after every signed URL issued for it has expired, by `jobs/videoStorageSweep.job.js`, which also abandons idle uploads after 24 hours.
- **The old fixed PRARAMBH video** (`/PRARAMBH.mp4`) is gone from the frontends and is never served, even where old database rows still name it. `npm run migrate:remove-prarambh-video` (student backend) reports those rows, and with `--apply` clears them; production writes need explicit approval.

### Video storage (student backend)

Uploads need a **private** S3-compatible bucket. Cloudflare R2 is recommended (no egress fees); AWS S3 and MinIO also work. Without one, uploads answer *not configured*, and YouTube/Drive links keep working.

| Variable | Value |
| :--- | :--- |
| `VIDEO_STORAGE_ENDPOINT` | R2: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` · S3: `https://s3.<region>.amazonaws.com` |
| `VIDEO_STORAGE_REGION` | `auto` for R2, the bucket's region for S3 |
| `VIDEO_STORAGE_BUCKET` | the bucket name |
| `VIDEO_STORAGE_ACCESS_KEY_ID` / `VIDEO_STORAGE_SECRET_ACCESS_KEY` | an API token scoped to that bucket only (Object Read & Write) |
| `VIDEO_STORAGE_FORCE_PATH_STYLE` | `true` (default) |
| `MAX_VIDEO_UPLOAD_MB` | default `20480` (20 GB) |

The student backend also needs `ADMIN_BACKEND_URL` and `TEACHER_BACKEND_URL` (already used by other bridges) for live notices to reach the staff portals.

After setting them on Render, from `student/backend`:

```bash
npm run video-storage -- --check                       # credentials and bucket reachable
npm run video-storage -- --configure https://<admin-frontend>,https://<teacher-frontend>,https://<student-frontend>
npm run video-storage -- --self-test                   # real 3-part upload, verification, range playback, delete
```

`--configure` sets the bucket's CORS rule (browser part uploads and range playback from those origins only) and a rule that drops unfinished uploads after 2 days. Treat uploads as working in an environment only after `--self-test` passes there.

Tests: `npm test` in each backend, `npm test` in each frontend, and `npm run test:e2e:lesson-videos` at the root. The e2e boots the three real backends with in-memory databases and an in-process S3-compatible store, and checks Teacher→Student/Admin and Admin→Teacher/Student sync over real sockets. `node e2e/lessonVideo.e2e.mjs --keep` leaves that stack running for a browser check (ports 5101–5103).
