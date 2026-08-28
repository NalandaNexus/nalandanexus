import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TeacherAuthProvider } from './context/TeacherAuthContext';
import TeacherThemeProvider from './theme/ThemeProvider';
import TeacherProtectedRoute from './components/TeacherProtectedRoute';
import TeacherLayout from './components/TeacherLayout';
import TeacherLoginPage from './pages/TeacherLoginPage';
import ForcedPasswordResetPage from './pages/ForcedPasswordResetPage';
import DashboardPage from './pages/DashboardPage';
import ClassesPage from './pages/ClassesPage';
import CoursesPage from './pages/CoursesPage';
import GradingPage from './pages/GradingPage';
import StudentsPage from './pages/StudentsPage';
import AttendancePage from './pages/AttendancePage';
import ExamsPage from './pages/ExamsPage';
import GradesPage from './pages/GradesPage';
import MessagesPage from './pages/MessagesPage';
import ResourcesPage from './pages/ResourcesPage';
import CalendarPage from './pages/CalendarPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import ReportsPage from './pages/ReportsPage';
import LiveSchedulePage from './pages/LiveSchedulePage';
import SettingsPage from './pages/SettingsPage';
import { Analytics } from "@vercel/analytics/react"

export default function App() {
  return (
    <TeacherAuthProvider>
      <TeacherThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Route (100% untouched) */}
            <Route path="/login" element={<TeacherLoginPage />} />

            {/* Mandatory first-login reset for an admin-provisioned temp password */}
            <Route
              path="/reset-password"
              element={
                <TeacherProtectedRoute skipPasswordCheck>
                  <ForcedPasswordResetPage />
                </TeacherProtectedRoute>
              }
            />

            {/* Protected Faculty Suite Routes */}
            <Route
              path="/"
              element={
                <TeacherProtectedRoute>
                  <TeacherLayout />
                </TeacherProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="grading" element={<GradingPage />} />
              <Route path="assignments" element={<GradingPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="exams" element={<ExamsPage />} />
              <Route path="grades" element={<GradesPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="resources" element={<ResourcesPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="live" element={<LiveSchedulePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TeacherThemeProvider>
    </TeacherAuthProvider>
  );
}
