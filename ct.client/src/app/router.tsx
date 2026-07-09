import React from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppShell from '../shell/AppShell';
import { useAuthStore } from '../store/authStore';
import { Button } from '../ui/primitives';

import LoginView from '../features/auth/LoginView';
import DashboardView from '../features/dashboard/DashboardView';
import FindingsListView from '../features/findings/FindingsListView';
import FindingDetailView from '../features/findings/FindingDetailView';
import EngagementsView, { EngagementDetailView } from '../features/engagements/EngagementsView';
import ProductsView from '../features/products/ProductsView';
import ImportView from '../features/import/ImportView';
import ReportView from '../features/report/ReportView';
import ConnectorsView from '../features/connectors/ConnectorsView';
import AdminView from '../features/admin/AdminView';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <h1 className="cd-page-h1" style={{ marginBottom: 8 }}>Page not found</h1>
      <p className="cd-page-sub" style={{ marginBottom: 20 }}>The page you’re looking for doesn’t exist.</p>
      <Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/findings" element={<FindingsListView />} />
        <Route path="/findings/:id" element={<FindingDetailView />} />
        <Route path="/engagements" element={<EngagementsView />} />
        <Route path="/engagements/:id" element={<EngagementDetailView />} />
        <Route path="/products" element={<ProductsView />} />
        <Route path="/import" element={<ImportView />} />
        <Route path="/report" element={<ReportView />} />
        <Route path="/connectors" element={<ConnectorsView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
