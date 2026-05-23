import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Terminal,
  X,
} from 'lucide-react'
import { Brandmark } from '@/components/Brandmark'
import {
  CommandPalette,
  CommandPaletteProvider,
  useCommandPalette,
} from '@/components/CommandPalette'
import { Kbd } from '@/components/ui/Kbd'
import { useAuth } from '@/context/AuthContext'
import { useRealtimeInvalidation } from '@/hooks/useRealtimeInvalidation'
import type { SessionUser } from '@/services/auth.service'
import { cn } from '@/lib/utils'
import { DEFAULT_TIMEZONE, formatTime, timezoneShort } from '@/lib/datetime'

function fullName(user: SessionUser | null): string | null {
  if (!user) return null
  const parts = [user.firstName, user.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

interface NavGroup {
  label: string
  items: {
    to: string
    label: string
    icon: typeof Activity
    disabled?: boolean
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
      { to: '/activity-log', label: 'Activity log', icon: Activity },
      { to: '/kyc', label: 'KYC', icon: ShieldCheck, disabled: true },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/venues', label: 'Venues', icon: Store, disabled: true },
      { to: '/terminals', label: 'TPVs', icon: Terminal, disabled: true },
      { to: '/merchants', label: 'Merchant accounts', icon: CreditCard, disabled: true },
    ],
  },
  {
    label: 'Configuración',
    items: [{ to: '/settings', label: 'Sistema', icon: Settings2, disabled: true }],
  },
]

export function AppLayout() {
  return (
    <CommandPaletteProvider>
      <AppLayoutShell />
      <CommandPalette />
    </CommandPaletteProvider>
  )
}

function AppLayoutShell() {
  const { user, logout } = useAuth()
  const { open: openPalette } = useCommandPalette()
  const navigate = useNavigate()
  const location = useLocation()
  const [clock, setClock] = useState(() => new Date().toISOString())
  const [mobileOpen, setMobileOpen] = useState(false)

  useRealtimeInvalidation()

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toISOString()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Cierra el drawer cuando cambias de ruta (tap en un nav item).
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Bloquea el scroll del body cuando el drawer mobile está abierto.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [mobileOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Brandmark />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[var(--ink-muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={openPalette}
        aria-label="Abrir paleta de comandos"
        className="mx-3 mb-4 flex h-10 items-center justify-between gap-2 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-left text-[12.5px] text-[var(--ink-faint)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--ink-muted)]"
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" aria-hidden />
          Buscar
        </span>
        <span className="hidden items-center gap-0.5 md:flex" aria-hidden>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3" aria-label="Secciones">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="eyebrow px-2 pb-1.5" id={`nav-group-${group.label}`}>
              {group.label}
            </div>
            <ul className="space-y-px" aria-labelledby={`nav-group-${group.label}`}>
              {group.items.map(({ to, label, icon: Icon, disabled }) => (
                <li key={to}>
                  {disabled ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      aria-label={`${label} — próximamente`}
                      className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-[6px] px-2 py-2 text-[13px] text-[var(--ink-faint)]"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {label}
                      </span>
                      <span className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--ink-faint)]/70">
                        pronto
                      </span>
                    </button>
                  ) : (
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-[6px] px-2 py-2 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-[var(--accent-faint)] text-[var(--accent)]'
                            : 'text-[var(--ink-muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            aria-hidden
                            className={cn(
                              'h-3.5 w-3.5',
                              isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]',
                            )}
                          />
                          {label}
                        </>
                      )}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--line)] px-3 py-3">
        <div
          className="flex items-center justify-between px-2 pb-2 text-[10.5px] text-[var(--ink-faint)]"
          aria-hidden
        >
          <span className="font-mono tabular">
            {formatTime(clock)} {timezoneShort(DEFAULT_TIMEZONE)}
          </span>
          <span className="rounded-[4px] border border-[var(--success)]/25 bg-[var(--success-faint)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.10em] text-[var(--success)]">
            live
          </span>
        </div>
        <div className="rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-2.5">
          <p className="truncate text-[12px] font-medium text-[var(--ink)]">
            {fullName(user) ?? user?.email ?? 'Sin sesión'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-[4px] border border-[var(--line)] bg-transparent px-2 text-[11.5px] font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
          >
            <LogOut className="h-3 w-3" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-[var(--ink)] md:flex-row">
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--canvas-sunken)]/90 px-4 backdrop-blur md:hidden"
        aria-label="Barra superior"
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-[var(--ink)] hover:bg-[var(--canvas)]"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Brandmark />
        <button
          type="button"
          onClick={openPalette}
          aria-label="Buscar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-[var(--ink-muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-[var(--ink)]/55 md:hidden"
        />
      )}

      <aside
        id="mobile-sidebar"
        aria-label="Navegación principal"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[var(--line)] bg-[var(--canvas-sunken)] transition-transform duration-200 ease-out',
          'md:static md:z-auto md:w-[244px] md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {sidebar}
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
