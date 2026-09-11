import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';

// Pages
import AdminLoginPage from './pages/AdminLoginPage';
import TeacherActivationPage from './pages/TeacherActivationPage';
import AdminOverviewPage from './pages/AdminOverviewPage';
import TeachersPage from './pages/TeachersPage';
import StudentsPage from './pages/StudentsPage';
import CourseGovernancePage from './pages/CourseGovernancePage';
import BatchesPage from './pages/BatchesPage';
import CouponsPage from './pages/CouponsPage';
import CourseSubjectsPage from './pages/CourseSubjectsPage';
import ResourcesPage from './pages/ResourcesPage';
import AcademicsPage from './pages/AcademicsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import PaymentsPage from './pages/PaymentsPage';
import ReportsPage from './pages/ReportsPage';
import SystemLogsPage from './pages/SystemLogsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import { Analytics } from "@vercel/analytics/react"

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication & Setup Routes */}
          <Route path="/login" element={<AdminLoginPage />} />
          <Route path="/activate" element={<TeacherActivationPage />} />

          {/* Protected Master Console Routes */}
          <Route
            path="/"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="teachers" element={<TeachersPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="courses" element={<CourseGovernancePage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="course-subjects" element={<CourseSubjectsPage />} />
            <Route path="resources" element={<ResourcesPage />} />
            <Route path="academics" element={<AcademicsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="logs" element={<SystemLogsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
