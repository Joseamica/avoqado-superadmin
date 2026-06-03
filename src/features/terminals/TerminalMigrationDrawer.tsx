import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import { useVenues } from '@/features/venues/use-venues'
import {
  useMerchantAccounts,
  useMigrateCancel,
  useMigrateExecute,
  useMigratePreflight,
  useMigrateStatus,
} from './use-terminals'
import type { MerchantAccountOption, MigratePreflightResult } from './api'
import type { Terminal } from './types'

/**
 * Wizard de migración de una terminal a otro venue. 3 pasos en una máquina de
 * estados (`pick → preflight → progress`):
 *
 *   1. **pick** — elegir el venue destino + (opcional) merchants a asignar.
 *      Dispara el preflight de validación.
 *   2. **preflight** — render de blockers (danger, bloquean) + warnings
 *      (atención). Si `canProceed`, una compuerta destructiva de confirmación
 *      tipiada (escribir el serial) antes de ejecutar.
 *   3. **progress** — polling del estado: checklist (comando entregado / rebote
 *      post-wipe / online bajo el nuevo venue) + nota de timeout ~10 min.
 *      Mientras no se confirme, botón "Cancelar migración". Al confirmar,
 *      "Finalizar".
 *
 * Reanudación: si llega `resumeMigration`, el drawer abre directo en `progress`
 * con ese `commandId` — para terminals que ya están migrando cuando se abre
 * la consola.
 *
 * Por qué un drawer aparte y no una sección del action drawer: la migración es
 * un flujo largo con estado propio (polling) que debe sobrevivir aunque el
 * operador navegue; aislarlo evita que su estado se mezcle con las acciones
 * rápidas.
 */

const REBOUND_TIMEOUT_MS = 10 * 60_000

interface ResumeMigration {
  inProgress: boolean
  commandId: string
  toVenueId: string
}

interface TerminalMigrationDrawerProps {
  terminal: Terminal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, el drawer abre directo en `progress` con ese commandId. */
  resumeMigration?: ResumeMigration | null
}

type Step = 'pick' | 'preflight' | 'progress'

export function TerminalMigrationDrawer({
  terminal,
  open,
  onOpenChange,
  resumeMigration,
}: TerminalMigrationDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {terminal ? (
          <MigrationDrawerBody
            // Key fuerza re-mount (y reset de estado) cuando cambia la terminal
            // o el modo de reanudación. Sin esto el wizard arrastraría el venue
            // elegido de la terminal anterior.
            key={`${terminal.id}:${resumeMigration?.commandId ?? 'new'}`}
            terminal={terminal}
            resumeMigration={resumeMigration ?? null}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className="p-8 text-center text-[13px] text-[var(--ink-muted)]">
            No hay terminal seleccionada.
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function MigrationDrawerBody({
  terminal,
  resumeMigration,
  onClose,
}: {
  terminal: Terminal
  resumeMigration: ResumeMigration | null
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>(resumeMigration?.inProgress ? 'progress' : 'pick')
  const [toVenueId, setToVenueId] = useState(resumeMigration?.toVenueId ?? '')
  const [merchantIds, setMerchantIds] = useState<Set<string>>(new Set())
  const [preflight, setPreflight] = useState<MigratePreflightResult | null>(null)
  const [commandId, setCommandId] = useState<string | null>(resumeMigration?.commandId ?? null)
  const [confirmInput, setConfirmInput] = useState('')

  const venuesQuery = useVenues({})
  const merchantsQuery = useMerchantAccounts()
  const preflightMutation = useMigratePreflight()
  const executeMutation = useMigrateExecute()

  // Excluye el venue actual de la terminal — no tiene sentido "migrar" al mismo.
  const venueOptions: ComboboxOption[] = useMemo(() => {
    const list = venuesQuery.data ?? []
    return list
      .filter((v) => v.id !== terminal.venueId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({
        value: v.id,
        label: v.name,
        description: `${v.organization.name} · ${v.slug}`,
        searchTokens: `${v.slug} ${v.organization.name}`,
      }))
  }, [venuesQuery.data, terminal.venueId])

  const merchantOptions = useMemo(() => merchantsQuery.data ?? [], [merchantsQuery.data])
  const destinationVenueName = useMemo(
    () => venuesQuery.data?.find((v) => v.id === toVenueId)?.name ?? null,
    [venuesQuery.data, toVenueId],
  )

  const toggleMerchant = (id: string) => {
    setMerchantIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handlePreflight() {
    if (!toVenueId) {
      toast.error('Selecciona el venue destino')
      return
    }
    preflightMutation.mutate(
      { terminalId: terminal.id, toVenueId },
      {
        onSuccess: (result) => {
          setPreflight(result)
          setStep('preflight')
        },
        onError: (error) => {
          const info = inspectApiError(error, 'verificar el destino de la migración')
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  function handleExecute() {
    const expected = terminal.serialNumber || terminal.name
    if (confirmInput.trim() !== expected) {
      toast.error('Confirmación incorrecta', {
        description: `Debes escribir exactamente "${expected}" para autorizar la migración.`,
      })
      return
    }
    executeMutation.mutate(
      {
        terminalId: terminal.id,
        toVenueId,
        assignedMerchantIds: merchantIds.size > 0 ? [...merchantIds] : undefined,
      },
      {
        onSuccess: (result) => {
          setCommandId(result.commandId)
          setStep('progress')
          toast.success('Migración iniciada', {
            description: 'La terminal se restablecerá y reaparecerá bajo el nuevo venue.',
          })
        },
        onError: (error) => {
          const info = inspectApiError(error, 'iniciar la migración')
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <Badge tone="warn">Migración</Badge>
          {step === 'progress' && <Badge tone="info">En progreso</Badge>}
        </div>
        <DrawerTitle className="mt-2">Migrar a otro venue</DrawerTitle>
        <DrawerSubtitle>
          {terminal.serialNumber ? (
            <span className="font-mono">{terminal.serialNumber}</span>
          ) : (
            <span className="italic">{terminal.name}</span>
          )}
          <span className="mx-1.5 opacity-50">·</span>
          <span>desde {terminal.venue.name}</span>
        </DrawerSubtitle>
      </DrawerHeader>

      <DrawerBody className="space-y-8">
        {step === 'pick' && (
          <PickStep
            terminal={terminal}
            toVenueId={toVenueId}
            onChangeVenue={setToVenueId}
            venueOptions={venueOptions}
            venuesLoading={venuesQuery.isLoading}
            merchants={merchantOptions}
            merchantsLoading={merchantsQuery.isLoading}
            selectedMerchants={merchantIds}
            onToggleMerchant={toggleMerchant}
            onVerify={handlePreflight}
            verifying={preflightMutation.isPending}
          />
        )}

        {step === 'preflight' && preflight && (
          <PreflightStep
            terminal={terminal}
            preflight={preflight}
            destinationVenueName={destinationVenueName}
            confirmInput={confirmInput}
            onChangeConfirm={setConfirmInput}
            onBack={() => {
              setStep('pick')
              setConfirmInput('')
            }}
            onExecute={handleExecute}
            executing={executeMutation.isPending}
          />
        )}

        {step === 'progress' && commandId && (
          <ProgressStep terminalId={terminal.id} commandId={commandId} onClose={onClose} />
        )}
      </DrawerBody>
    </>
  )
}

/* ─── Paso 1: pick ─────────────────────────────────────────────── */

function PickStep({
  terminal,
  toVenueId,
  onChangeVenue,
  venueOptions,
  venuesLoading,
  merchants,
  merchantsLoading,
  selectedMerchants,
  onToggleMerchant,
  onVerify,
  verifying,
}: {
  terminal: Terminal
  toVenueId: string
  onChangeVenue: (id: string) => void
  venueOptions: ComboboxOption[]
  venuesLoading: boolean
  merchants: MerchantAccountOption[]
  merchantsLoading: boolean
  selectedMerchants: Set<string>
  onToggleMerchant: (id: string) => void
  onVerify: () => void
  verifying: boolean
}) {
  return (
    <>
      <Section title="Venue destino">
        <p className="text-[12.5px] leading-snug text-[var(--ink-muted)]">
          La terminal se re-vinculará a este venue y se restablecerá de fábrica. Sus pagos pasarán a
          liquidar al venue destino.
        </p>
        <div className="mt-2.5">
          <Combobox
            value={toVenueId}
            onChange={onChangeVenue}
            options={venueOptions}
            disabled={venuesLoading}
            placeholder={venuesLoading ? 'Cargando venues…' : 'Selecciona venue destino'}
            searchPlaceholder="Buscar por nombre, slug u organización…"
            emptyLabel="Sin venues que coincidan"
          />
        </div>
      </Section>

      {/* El picker de merchants sólo se muestra si hay merchants disponibles —
          si el destino no tiene ninguno, la terminal hereda el primario del
          venue y no hay nada que elegir. */}
      {(merchantsLoading || merchants.length > 0) && (
        <Section title="Merchant accounts (opcional)">
          <p className="text-[12.5px] leading-snug text-[var(--ink-muted)]">
            Cuentas a asignar en el destino. Si no eliges ninguna, la terminal usará el merchant
            primario del venue destino.
          </p>
          <div className="mt-2.5">
            <MerchantPicker
              merchants={merchants}
              loading={merchantsLoading}
              selected={selectedMerchants}
              onToggle={onToggleMerchant}
            />
          </div>
        </Section>
      )}

      <div className="flex justify-end border-t border-[var(--line)] pt-5">
        <Button size="lg" onClick={onVerify} disabled={!toVenueId || verifying} className="gap-2">
          {verifying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          )}
          Verificar destino
        </Button>
      </div>

      <p className="text-center text-[11px] text-[var(--ink-faint)]">
        Terminal: <span className="font-mono">{terminal.name}</span>
      </p>
    </>
  )
}

function MerchantPicker({
  merchants,
  loading,
  selected,
  onToggle,
}: {
  merchants: MerchantAccountOption[]
  loading: boolean
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (loading) {
    return <p className="text-[12.5px] text-[var(--ink-faint)]">Cargando merchant accounts…</p>
  }
  if (merchants.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        El venue destino no tiene merchant accounts disponibles. La terminal heredará el primario
        del venue.
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {merchants.map((m) => {
        const isSelected = selected.has(m.id)
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
                onCheckedChange={() => onToggle(m.id)}
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
  )
}

/* ─── Paso 2: preflight ────────────────────────────────────────── */

function PreflightStep({
  terminal,
  preflight,
  destinationVenueName,
  confirmInput,
  onChangeConfirm,
  onBack,
  onExecute,
  executing,
}: {
  terminal: Terminal
  preflight: MigratePreflightResult
  destinationVenueName: string | null
  confirmInput: string
  onChangeConfirm: (v: string) => void
  onBack: () => void
  onExecute: () => void
  executing: boolean
}) {
  const expected = terminal.serialNumber || terminal.name

  return (
    <>
      <Section title="Resultado de la verificación">
        <p className="text-[12.5px] leading-snug text-[var(--ink-muted)]">
          Migrando a{' '}
          <span className="font-semibold text-[var(--ink)]">
            {destinationVenueName ?? 'el venue destino'}
          </span>
          .
        </p>

        {preflight.blockers.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {preflight.blockers.map((blocker) => (
              <Banner key={blocker.code} tone="danger" icon={ShieldAlert}>
                {blocker.message}
              </Banner>
            ))}
          </div>
        )}

        {preflight.warnings.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {preflight.warnings.map((warning) => (
              <Banner key={warning.code} tone="warn" icon={AlertTriangle}>
                {warning.message}
              </Banner>
            ))}
          </div>
        )}

        {preflight.blockers.length === 0 && preflight.warnings.length === 0 && (
          <Banner tone="success" icon={CheckCircle2} className="mt-3">
            Sin bloqueadores ni advertencias — la terminal puede migrarse.
          </Banner>
        )}
      </Section>

      {preflight.canProceed ? (
        <section className="rounded-[8px] border border-[var(--danger)]/30 bg-[var(--danger-faint)]/40 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
            <h3 className="text-[13px] font-semibold text-[var(--danger)]">Autorizar migración</h3>
          </div>
          <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">
            La terminal se restablecerá de fábrica (borra TODA la data local) y quedará vinculada al
            nuevo venue. No se puede deshacer una vez completada. Escribe{' '}
            <code className="font-mono text-[11px] text-[var(--ink)]">{expected}</code> para
            autorizar.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => onChangeConfirm(e.target.value)}
              placeholder={expected}
              autoFocus
              className="h-9 flex-1 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--danger)]"
            />
            <button
              type="button"
              onClick={onExecute}
              disabled={confirmInput.trim() !== expected || executing}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[4px] bg-[var(--danger)] px-3 text-[12px] font-semibold text-white hover:bg-[var(--danger)]/90 disabled:opacity-50"
            >
              {executing && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              Migrar ahora
            </button>
          </div>
        </section>
      ) : (
        <Banner tone="danger" icon={ShieldAlert}>
          Resuelve los bloqueadores de arriba antes de poder migrar esta terminal.
        </Banner>
      )}

      <div className="flex justify-between border-t border-[var(--line)] pt-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-4 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Volver
        </button>
      </div>
    </>
  )
}

/* ─── Paso 3: progress ─────────────────────────────────────────── */

function ProgressStep({
  terminalId,
  commandId,
  onClose,
}: {
  terminalId: string
  commandId: string
  onClose: () => void
}) {
  const statusQuery = useMigrateStatus(terminalId, commandId)
  const cancelMutation = useMigrateCancel()

  const status = statusQuery.data
  const confirmed = status?.confirmed ?? false
  const elapsedMs = status?.elapsedMs ?? 0
  const timedOut = !confirmed && elapsedMs > REBOUND_TIMEOUT_MS

  function handleCancel() {
    cancelMutation.mutate(terminalId, {
      onSuccess: (result) => {
        toast.success('Migración cancelada', {
          description: 'La terminal se restauró a su venue original.',
        })
        // El backend ya restauró el venue; cerramos el wizard.
        void result
        onClose()
      },
      onError: (error) => {
        const info = inspectApiError(error, 'cancelar la migración')
        toast.error(info.title, { description: info.description })
      },
    })
  }

  return (
    <>
      <Section title="Progreso de la migración">
        {statusQuery.isLoading && !status ? (
          <p className="flex items-center gap-2 text-[12.5px] text-[var(--ink-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Consultando estado…
          </p>
        ) : (
          <div className="space-y-1.5">
            <ChecklistRow
              done={status?.commandDelivered ?? false}
              label="Comando entregado a la terminal"
              description="La orden de migración llegó al dispositivo."
            />
            <ChecklistRow
              done={status?.reboundAfterWipe ?? false}
              label="Rebote post-restablecimiento"
              description="La terminal se restableció y volvió a contactar al servidor."
            />
            <ChecklistRow
              done={status?.onlineUnderNewVenue ?? false}
              label="Online bajo el nuevo venue"
              description="La terminal reapareció vinculada al venue destino."
            />
          </div>
        )}
      </Section>

      {confirmed ? (
        <Banner tone="success" icon={CheckCircle2}>
          Migración completada. La terminal ya opera bajo el nuevo venue.
        </Banner>
      ) : timedOut ? (
        <Banner tone="warn" icon={Clock}>
          La terminal no ha reaparecido tras ~10 minutos. Revisa que esté prendida y con red en el
          venue destino. El servidor sigue esperando su rebote; aún puedes cancelar para restaurar
          el venue original.
        </Banner>
      ) : (
        <Banner tone="info" icon={Loader2} spinIcon>
          Esperando a que la terminal complete el restablecimiento y vuelva online. Esto suele
          tardar unos minutos; puede llegar hasta ~10.
        </Banner>
      )}

      <div className="flex justify-end border-t border-[var(--line)] pt-5">
        {confirmed ? (
          <Button size="lg" onClick={onClose} className="gap-2">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Finalizar
          </Button>
        ) : (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-[6px] border border-[var(--danger)]/40 bg-[var(--canvas)] px-4 text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--danger-faint)]/40 disabled:opacity-50"
          >
            {cancelMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            )}
            Cancelar migración
          </button>
        )}
      </div>
    </>
  )
}

function ChecklistRow({
  done,
  label,
  description,
}: {
  done: boolean
  label: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-3">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          done
            ? 'border-[var(--success)] bg-[var(--success)]'
            : 'border-[var(--line-strong)] bg-[var(--canvas)]',
        )}
      >
        {done ? (
          <Check className="h-2.5 w-2.5 text-[var(--canvas)]" aria-hidden />
        ) : (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--ink-faint)]" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[13px] font-semibold',
            done ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]',
          )}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-muted)]">{description}</p>
      </div>
    </div>
  )
}

/* ─── Sub-componentes compartidos ──────────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="eyebrow">{title}</h3>
      <div>{children}</div>
    </section>
  )
}

type BannerTone = 'danger' | 'warn' | 'info' | 'success'

const BANNER_TONE: Record<BannerTone, { border: string; bg: string; icon: string }> = {
  danger: {
    border: 'border-[var(--danger)]/30',
    bg: 'bg-[var(--danger-faint)]/40',
    icon: 'text-[var(--danger)]',
  },
  warn: {
    border: 'border-[var(--warn)]/30',
    bg: 'bg-[var(--warn-faint)]',
    icon: 'text-[var(--warn)]',
  },
  info: {
    border: 'border-[var(--info)]/30',
    bg: 'bg-[var(--info-faint)]/40',
    icon: 'text-[var(--info)]',
  },
  success: {
    border: 'border-[var(--success)]/30',
    bg: 'bg-[var(--success-faint)]/40',
    icon: 'text-[var(--success)]',
  },
}

function Banner({
  tone,
  icon: Icon,
  spinIcon,
  className,
  children,
}: {
  tone: BannerTone
  icon: typeof AlertTriangle
  spinIcon?: boolean
  className?: string
  children: ReactNode
}) {
  const t = BANNER_TONE[tone]
  return (
    <div
      className={cn('flex items-start gap-3 rounded-[6px] border p-3.5', t.border, t.bg, className)}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', t.icon, spinIcon && 'animate-spin')}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--ink)]">{children}</p>
    </div>
  )
}
