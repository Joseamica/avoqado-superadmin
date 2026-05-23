import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Search,
  Store,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { Kbd } from '@/shared/ui/Kbd'
import { useAuth } from '@/features/auth/use-auth'
import {
  CommandPaletteContext,
  useCommandPalette,
  type CommandPaletteContextValue,
} from './use-command-palette'

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((o) => !o), [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggle()
      } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, toggle, close])

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  )

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
}

interface CommandItem {
  id: string
  label: string
  icon: typeof Activity
  group: 'Navegación' | 'Acciones'
  shortcut?: string
  run: () => void
}

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const items: CommandItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Ir a Resumen',
      icon: LayoutDashboard,
      group: 'Navegación',
      shortcut: 'G D',
      run: () => {
        navigate('/dashboard')
        close()
      },
    },
    {
      id: 'nav-activity',
      label: 'Ir a Activity log',
      icon: Activity,
      group: 'Navegación',
      shortcut: 'G A',
      run: () => {
        navigate('/activity-log')
        close()
      },
    },
    {
      id: 'nav-system-logs',
      label: 'Ir a Logs del sistema',
      icon: ScrollText,
      group: 'Navegación',
      shortcut: 'G L',
      run: () => {
        navigate('/system-logs')
        close()
      },
    },
    {
      id: 'nav-venues',
      label: 'Buscar venues (próximamente)',
      icon: Store,
      group: 'Navegación',
      run: () => close(),
    },
    {
      id: 'nav-kyc',
      label: 'Cola de KYC (próximamente)',
      icon: ShieldCheck,
      group: 'Navegación',
      run: () => close(),
    },
    {
      id: 'nav-terminals',
      label: 'TPV terminales (próximamente)',
      icon: Terminal,
      group: 'Navegación',
      run: () => close(),
    },
    {
      id: 'action-logout',
      label: 'Cerrar sesión',
      icon: LogOut,
      group: 'Acciones',
      run: async () => {
        await logout()
        navigate('/login', { replace: true })
        close()
      },
    },
  ]

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--ink)]/45 px-4 pt-[16vh]"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] shadow-[0_24px_60px_-20px_oklch(0.20_0.012_130_/_0.25)]"
      >
        <Command label="Paleta de comandos" loop>
          <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-3">
            <Search className="h-4 w-4 text-[var(--ink-faint)]" aria-hidden />
            <Command.Input
              autoFocus
              placeholder="Buscar venues, ejecutar acciones…"
              aria-label="Buscar acción o venue"
              className="flex-1 bg-transparent text-[14.5px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none"
            />
            <Kbd>esc</Kbd>
          </div>
          <Command.List className="max-h-[360px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-[12px] text-[var(--ink-faint)]">
              Nada coincide. Intenta otra cosa.
            </Command.Empty>
            {(['Navegación', 'Acciones'] as const).map((groupName) => (
              <Command.Group
                key={groupName}
                heading={groupName}
                className="px-1 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2"
              >
                {items
                  .filter((item) => item.group === groupName)
                  .map((item) => {
                    const Icon = item.icon
                    return (
                      <Command.Item
                        key={item.id}
                        onSelect={item.run}
                        className="flex h-9 cursor-pointer items-center justify-between gap-3 rounded-[6px] px-2.5 text-[14px] text-[var(--ink)] aria-selected:bg-[var(--canvas-sunken)] aria-selected:text-[var(--ink)]"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden />
                          {item.label}
                        </span>
                        {item.shortcut && (
                          <span className="font-mono text-[10.5px] text-[var(--ink-faint)]">
                            {item.shortcut}
                          </span>
                        )}
                      </Command.Item>
                    )
                  })}
              </Command.Group>
            ))}
          </Command.List>
          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2 text-[10.5px] text-[var(--ink-faint)]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                navegar
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd>
                seleccionar
              </span>
            </div>
            <span className="tracking-[0.10em] uppercase">avoqado · superadmin</span>
          </div>
        </Command>
      </div>
    </div>
  )
}
