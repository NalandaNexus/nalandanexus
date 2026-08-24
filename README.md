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
