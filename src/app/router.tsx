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
const VenuesPage = lazy(() =>
  import('@/features/venues/VenuesPage').then((m) => ({ default: m.VenuesPage })),
)
const VenueDetailPage = lazy(() =>
  import('@/features/venues/VenueDetailPage').then((m) => ({ default: m.VenueDetailPage })),
)
const NewVenuePage = lazy(() =>
  import('@/features/venues/NewVenuePage').then((m) => ({ default: m.NewVenuePage })),
)
const VenueResourcePlaceholder = lazy(() =>
  import('@/features/venues/VenueResourcePlaceholder').then((m) => ({
    default: m.VenueResourcePlaceholder,
  })),
)
const VenuePaymentConfigPage = lazy(() =>
  import('@/features/venues/VenuePaymentConfigPage').then((m) => ({
    default: m.VenuePaymentConfigPage,
  })),
)
const TerminalsPage = lazy(() =>
  import('@/features/terminals/TerminalsPage').then((m) => ({ default: m.TerminalsPage })),
)
const NewTerminalPage = lazy(() =>
  import('@/features/terminals/NewTerminalPage').then((m) => ({ default: m.NewTerminalPage })),
)
const TerminalSettingsPage = lazy(() =>
  import('@/features/terminals/TerminalSettingsPage').then((m) => ({
    default: m.TerminalSettingsPage,
  })),
)
const MerchantsPage = lazy(() =>
  import('@/features/merchants/MerchantsPage').then((m) => ({ default: m.MerchantsPage })),
)
const BlumonSetupPanel = lazy(() =>
  import('@/features/merchants/BlumonSetupPanel').then((m) => ({ default: m.BlumonSetupPanel })),
)
const AngelPaySetupPanel = lazy(() =>
  import('@/features/merchants/AngelPaySetupPanel').then((m) => ({
    default: m.AngelPaySetupPanel,
  })),
)
const MerchantDetailPage = lazy(() =>
  import('@/features/merchants/MerchantDetailPage').then((m) => ({
    default: m.MerchantDetailPage,
  })),
)
const EarningsPage = lazy(() =>
  import('@/features/earnings/EarningsPage').then((m) => ({ default: m.EarningsPage })),
)
const EarningsDetailPage = lazy(() =>
  import('@/features/earnings/EarningsDetailPage').then((m) => ({ default: m.EarningsDetailPage })),
)
const PaymentProvidersPage = lazy(() =>
  import('@/features/payment-providers/PaymentProvidersPage').then((m) => ({
    default: m.PaymentProvidersPage,
  })),
)
const PaymentProviderFormPage = lazy(() =>
  import('@/features/payment-providers/PaymentProviderFormPage').then((m) => ({
    default: m.PaymentProviderFormPage,
  })),
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
          <Route path="/earnings" element={<EarningsPage />} />
          <Route path="/earnings/venue/:venueId" element={<EarningsDetailPage />} />
          <Route path="/earnings/merchant/:merchantId" element={<EarningsDetailPage />} />
          <Route path="/activity-log" element={<ActivityLogPage />} />
          <Route path="/system-logs" element={<SystemLogsPage />} />
          <Route path="/venues" element={<VenuesPage />} />
          {/* `/new` ANTES de `:venueId` para que el matcher de react-router no
              capture "new" como un venueId. */}
          <Route path="/venues/new" element={<NewVenuePage />} />
          <Route path="/venues/:venueId" element={<VenueDetailPage />} />
          {/*
            Placeholders de las pantallas dedicadas de configuración. Los
            mini-iconos en `/venues` ya apuntan acá. Cuando construyamos cada
            pantalla real, sólo se reemplaza el element del Route por el
            componente verdadero — la URL queda fija. Esto es la forma de
            "pre-cablear" rutas sin perder UX hoy.
          */}
          <Route
            path="/venues/:venueId/owner"
            element={<VenueResourcePlaceholder resource="owner" />}
          />
          <Route
            path="/venues/:venueId/kyc"
            element={<VenueResourcePlaceholder resource="kyc" />}
          />
          <Route
            path="/venues/:venueId/terminals/new"
            element={<VenueResourcePlaceholder resource="terminal" />}
          />
          <Route path="/venues/:venueId/merchant" element={<VenuePaymentConfigPage />} />
          <Route
            path="/venues/:venueId/pricing"
            element={<VenueResourcePlaceholder resource="pricing" />}
          />
          <Route path="/terminals" element={<TerminalsPage />} />
          {/* `/new` ANTES de `:terminalId` para que no se trate "new" como ID. */}
          <Route path="/terminals/new" element={<NewTerminalPage />} />
          <Route path="/terminals/:terminalId/settings" element={<TerminalSettingsPage />} />
          <Route path="/merchants" element={<MerchantsPage />} />
          {/* `/new` ANTES de `:id` para que "new" no se capture como ID. */}
          <Route path="/merchants/new" element={<BlumonSetupPanel />} />
          <Route path="/merchants/new-angelpay" element={<AngelPaySetupPanel />} />
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
          <Route path="/payment-providers" element={<PaymentProvidersPage />} />
          {/* `/new` ANTES de `:id` para que "new" no se capture como ID. */}
          <Route path="/payment-providers/new" element={<PaymentProviderFormPage />} />
          <Route path="/payment-providers/:id" element={<PaymentProviderFormPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
