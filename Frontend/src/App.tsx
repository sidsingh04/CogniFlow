import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AgentDashboard from './pages/AgentDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import SupportPage from './pages/SupportPage';
import axiosInstance, { setAccessToken } from './utils/axiosInstance';
import './App.css';

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  const isSupervisor = sessionStorage.getItem('supervisorId') !== null;
  const isAgent = sessionStorage.getItem('agentId') !== null;

  if (!isAuthenticated) return <Navigate to="/" replace />;

  if (requiredRole === 'supervisor' && !isSupervisor) return <Navigate to={isAgent ? "/agent" : "/"} replace />;
  if (requiredRole === 'agent' && !isAgent) return <Navigate to={isSupervisor ? "/supervisor" : "/"} replace />;

  return <>{children}</>;
};

function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // On app load, attempt to silently refresh the access token
  // using the httpOnly refresh cookie (if it exists)
  useEffect(() => {
    const bootstrap = async () => {
      const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
      if (!isAuthenticated) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const { data } = await axiosInstance.post('/api/login/refresh');
        setAccessToken(data.token);
      } catch {
        // Refresh cookie expired or invalid — clear session
        sessionStorage.clear();
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  if (isBootstrapping) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/support" element={<SupportPage />} />
        <Route
          path="/agent"
          element={
            <ProtectedRoute requiredRole="agent">
              <AgentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor"
          element={
            <ProtectedRoute requiredRole="supervisor">
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

