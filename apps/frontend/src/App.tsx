import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { LecturerDashboard } from './pages/lecturer/LecturerDashboard';
import { CreateExamPage } from './pages/lecturer/CreateExamPage';
import { ExamSubmissionsPage } from './pages/lecturer/ExamSubmissionsPage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { ExamTakePage } from './pages/student/ExamTakePage';
import { SubmissionResultPage } from './pages/student/SubmissionResultPage';

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'LECTURER') return <Navigate to="/lecturer" replace />;
  return <Navigate to="/student" replace />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <main style={{ flex: 1, paddingBottom: '3rem' }}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Lecturer Routes */}
              <Route
                path="/lecturer"
                element={
                  <ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}>
                    <LecturerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lecturer/classes/:classId/create-exam"
                element={
                  <ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}>
                    <CreateExamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lecturer/classes/:classId/exams"
                element={
                  <ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}>
                    <ExamSubmissionsPage />
                  </ProtectedRoute>
                }
              />

              {/* Student Routes */}
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'LECTURER']}>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/exams/:examId/take"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'LECTURER']}>
                    <ExamTakePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/submissions/:id"
                element={
                  <ProtectedRoute>
                    <SubmissionResultPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};
