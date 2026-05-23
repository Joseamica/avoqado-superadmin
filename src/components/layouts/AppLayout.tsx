import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Terminal,
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
  const [clock, setClock] = useState(() => new Date().toISOString())

  // Suscribe el socket sólo cuando hay sesión superadmin activa.
  useRealtimeInvalidation()

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toISOString()), 30_000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <aside
        aria-label="Navegación principal"
        className="flex w-[244px] flex-col border-r border-[var(--line)] bg-[var(--canvas-sunken)]"
      >
        <div className="px-5 pt-5 pb-4">
          <Brandmark />
        </div>

        <button
          type="button"
          onClick={openPalette}
          aria-label="Abrir paleta de comandos"
          className="mx-3 mb-4 flex items-center justify-between gap-2 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-1.5 text-left text-[12.5px] text-[var(--ink-faint)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--ink-muted)]"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" aria-hidden />
            Buscar
          </span>
          <span className="flex items-center gap-0.5" aria-hidden>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <nav className="flex-1 space-y-5 px-3" aria-label="Secciones">
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
                        className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-[13px] text-[var(--ink-faint)]"
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
                            'flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] font-medium transition-colors',
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
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[4px] border border-[var(--line)] bg-transparent px-2 py-1 text-[11.5px] font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
            >
              <LogOut className="h-3 w-3" aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
