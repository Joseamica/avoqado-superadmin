import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Landmark, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox'
import { QueryError } from '@/shared/components/QueryError'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  useMerchantAccounts,
  useTerminalDetail,
  useTpvSettings,
  useUpdateTerminal,
  useUpdateTpvSettings,
} from './use-terminals'
import {
  humanizeTerminalStatus,
  humanizeTerminalType,
  TERMINAL_STATUS_TONE,
  type Terminal,
  type TerminalStatus,
} from './types'
import type { TpvSettings } from './api'

/**
 * Página de configuración completa de una terminal. Reemplaza el
 * `TerminalResourcePlaceholder kind="settings"`. Cinco secciones:
 *
 *   1. **Identidad** — name, brand, model (PATCH /superadmin/terminals/:id)
 *   2. **Estado y operación** — status changer
 *   3. **Merchant accounts** — multi-select (mismos endpoint)
 *   4. **Módulos del home screen** — toggles de `show*` (PUT /tpv/:id/settings)
 *   5. **Pagos habilitados** — `enable*` toggles (mismo endpoint)
 *
 * UX: cada sección tiene su propio botón "Guardar" — sólo se envían los
 * campos modificados de esa sección, y el save es atómico por surface
 * (no batched). Ventaja: el operador sabe exactamente qué se cambió.
 *
 * Las acciones operativas (RESTART, FACTORY_RESET, etc.) NO viven aquí —
 * eso es responsabilidad del `TerminalActionDrawer` desde `/terminals`.
 */
export function TerminalSettingsPage() {
  const { terminalId } = useParams<{ terminalId: string }>()
  const detailQuery = useTerminalDetail(terminalId)
  const settingsQuery = useTpvSettings(terminalId)

  if (!terminalId) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <p className="text-[14px] text-[var(--ink-muted)]">Falta terminalId.</p>
      </div>
    )
  }

  if (detailQuery.isError) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <BackToTerminals />
        <QueryError
          className="mt-5"
          error={detailQuery.error}
          context="cargar la terminal"
          onRetry={() => detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      </div>
    )
  }

  const terminal = detailQuery.data
  const settings = settingsQuery.data

  if (detailQuery.isLoading || !terminal) {
    return (
      <div className="mx-auto max-w-[840px] px-4 py-10 sm:px-6">
        <BackToTerminals />
        <SkeletonHeader />
      </div>
    )
  }

  if (terminal === null) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <BackToTerminals />
        <div className="mt-6 rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-6">
          <p className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            Terminal no encontrada
          </p>
          <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
            El ID <code className="font-mono text-[12px] text-[var(--ink)]">{terminalId}</code> no
            corresponde a ninguna terminal accesible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[840px] px-4 py-8 sm:px-6 md:px-8 lg:py-10">
      <BackToTerminals />
      <Header terminal={terminal} />

      <div className="mt-8 space-y-8">
        <IdentitySection terminal={terminal} />
        <StatusSection terminal={terminal} />
        <MerchantSection terminal={terminal} />
        {settings ? (
          <>
            <HomeModulesSection terminalId={terminal.id} settings={settings} />
            <PaymentsSection terminalId={terminal.id} settings={settings} />
          </>
        ) : settingsQuery.isError ? (
          <QueryError
            error={settingsQuery.error}
            context="cargar los settings de la terminal"
            onRetry={() => settingsQuery.refetch()}
            isRetrying={settingsQuery.isFetching}
          />
        ) : (
          <SettingsSkeletonBlock />
        )}
      </div>
    </div>
  )
}

/* ─── Header ──────────────────────────────────────────────────── */

function BackToTerminals() {
  return (
    <Link
      to="/terminals"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Terminals
    </Link>
  )
}

function Header({ terminal }: { terminal: Terminal }) {
  return (
    <header className="mt-4">
      <div className="flex items-center gap-2">
        <Badge tone="accent">Settings</Badge>
        <Badge tone={TERMINAL_STATUS_TONE[terminal.status]}>
          {humanizeTerminalStatus(terminal.status)}
        </Badge>
      </div>
      <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-[32px]">
        Configurar {terminal.name}
      </h1>
      <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
        <span className="font-mono">{terminal.serialNumber || 'Sin serial'}</span>
        <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
        {humanizeTerminalType(terminal.type)}
        <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
        <Link to={`/venues/${terminal.venueId}`} className="hover:text-[var(--accent)]">
          {terminal.venue.name}
        </Link>
      </p>
    </header>
  )
}

function SkeletonHeader() {
  return (
    <header className="mt-5">
      <div className="h-5 w-20 animate-pulse rounded-[3px] bg-[var(--canvas-sunken)]" />
      <div className="mt-3 h-9 w-72 animate-pulse rounded-[4px] bg-[var(--canvas-sunken)]" />
      <div className="mt-3 h-4 w-48 animate-pulse rounded-[4px] bg-[var(--canvas-sunken)]" />
    </header>
  )
}

function SettingsSkeletonBlock() {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-8 text-center">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--ink-faint)]" aria-hidden />
      <p className="mt-3 text-[12.5px] text-[var(--ink-muted)]">
        Cargando configuración de la terminal…
      </p>
    </div>
  )
}

/* ─── Section primitive ───────────────────────────────────────── */

function Section({
  title,
  subtitle,
  isDirty,
  isSaving,
  onSave,
  onReset,
  children,
}: {
  title: string
  subtitle?: string
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
  onReset: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas)]">
      <header className="flex flex-col gap-2 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">{subtitle}</p>}
        </div>
        {isDirty && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={isSaving}
              className="h-8 rounded-[4px] px-3 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {isSaving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

/* ─── 1. Identidad ───────────────────────────────────────────── */

function IdentitySection({ terminal }: { terminal: Terminal }) {
  const updateMutation = useUpdateTerminal()
  const [draft, setDraft] = useState({
    name: terminal.name,
    brand: terminal.brand ?? '',
    model: terminal.model ?? '',
  })

  // Reset draft cuando llega nueva versión del terminal desde el backend.
  useEffect(() => {
    setDraft({
      name: terminal.name,
      brand: terminal.brand ?? '',
      model: terminal.model ?? '',
    })
  }, [terminal.name, terminal.brand, terminal.model])

  const isDirty =
    draft.name !== terminal.name ||
    draft.brand !== (terminal.brand ?? '') ||
    draft.model !== (terminal.model ?? '')

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    try {
      await updateMutation.mutateAsync({
        terminalId: terminal.id,
        payload: {
          name: draft.name.trim() || undefined,
          brand: draft.brand.trim() || undefined,
          model: draft.model.trim() || undefined,
        },
      })
      toast.success('Identidad actualizada')
    } catch (e) {
      const info = inspectApiError(e, 'guardar la identidad')
      toast.error(info.title, { description: info.description })
    }
  }

  return (
    <Section
      title="Identidad"
      subtitle="Nombre interno, marca y modelo del hardware."
      isDirty={isDirty}
      isSaving={updateMutation.isPending}
      onSave={() => handleSubmit()}
      onReset={() =>
        setDraft({
          name: terminal.name,
          brand: terminal.brand ?? '',
          model: terminal.model ?? '',
        })
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="settings-name" label="Nombre interno">
          <input
            id="settings-name"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className={inputClass()}
            placeholder="TPV Barra"
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="settings-brand" label="Marca">
            <input
              id="settings-brand"
              type="text"
              value={draft.brand}
              onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
              className={inputClass()}
              placeholder="PAX / NEXGO / Apple…"
            />
          </FormField>
          <FormField id="settings-model" label="Modelo">
            <input
              id="settings-model"
              type="text"
              value={draft.model}
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              className={inputClass()}
              placeholder="A910s / V200c / iPad Pro 12.9"
            />
          </FormField>
        </div>
      </form>
    </Section>
  )
}

/* ─── 2. Status changer ──────────────────────────────────────── */

const STATUS_OPTIONS: ComboboxOption[] = [
  { value: 'ACTIVE', label: 'Activa', description: 'Recibe pagos y opera normalmente' },
  {
    value: 'INACTIVE',
    label: 'Inactiva',
    description: 'No opera, pero queda registrada. Se reactiva fácil.',
  },
  {
    value: 'MAINTENANCE',
    label: 'En mantenimiento',
    description: 'Bloquea operación, muestra pantalla de mantenimiento al staff.',
  },
  {
    value: 'PENDING_ACTIVATION',
    label: 'Sin activar',
    description: 'Registrada pero nunca envió heartbeat. Para devolverla a este estado.',
  },
  {
    value: 'RETIRED',
    label: 'Retirada',
    description:
      'Terminal dada de baja permanente. No puede volver a operar (se mantiene por auditoría).',
  },
]

function StatusSection({ terminal }: { terminal: Terminal }) {
  const updateMutation = useUpdateTerminal()
  const [draft, setDraft] = useState<TerminalStatus>(terminal.status)

  useEffect(() => {
    setDraft(terminal.status)
  }, [terminal.status])

  const isDirty = draft !== terminal.status

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        terminalId: terminal.id,
        payload: { status: draft },
      })
      toast.success('Estado actualizado', {
        description: `${terminal.name} ahora está en ${humanizeTerminalStatus(draft)}.`,
      })
    } catch (e) {
      const info = inspectApiError(e, 'cambiar el estado')
      toast.error(info.title, { description: info.description })
    }
  }

  const isDangerous = draft === 'RETIRED'

  return (
    <Section
      title="Estado y operación"
      subtitle="Cómo se comporta la terminal a alto nivel."
      isDirty={isDirty}
      isSaving={updateMutation.isPending}
      onSave={handleSave}
      onReset={() => setDraft(terminal.status)}
    >
      <FormField id="settings-status" label="Estado de la terminal">
        <Combobox
          value={draft}
          onChange={(v) => setDraft(v as TerminalStatus)}
          options={STATUS_OPTIONS}
          placeholder="Selecciona el estado"
          searchPlaceholder="Buscar estado…"
        />
      </FormField>
      {isDangerous && draft !== terminal.status && (
        <p className="mt-3 rounded-[6px] border border-[var(--danger)]/30 bg-[var(--danger-faint)]/40 px-3 py-2 text-[12px] text-[var(--danger)]">
          <span className="font-semibold">Acción irreversible:</span> retirar la terminal la marca
          como dada de baja permanente. Mantienes el registro para auditoría pero la terminal no
          puede volver a operar (ni con un comando REACTIVATE).
        </p>
      )}
    </Section>
  )
}

/* ─── 3. Merchant accounts ───────────────────────────────────── */

function MerchantSection({ terminal }: { terminal: Terminal }) {
  const updateMutation = useUpdateTerminal()
  const merchantsQuery = useMerchantAccounts()
  const [draft, setDraft] = useState<Set<string>>(() => new Set(terminal.assignedMerchantIds))

  useEffect(() => {
    setDraft(new Set(terminal.assignedMerchantIds))
  }, [terminal.assignedMerchantIds])

  const merchants = merchantsQuery.data ?? []
  const isDirty = useMemo(() => {
    if (draft.size !== terminal.assignedMerchantIds.length) return true
    return !terminal.assignedMerchantIds.every((id) => draft.has(id))
  }, [draft, terminal.assignedMerchantIds])

  const toggle = (id: string) =>
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        terminalId: terminal.id,
        payload: { assignedMerchantIds: [...draft] },
      })
      toast.success(`${draft.size} merchant${draft.size === 1 ? '' : 's'} asignados`)
    } catch (e) {
      const info = inspectApiError(e, 'guardar merchants asignados')
      toast.error(info.title, { description: info.description })
    }
  }

  return (
    <Section
      title="Merchant accounts"
      subtitle={
        merchantsQuery.data
          ? `${draft.size} de ${merchants.length} asignados. La terminal puede procesar pagos en cualquiera de los assigned merchants.`
          : 'Cargando merchant accounts…'
      }
      isDirty={isDirty}
      isSaving={updateMutation.isPending}
      onSave={handleSave}
      onReset={() => setDraft(new Set(terminal.assignedMerchantIds))}
    >
      {merchantsQuery.isLoading ? (
        <p className="text-[12.5px] text-[var(--ink-faint)]">Cargando merchant accounts…</p>
      ) : merchants.length === 0 ? (
        <div className="rounded-[6px] border border-dashed border-[var(--line-strong)] bg-[var(--canvas-sunken)] p-4 text-center">
          <Landmark className="mx-auto h-4 w-4 text-[var(--ink-faint)]" aria-hidden />
          <p className="mt-2 text-[12.5px] text-[var(--ink-muted)]">
            No hay merchant accounts disponibles.
          </p>
          <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
            Crea uno desde la sección de Merchants (próximamente).
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {merchants.map((m) => {
            const isSelected = draft.has(m.id)
            return (
              <li key={m.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-[6px] border p-3 transition-colors',
                    isSelected
                      ? 'border-[var(--accent-line)] bg-[var(--accent-faint)]'
                      : 'border-[var(--line)] hover:bg-[var(--canvas-sunken)]',
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggle(m.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)]">{m.displayName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                      <span className="font-mono">{m.providerName}</span>
                      {m.alias && (
                        <>
                          <span className="mx-1.5 opacity-50">·</span>
                          <span>{m.alias}</span>
                        </>
                      )}
                      {m.externalMerchantId && (
                        <>
                          <span className="mx-1.5 opacity-50">·</span>
                          <span className="font-mono">{m.externalMerchantId}</span>
                        </>
                      )}
                    </p>
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/* ─── 4. Módulos del home ──────────────────────────────────── */

interface ModuleDef {
  key: keyof TpvSettings
  label: string
  description: string
}

const HOME_MODULES: ModuleDef[] = [
  {
    key: 'showQuickPayment',
    label: 'Cobro rápido',
    description: 'Pago directo sin orden — el staff teclea monto y cobra.',
  },
  {
    key: 'showOrderManagement',
    label: 'Gestión de órdenes',
    description: 'Tomar pedidos, mesas, modificar carrito antes de cobrar.',
  },
  {
    key: 'showCheckout',
    label: 'Checkout',
    description: 'Pantalla de cobro al cliente con total + propina + recibo.',
  },
  {
    key: 'showPayments',
    label: 'Pagos recientes',
    description: 'Ver transacciones del día / refunds / cancelaciones.',
  },
  {
    key: 'showReports',
    label: 'Reportes',
    description: 'Cuadre de caja, ventas por día, propinas, etc.',
  },
  {
    key: 'showGoals',
    label: 'Metas',
    description: 'Goals del staff — ventas objetivo, propinas, KPIs personales.',
  },
  {
    key: 'showMessages',
    label: 'Mensajes',
    description: 'Inbox para mensajes del superadmin / gerente del venue.',
  },
  {
    key: 'showTrainings',
    label: 'Trainings',
    description: 'Capacitación interactiva sobre el uso del TPV.',
  },
  {
    key: 'showSupport',
    label: 'Soporte',
    description: 'Acceso a help docs y contacto con soporte Avoqado.',
  },
]

function HomeModulesSection({
  terminalId,
  settings,
}: {
  terminalId: string
  settings: TpvSettings
}) {
  return (
    <SettingsBooleanSection
      title="Módulos del home screen"
      subtitle="Qué botones ve el staff al entrar a AvoqadoPOS. Apagar uno NO desactiva la funcionalidad — sólo lo esconde del home."
      terminalId={terminalId}
      settings={settings}
      modules={HOME_MODULES}
    />
  )
}

/* ─── 5. Pagos habilitados ───────────────────────────────────── */

const PAYMENT_MODULES: ModuleDef[] = [
  {
    key: 'enableCashPayments',
    label: 'Pagos en efectivo',
    description: 'Permite registrar pagos en cash desde la terminal.',
  },
  {
    key: 'enableCardPayments',
    label: 'Pagos con tarjeta',
    description: 'Permite cobrar con tarjeta (chip, contactless, banda).',
  },
  {
    key: 'enableBarcodeScanner',
    label: 'Lector de código de barras',
    description: 'Habilita el scanner integrado para productos de inventario.',
  },
  {
    key: 'enableSerializedInventory',
    label: 'Inventario serializado',
    description: 'Captura serial de cada item vendido (electrónica, telecomunicaciones).',
  },
]

function PaymentsSection({ terminalId, settings }: { terminalId: string; settings: TpvSettings }) {
  return (
    <SettingsBooleanSection
      title="Pagos y captura"
      subtitle="Métodos de pago y módulos de captura habilitados en esta terminal."
      terminalId={terminalId}
      settings={settings}
      modules={PAYMENT_MODULES}
    />
  )
}

/**
 * Sección genérica para grupos de toggles booleanos sobre TpvSettings.
 * Comparte la lógica de draft → diff → save entre "Módulos" y "Pagos".
 */
function SettingsBooleanSection({
  title,
  subtitle,
  terminalId,
  settings,
  modules,
}: {
  title: string
  subtitle: string
  terminalId: string
  settings: TpvSettings
  modules: ModuleDef[]
}) {
  const updateMutation = useUpdateTpvSettings()
  const initialFromSettings = useMemo(() => {
    const obj: Record<string, boolean> = {}
    for (const m of modules) {
      obj[m.key as string] = !!settings[m.key as keyof TpvSettings]
    }
    return obj
  }, [settings, modules])

  const [draft, setDraft] = useState<Record<string, boolean>>(initialFromSettings)
  useEffect(() => {
    setDraft(initialFromSettings)
  }, [initialFromSettings])

  const isDirty = useMemo(
    () => modules.some((m) => draft[m.key as string] !== initialFromSettings[m.key as string]),
    [draft, initialFromSettings, modules],
  )

  const toggle = (key: string) => setDraft((d) => ({ ...d, [key]: !d[key] }))

  const handleSave = async () => {
    // Sólo enviamos los campos que cambiaron — el backend permite partial PUT.
    const patch: Partial<TpvSettings> = {}
    for (const m of modules) {
      const k = m.key as string
      if (draft[k] !== initialFromSettings[k]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(patch as any)[k] = draft[k]
      }
    }
    try {
      await updateMutation.mutateAsync({ terminalId, patch })
      toast.success(`${title} guardado`)
    } catch (e) {
      const info = inspectApiError(e, `guardar ${title.toLowerCase()}`)
      toast.error(info.title, { description: info.description })
    }
  }

  const visibleCount = modules.filter((m) => draft[m.key as string]).length

  return (
    <Section
      title={title}
      subtitle={`${visibleCount} de ${modules.length} activos · ${subtitle}`}
      isDirty={isDirty}
      isSaving={updateMutation.isPending}
      onSave={handleSave}
      onReset={() => setDraft(initialFromSettings)}
    >
      <ul className="space-y-1.5">
        {modules.map((m) => {
          const isOn = !!draft[m.key as string]
          return (
            <li key={m.key as string}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-[6px] border p-3 transition-colors',
                  isOn
                    ? 'border-[var(--accent-line)] bg-[var(--accent-faint)]'
                    : 'border-[var(--line)] hover:bg-[var(--canvas-sunken)]',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
                    isOn
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--line-strong)]',
                  )}
                >
                  {isOn ? (
                    <CheckCircle2 className="h-3 w-3 text-[var(--canvas)]" aria-hidden />
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(m.key as string)}
                  className="sr-only"
                  aria-label={m.label}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[var(--ink)]">{m.label}</p>
                    {isOn ? (
                      <Eye className="h-3 w-3 text-[var(--accent)]" aria-hidden />
                    ) : (
                      <EyeOff className="h-3 w-3 text-[var(--ink-faint)]" aria-hidden />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-muted)]">
                    {m.description}
                  </p>
                </div>
              </label>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function FormField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium tracking-[-0.005em] text-[var(--ink)]">
        {label}
      </label>
      {children}
    </div>
  )
}

function inputClass() {
  return 'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent-line)]'
}
