import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SecurityInsightsPage from './pages/SecurityInsightsPage';

function ProtectedRoute({ children }) {
  const { currentUser } = useApp();
  return currentUser ? children : <Navigate to="/" replace />;
}

function GuestRoute({ children }) {
  const { currentUser } = useApp();
  return currentUser ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Toast />
      <Routes>
        <Route
          path="/"
          element={<GuestRoute><LandingPage /></GuestRoute>}
        />
        <Route
          path="/auth"
          element={<GuestRoute><AuthPage /></GuestRoute>}
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
        />
        <Route
          path="/security"
          element={<ProtectedRoute><SecurityInsightsPage /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
