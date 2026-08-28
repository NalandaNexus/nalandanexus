import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/navbar/Navbar';
import Footer from './components/footer/Footer';
import ScrollToTop from './components/common/ScrollToTop';
import { Analytics } from "@vercel/analytics/react"
// Context Providers
import { AuthProvider } from './context/AuthContext';
import { StudentProvider } from './context/StudentContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import EnrollmentGate from './components/auth/EnrollmentGate';

// Public Pages - lazy-loaded so each route ships its own chunk instead of
// one 1MB+ bundle (see the vite build warning this replaces).
const Home = lazy(() => import('./pages/Home'));
const Learn = lazy(() => import('./pages/Learn'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const Community = lazy(() => import('./pages/Community'));
const Resources = lazy(() => import('./pages/Resources'));
const About = lazy(() => import('./pages/About'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Student Workspace Pages & Layout
const StudentLayout = lazy(() => import('./components/student/StudentLayout'));
const PurchasePage = lazy(() => import('./pages/student/PurchasePage'));
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'));
const ParambhCoursePage = lazy(() => import('./pages/student/ParambhCoursePage'));
const TaskDetailPage = lazy(() => import('./pages/student/TaskDetailPage'));
const QuizRunnerPage = lazy(() => import('./pages/student/QuizRunnerPage'));
const NotesPage = lazy(() => import('./pages/student/NotesPage'));
const LiveClassesPage = lazy(() => import('./pages/student/LiveClassesPage'));
const QuizzesListPage = lazy(() => import('./pages/student/QuizzesListPage'));
const TasksListPage = lazy(() => import('./pages/student/TasksListPage'));
const LeaderboardPage = lazy(() => import('./pages/student/LeaderboardPage'));
const PerformancePage = lazy(() => import('./pages/student/PerformancePage'));
const MessagesPage = lazy(() => import('./pages/student/MessagesPage'));
const AnnouncementsPage = lazy(() => import('./pages/student/AnnouncementsPage'));
const SettingsPage = lazy(() => import('./pages/student/SettingsPage'));
const HelpSupportPage = lazy(() => import('./pages/student/HelpSupportPage'));

import { toggleSound, isSoundEnabled } from './utils/sound';

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  );
}

function LayoutWrapper({ children, soundOn, onToggleSound, darkMode, onToggleTheme }) {
  const location = useLocation();
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/verify-email';
  const isStudentWorkspace = location.pathname.startsWith('/student');

  // If in student workspace, render student shell directly with its dedicated navigation
  if (isStudentWorkspace) {
    return <div className="min-h-screen bg-[#EDEAE0]">{children}</div>;
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950">
      {/* Ambient Lighting Backdrops */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />
      <div className="ambient-glow glow-3" />

      {/* Main Sticky Navbar */}
      <Navbar
        soundOn={soundOn}
        onToggleSound={onToggleSound}
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
      />

      {/* Main Page Body */}
      <main className="relative z-10 flex-grow">{children}</main>

      {/* Footer */}
      {!isAuthPage && <Footer />}
    </div>
  );
}

export default function App() {
  // Theme state: defaults to dark matching reference image
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('nalanda_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nalanda_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nalanda_theme', 'light');
    }
  }, [darkMode]);

  return (
    <AuthProvider>
      <StudentProvider>
        <BrowserRouter>
          <ScrollToTop />
          <LayoutWrapper
            soundOn={soundOn}
            onToggleSound={() => setSoundOn(toggleSound())}
            darkMode={darkMode}
            onToggleTheme={() => setDarkMode((prev) => !prev)}
          >
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {/* Public Home Landing Page */}
                <Route path="/" element={<Home />} />

                {/* Learn Curriculum & Courses */}
                <Route path="/learn" element={<Learn />} />
                <Route path="/courses/:slug" element={<CourseDetail />} />

                {/* Ecosystem Spaces */}
                <Route path="/community" element={<Community />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/about" element={<About />} />

                {/* Legacy redirects */}
                <Route path="/classroom" element={<Navigate to="/student/dashboard" replace />} />
                <Route path="/projects" element={<Navigate to="/community" replace />} />

                {/* Preserved 2.5D Interactive Character Authentication */}
                <Route path="/login" element={<AuthPage initialMode="login" />} />
                <Route path="/signup" element={<AuthPage initialMode="signup" />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                {/* ==================================================== */}
                {/* PROTECTED STUDENT DASHBOARD & PARAMBH LEARNING LOOP  */}
                {/* ==================================================== */}
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute>
                      <StudentLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/student/dashboard" replace />} />

                  {/* Purchase gate: a logged-in student must buy the Parambh
                      course before reaching the dashboard/learning routes. */}
                  <Route path="purchase" element={<PurchasePage />} />

                  <Route element={<EnrollmentGate />}>
                    <Route path="dashboard" element={<StudentDashboardPage />} />
                    <Route path="parambh" element={<ParambhCoursePage />} />
                    <Route path="parambh/tasks/:taskId" element={<TaskDetailPage />} />
                    <Route path="parambh/quizzes/:quizId" element={<QuizRunnerPage />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="live-classes" element={<LiveClassesPage />} />
                    <Route path="quizzes" element={<QuizzesListPage />} />
                    <Route path="tasks" element={<TasksListPage />} />
                    <Route path="leaderboard" element={<LeaderboardPage />} />
                    <Route path="performance" element={<PerformancePage />} />
                  </Route>

                  {/* Account/support pages remain reachable pre-purchase. */}
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="help" element={<HelpSupportPage />} />
                </Route>

                {/* A real 404 rather than a silent redirect to Home - a bad
                    URL should say so, and crawlers should not see every dead
                    link answer 200 with the homepage. */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </LayoutWrapper>
        </BrowserRouter>
      </StudentProvider>
    </AuthProvider>
  );
}
