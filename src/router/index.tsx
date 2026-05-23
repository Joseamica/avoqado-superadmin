import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from '@/components/layouts/AppLayout'
import { ActivityLogPage } from '@/pages/ActivityLogPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/activity-log" element={<ActivityLogPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
