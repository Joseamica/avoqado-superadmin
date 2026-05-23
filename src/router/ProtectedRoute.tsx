import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isSuperadmin, isLoading, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-screen items-center justify-center bg-[var(--canvas)] text-[12.5px] text-[var(--ink-faint)]"
      >
        Verificando sesión…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user && !isSuperadmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas)] px-6 text-center">
        <p className="eyebrow text-[var(--danger)]">Acceso denegado</p>
        <h1 className="mt-3 font-display text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)]">
          Tu cuenta no tiene permiso de superadmin.
        </h1>
        <p className="mt-2 max-w-[420px] text-[13.5px] text-[var(--ink-muted)]">
          Inicia sesión con una cuenta autorizada o pide a ops que te eleve el rol.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={loggingOut}
          className="mt-8"
          onClick={() => void handleLogout()}
        >
          {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
