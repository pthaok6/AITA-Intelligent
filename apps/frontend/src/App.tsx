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
import { ImportStudentsPage } from './pages/lecturer/ImportStudentsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminAiKeysPage } from './pages/admin/AdminAiKeysPage';
import { EditExamPage } from './pages/lecturer/EditExamPage';
import { ClassRosterPage } from './pages/lecturer/ClassRosterPage';
import { MySubmissionsPage } from './pages/student/MySubmissionsPage';
import { MyAppealsPage } from './pages/student/MyAppealsPage';
import { LecturerAppealsPage } from './pages/lecturer/LecturerAppealsPage';
import { MyTeamsPage } from './pages/student/MyTeamsPage';
import { ProfilePage } from './pages/auth/ProfilePage';

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <p style={{ color: '#60a5fa', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Đang kiểm tra phiên đăng nhập...</p>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Vui lòng đợi giây lát</span>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user?.role === 'LECTURER') return <Navigate to="/lecturer" replace />;
  return <Navigate to="/student" replace />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <p style={{ color: '#60a5fa', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Đang tải dữ liệu...</p>
      </div>
    );
  }
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
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><LecturerDashboard /></ProtectedRoute>} />
              <Route path="/admin/appeals" element={<ProtectedRoute allowedRoles={['ADMIN']}><LecturerAppealsPage /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminUsersPage /></ProtectedRoute>} />
              <Route path="/admin/ai-keys" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAiKeysPage /></ProtectedRoute>} />
              <Route path="/lecturer/classes/:classId/import-students" element={<ProtectedRoute allowedRoles={['LECTURER']}><ImportStudentsPage /></ProtectedRoute>} />
              <Route path="/lecturer/classes/:classId/exams/:examId/edit" element={<ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}><EditExamPage /></ProtectedRoute>} />
              <Route path="/lecturer/classes/:classId/students" element={<ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}><ClassRosterPage /></ProtectedRoute>} />
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
                  <ProtectedRoute allowedRoles={['LECTURER']}>
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
              <Route
                path="/lecturer/appeals"
                element={
                  <ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}>
                    <LecturerAppealsPage />
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
                path="/student/appeals"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'LECTURER']}>
                    <MyAppealsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/student/teams" element={<ProtectedRoute allowedRoles={['STUDENT']}><MyTeamsPage /></ProtectedRoute>} />
              <Route
                path="/student/exams/:examId/take"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'LECTURER']}>
                    <ExamTakePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/student/exams/:examId/submissions" element={<ProtectedRoute allowedRoles={['STUDENT']}><MySubmissionsPage /></ProtectedRoute>} />
              <Route
                path="/student/submissions/:id"
                element={
                  <ProtectedRoute>
                    <SubmissionResultPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};
