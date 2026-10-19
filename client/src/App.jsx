import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import RoleGuard from './components/layout/RoleGuard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FestList from './pages/FestList';
import EventSchedule from './pages/EventSchedule';
import ImportSchedule from './pages/ImportSchedule';
import MentorshipMonitor from './pages/MentorshipMonitor';
import TeamRoster from './pages/TeamRoster';
import EquipmentInventory from './pages/EquipmentInventory';
import CheckoutDesk from './pages/CheckoutDesk';
import CoverageHub from './pages/CoverageHub';
import FootagePipeline from './pages/FootagePipeline';
import Notifications from './pages/Notifications';
import AuditLogs from './pages/AuditLogs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1
    }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route element={<RoleGuard />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/fests" element={<FestList />} />
              <Route path="/fests/:festId/events" element={<EventSchedule />} />
              <Route path="/fests/:festId/import" element={<ImportSchedule />} />
              <Route path="/assignments/mentorship" element={<MentorshipMonitor />} />
              <Route path="/team" element={<TeamRoster />} />
              <Route path="/equipment" element={<EquipmentInventory />} />
              <Route path="/equipment/checkout" element={<CheckoutDesk />} />
              <Route path="/coverage" element={<CoverageHub />} />
              <Route path="/coverage/unplanned" element={<CoverageHub />} />
              <Route path="/footage" element={<FootagePipeline />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/audit" element={<AuditLogs />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
