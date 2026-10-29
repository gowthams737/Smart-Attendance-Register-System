import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Main Admin Pages
import DashboardPage from './pages/DashboardPage';
import StudentManagementPage from './pages/StudentManagementPage';
import StudentRegistrationPage from './pages/StudentRegistrationPage';
import LiveAttendancePage from './pages/LiveAttendancePage';
import AttendanceHistoryPage from './pages/AttendanceHistoryPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import UserProfilePage from './pages/UserProfilePage';

// Class Advisor Pages
import AdvisorDashboardPage from './pages/advisor/AdvisorDashboardPage';
import AdvisorStudentsPage from './pages/advisor/AdvisorStudentsPage';
import AdvisorLeavesPage from './pages/advisor/AdvisorLeavesPage';
import AdvisorAttendanceHistoryPage from './pages/advisor/AdvisorAttendanceHistoryPage';
import AdvisorReportsPage from './pages/advisor/AdvisorReportsPage';

// Student Pages
import StudentDashboardPage from './pages/StudentDashboardPage';
import StudentAttendancePage from './pages/StudentAttendancePage';
import StudentLeavePage from './pages/StudentLeavePage';
import StudentProfilePage from './pages/StudentProfilePage';

// Common Pages
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';

// Main Admin Route Guard (HODs / Main Admins)
function MainAdminRoute({ children }) {
  const adminSessionStr = localStorage.getItem('adminSession');
  const studentSessionStr = localStorage.getItem('studentSession');

  if (adminSessionStr) {
    try {
      const session = JSON.parse(adminSessionStr);
      if (session.is_hod === true || session.role === 'admin') {
        return children;
      }
      return <Navigate to="/advisor" replace />;
    } catch (e) {
      return <Navigate to="/login" replace />;
    }
  }
  if (studentSessionStr) {
    return <Navigate to="/student" replace />;
  }
  return <Navigate to="/login" replace />;
}

// Class Advisor Route Guard (Sub Admins / Class Teachers)
function AdvisorRoute({ children }) {
  const adminSessionStr = localStorage.getItem('adminSession');
  const studentSessionStr = localStorage.getItem('studentSession');

  if (adminSessionStr) {
    try {
      const session = JSON.parse(adminSessionStr);
      if (session.is_hod === false || session.role === 'class_teacher') {
        return children;
      }
      return <Navigate to="/admin" replace />;
    } catch (e) {
      return <Navigate to="/login" replace />;
    }
  }
  if (studentSessionStr) {
    return <Navigate to="/student" replace />;
  }
  return <Navigate to="/login" replace />;
}

// Student Route Guard
function StudentRoute({ children }) {
  const studentSession = localStorage.getItem('studentSession');
  const adminSession = localStorage.getItem('adminSession');

  if (studentSession) {
    return children;
  }
  if (adminSession) {
    try {
      const session = JSON.parse(adminSession);
      if (session.is_hod === true || session.role === 'admin') {
        return <Navigate to="/admin" replace />;
      }
      return <Navigate to="/advisor" replace />;
    } catch (e) {
      return <Navigate to="/login" replace />;
    }
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Router>
          <Routes>
            {/* Public/Landing Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Main Admin Portal Routes */}
            <Route path="/admin" element={<MainAdminRoute><DashboardPage /></MainAdminRoute>} />
            <Route path="/admin/students" element={<MainAdminRoute><StudentManagementPage /></MainAdminRoute>} />
            <Route path="/admin/register-student" element={<MainAdminRoute><StudentRegistrationPage /></MainAdminRoute>} />
            <Route path="/admin/live" element={<MainAdminRoute><LiveAttendancePage /></MainAdminRoute>} />
            <Route path="/admin/history" element={<MainAdminRoute><AttendanceHistoryPage /></MainAdminRoute>} />
            <Route path="/admin/reports" element={<MainAdminRoute><ReportsPage /></MainAdminRoute>} />
            <Route path="/admin/settings" element={<MainAdminRoute><SettingsPage /></MainAdminRoute>} />
            <Route path="/admin/profile" element={<MainAdminRoute><UserProfilePage /></MainAdminRoute>} />

            {/* Class Advisor Portal Routes */}
            <Route path="/advisor" element={<AdvisorRoute><AdvisorDashboardPage /></AdvisorRoute>} />
            <Route path="/advisor/live" element={<AdvisorRoute><LiveAttendancePage /></AdvisorRoute>} />
            <Route path="/advisor/students" element={<AdvisorRoute><AdvisorStudentsPage /></AdvisorRoute>} />
            <Route path="/advisor/leaves" element={<AdvisorRoute><AdvisorLeavesPage /></AdvisorRoute>} />
            <Route path="/advisor/history" element={<AdvisorRoute><AdvisorAttendanceHistoryPage /></AdvisorRoute>} />
            <Route path="/advisor/reports" element={<AdvisorRoute><AdvisorReportsPage /></AdvisorRoute>} />

            {/* Student Portal Protected Routes */}
            <Route path="/student" element={<StudentRoute><StudentDashboardPage /></StudentRoute>} />
            <Route path="/student/attendance" element={<StudentRoute><StudentAttendancePage /></StudentRoute>} />
            <Route path="/student/leave" element={<StudentRoute><StudentLeavePage /></StudentRoute>} />
            <Route path="/student/profile" element={<StudentRoute><StudentProfilePage /></StudentRoute>} />

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}
