import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useEmbed, detectEmbedMode } from './contexts/EmbedContext';
import { Layout } from './components/Layout';
import { LoadingSpinner } from './components/LoadingSpinner';

// Pages
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import StreamersPage from './pages/StreamersPage';
import CampaignsPage from './pages/CampaignsPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardPage from './pages/DashboardPage';

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  // Detect embed mode synchronously to avoid race conditions
  const embedState = detectEmbedMode();
  const isInEmbedMode = embedState.isEmbedMode && embedState.isValidReferrer;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Allow access if user is authenticated OR in valid embed mode
  if (!user && !isInEmbedMode) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin route wrapper
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { isEmbedMode } = useEmbed();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect embed users away from admin routes
  if (isEmbedMode || user.id === 'embed-user') {
    return <Navigate to="/dashboard" replace />;
  }

  // Only abiola@miela.cc is admin
  const isAdmin = user.email === 'abiola@miela.cc';

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 dark:text-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:text-gray-100">
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            user ? <Navigate to="/dashboard" replace /> : <LoginPage />
          }
        />

        {/* Root redirect to login */}
        <Route index element={<Navigate to="/login" replace />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="streamers" element={<StreamersPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
        </Route>

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Layout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminPage />} />
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;
