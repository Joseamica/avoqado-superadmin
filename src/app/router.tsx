import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from '@/shared/layouts/AppLayout'
import { RouteLoader } from '@/shared/components/RouteLoader'

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const ActivityLogPage = lazy(() =>
  import('@/features/activity-log/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage })),
)
const SystemLogsPage = lazy(() =>
  import('@/features/system-logs/SystemLogsPage').then((m) => ({ default: m.SystemLogsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/app/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
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
          <Route path="/system-logs" element={<SystemLogsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
