import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRightLeft,
  Box,
  Copy,
  Eraser,
  ExternalLink,
  FileDown,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldOff,
  Trash2,
  UserPlus,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { QueryError } from '@/shared/components/QueryError'
import { Badge } from '@/shared/ui/Badge'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { Tooltip } from '@/shared/ui/Tooltip'
import { TerminalMigrationDrawer } from './TerminalMigrationDrawer'
import { GrantAccessDrawer } from './GrantAccessDrawer'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatDateTime, formatRelative } from '@/shared/lib/datetime'
import {
  useAppVersions,
  useGenerateActivationCode,
  useRemoteActivate,
  useTerminalCommand,
  useTerminalCommands,
} from './use-terminals'
import {
  canBeActivated,
  humanizeTerminalStatus,
  humanizeTerminalType,
  isTerminalOnline,
  TERMINAL_STATUS_TONE,
  TERMINAL_TYPE_TONE,
  type Terminal,
  type TpvCommand,
} from './types'

/**
 * Drawer de acciones para una terminal. Se abre cuando el operador click
 * un row en la lista. Contiene en una sola vista:
 *
 *   1. Header — identidad y status en tiempo real
 *   2. Estado actual — chips con online/offline, locked, version, IP
 *   3. Acciones rápidas — botones agrupados por severidad
 *   4. Activación — visible sólo si el terminal aún no se activa
 *   5. Acciones destructivas — collapsable, con typed-confirm
 *   6. Configuración completa — link a /terminals/:id/settings (placeholder)
 *
 * Las acciones safe se ejecutan al click (toast confirma encolado). Las
 * destructivas (`FACTORY_RESET`, `SHUTDOWN`) requieren typed-confirm con
 * el serial number del terminal.
 */
interface TerminalActionDrawerProps {
  terminal: Terminal | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TerminalActionDrawer({ terminal, open, onOpenChange }: TerminalActionDrawerProps) {
  // Reset state interno cada vez que se abre el drawer con un terminal nuevo.
  const [danger, setDanger] = useState<TpvCommand | null>(null)
  const [confirmInput, setConfirmInput] = useState('')

  useEffect(() => {
    if (!open) {
      setDanger(null)
      setConfirmInput('')
    }
  }, [open, terminal?.id])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {terminal ? (
          <TerminalActionDrawerBody
            terminal={terminal}
            danger={danger}
            setDanger={setDanger}
            confirmInput={confirmInput}
            setConfirmInput={setConfirmInput}
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

function TerminalActionDrawerBody({
  terminal,
  danger,
  setDanger,
  confirmInput,
  setConfirmInput,
  onClose,
}: {
  terminal: Terminal
  danger: TpvCommand | null
  setDanger: (d: TpvCommand | null) => void
  confirmInput: string
  setConfirmInput: (v: string) => void
  onClose: () => void
}) {
  const online = isTerminalOnline(terminal)
  const inMaintenance = terminal.status === 'MAINTENANCE'
  const locked = terminal.isLocked
  const canActivate = canBeActivated(terminal)
  const migrating = terminal.migration?.inProgress ?? false

  const [migrationOpen, setMigrationOpen] = useState(false)
  const [grantAccessOpen, setGrantAccessOpen] = useState(false)

  const commandMutation = useTerminalCommand()
  const commandRequest = useRef<{ body: string; key: string } | null>(null)
  const generateCodeMutation = useGenerateActivationCode()
  const remoteActivateMutation = useRemoteActivate()

  const isNexgo = terminal.brand?.toUpperCase().includes('NEXGO') ?? false
  const commandsDisabled = commandMutation.isPending || terminal.type !== 'TPV_ANDROID'

  function run(command: TpvCommand, payload?: Record<string, unknown>) {
    if (terminal.type !== 'TPV_ANDROID') return
    const body = JSON.stringify({ terminalId: terminal.id, command, payload })
    if (commandRequest.current?.body !== body)
      commandRequest.current = { body, key: crypto.randomUUID() }
    commandMutation.mutate(
      { terminalId: terminal.id, command, payload, idempotencyKey: commandRequest.current.key },
      {
        onSuccess: () => {
          commandRequest.current = null
          toast.success(`Comando "${humanizeCommandShort(command)}" encolado`, {
            description: online
              ? 'Solicitud registrada. Falta que la terminal confirme la ejecución.'
              : 'Solicitud registrada. La terminal está desconectada; aún no se ha ejecutado.',
          })
          setDanger(null)
          setConfirmInput('')
        },
        onError: (error) => {
          const info = inspectApiError(error, `ejecutar ${command}`)
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  function handleDangerConfirm() {
    if (!danger) return
    // Requiere que el operador haya escrito el serial (o el nombre si no
    // tiene serial todavía) para evitar accidentes.
    const expected = terminal.serialNumber || terminal.name
    if (confirmInput.trim() !== expected) {
      toast.error('Confirmación incorrecta', {
        description: `Debes escribir exactamente "${expected}" para confirmar.`,
      })
      return
    }
    run(danger)
  }

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <Badge tone={TERMINAL_TYPE_TONE[terminal.type]}>
            {humanizeTerminalType(terminal.type)}
          </Badge>
          <Badge tone={TERMINAL_STATUS_TONE[terminal.status]}>
            {humanizeTerminalStatus(terminal.status)}
          </Badge>
          {locked && <Badge tone="danger">Bloqueada</Badge>}
        </div>
        <DrawerTitle className="mt-2">{terminal.name}</DrawerTitle>
        <DrawerSubtitle>
          {terminal.serialNumber ? (
            <span className="font-mono">{terminal.serialNumber}</span>
          ) : (
            <span className="italic">Sin serial — aún sin activar</span>
          )}
          {terminal.brand && (
            <>
              <span className="mx-1.5 opacity-50">·</span>
              <span>
                {terminal.brand}
                {terminal.model && ` ${terminal.model}`}
              </span>
            </>
          )}
        </DrawerSubtitle>
      </DrawerHeader>

      <DrawerBody className="space-y-8">
        <StatusSummary terminal={terminal} online={online} />

        {!online && !canActivate && terminal.status !== 'RETIRED' && <OfflineBanner />}

        {canActivate && (
          <ActivationSection
            terminal={terminal}
            onGenerateCode={() => {
              generateCodeMutation.mutate(terminal.id, {
                onSuccess: (result) => {
                  toast.success('Código de activación generado', {
                    description: `${result.code} — válido hasta ${formatDateTime(result.expiresAt)}`,
                  })
                },
                onError: (e) => {
                  const info = inspectApiError(e, 'generar código de activación')
                  toast.error(info.title, { description: info.description })
                },
              })
            }}
            onRemoteActivate={() => {
              remoteActivateMutation.mutate(terminal.id, {
                onSuccess: () =>
                  toast.success('Activación remota enviada', {
                    description: 'La terminal se activará en su próximo heartbeat.',
                  }),
                onError: (e) => {
                  const info = inspectApiError(e, 'activar remotamente')
                  toast.error(info.title, { description: info.description })
                },
              })
            }}
            generating={generateCodeMutation.isPending}
            activating={remoteActivateMutation.isPending}
          />
        )}

        <Section title="Acciones rápidas">
          <ActionRow
            icon={RotateCcw}
            label="Reiniciar app"
            description="Reinicio limpio de AvoqadoPOS sin tocar datos."
            disabled={commandsDisabled}
            queued={!online}
            onClick={() => run('RESTART')}
          />
          <ActionRow
            icon={Eraser}
            label="Limpiar caché"
            description="Borra cachés en disco (menús, imágenes). No toca configuraciones."
            disabled={commandsDisabled}
            queued={!online}
            onClick={() => run('CLEAR_CACHE')}
          />
          <ActionRow
            icon={Wrench}
            label={inMaintenance ? 'Salir de mantenimiento' : 'Poner en mantenimiento'}
            description={
              inMaintenance
                ? 'Vuelve a operación normal — los empleados pueden tomar órdenes y cobrar.'
                : 'Bloquea operación; muestra pantalla de mantenimiento. Útil para revisar el equipo.'
            }
            severity="warn"
            disabled={commandsDisabled}
            queued={!online}
            onClick={() => run(inMaintenance ? 'EXIT_MAINTENANCE' : 'MAINTENANCE_MODE')}
          />
          <ActionRow
            icon={locked ? LockOpen : Lock}
            label={locked ? 'Desbloquear terminal' : 'Bloquear terminal'}
            description={
              locked
                ? 'Restaura el acceso al staff. La terminal vuelve a su pantalla normal.'
                : 'Pantalla de bloqueo con mensaje. El staff no puede operar hasta desbloquear.'
            }
            severity="warn"
            disabled={commandsDisabled}
            queued={!online}
            onClick={() => run(locked ? 'UNLOCK' : 'LOCK')}
          />
        </Section>

        {terminal.type !== 'TPV_ANDROID' && (
          <p className="text-sm text-[var(--warn)]">Esta TPV no admite comandos remotos.</p>
        )}
        <CommandHistory terminalId={terminal.id} />
        <Section title="Versión">
          <div className="rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-3">
            <p className="label">Versión instalada</p>
            <p className="tabular mt-1 font-mono text-[14px] font-semibold text-[var(--ink)]">
              {terminal.version || '—'}
            </p>
          </div>
          <VersionInstaller
            currentVersion={terminal.version}
            run={run}
            queued={!online}
            pending={commandsDisabled || isNexgo}
          />
          <ActionRow
            icon={Zap}
            label="Pedir actualización"
            description={
              isNexgo
                ? 'Esta TPV se actualiza mediante TMS.'
                : 'Muestra diálogo en la terminal; el usuario decide actualizar.'
            }
            disabled={commandsDisabled || isNexgo}
            queued={!online}
            onClick={() => run('REQUEST_UPDATE')}
          />
        </Section>

        <Section title="Datos y configuración">
          <ActionRow
            icon={RefreshCw}
            label="Sincronizar datos"
            description="Aún no disponible como comando remoto. Los datos se actualizan al usarlos."
            disabled
            queued={!online}
            onClick={() => run('SYNC_DATA')}
          />
          <ActionRow
            icon={FileDown}
            label="Exportar logs"
            description="Aún no disponible en la app de la TPV."
            disabled
            queued={!online}
            onClick={() => run('EXPORT_LOGS')}
          />
          <Link
            to={`/terminals/${terminal.id}/settings`}
            className="flex items-start gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-3 transition-colors hover:border-[var(--accent-line)] hover:bg-[var(--accent-faint)]/40"
            onClick={onClose}
          >
            <Settings className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                Configurar terminal completa
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
                Ajustes avanzados, comercios de cobro, comportamiento de pagos y modo de impresión.
              </p>
            </div>
            <ExternalLink
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
              aria-hidden
            />
          </Link>
        </Section>

        <Section title="Acceso">
          <ActionRow
            icon={UserPlus}
            label="Dar acceso a una persona"
            description="Otorga a una persona un rol y un PIN para entrar a esta terminal en su venue."
            onClick={() => setGrantAccessOpen(true)}
          />
        </Section>

        <Section title="Migración">
          <ActionRow
            icon={ArrowRightLeft}
            label={migrating ? 'Migración en curso' : 'Migrar a otro venue'}
            description={
              migrating
                ? 'Hay una migración en vuelo. Abre el asistente para ver el progreso o cancelarla.'
                : 'Re-vincula la terminal a otro venue. Se restablece de fábrica y reaparece bajo el nuevo venue.'
            }
            severity="warn"
            onClick={() => setMigrationOpen(true)}
          />
        </Section>

        <DangerZone
          danger={danger}
          setDanger={setDanger}
          confirmInput={confirmInput}
          setConfirmInput={setConfirmInput}
          onConfirm={handleDangerConfirm}
          terminal={terminal}
          isPending={commandsDisabled}
        />
      </DrawerBody>

      <TerminalMigrationDrawer
        terminal={terminal}
        open={migrationOpen}
        onOpenChange={setMigrationOpen}
        resumeMigration={migrating ? terminal.migration : null}
      />

      <GrantAccessDrawer
        terminal={terminal}
        open={grantAccessOpen}
        onOpenChange={setGrantAccessOpen}
      />
    </>
  )
}

/* ─── Sub-componentes ──────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="eyebrow">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function StatusSummary({ terminal, online }: { terminal: Terminal; online: boolean }) {
  return (
    <section className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {online ? (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)] shadow-[0_0_0_3px_var(--success-faint)]"
                aria-hidden
              />
              <span className="text-[13px] font-semibold text-[var(--ink)]">Online</span>
            </>
          ) : (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--ink-faint)] shadow-[0_0_0_3px_var(--line)]"
                aria-hidden
              />
              <span className="text-[13px] font-semibold text-[var(--ink-muted)]">Offline</span>
            </>
          )}
        </div>
        {terminal.latestHealthScore !== null && (
          <Tooltip
            content={`Salud calculada desde último heartbeat${terminal.latestHealthAt ? ` (${formatRelative(terminal.latestHealthAt)})` : ''}.`}
          >
            <span
              className={cn(
                'tabular cursor-help text-[12px] font-semibold',
                !online
                  ? 'text-[var(--ink-faint)]'
                  : terminal.latestHealthScore >= 80
                    ? 'text-[var(--success)]'
                    : terminal.latestHealthScore >= 50
                      ? 'text-[var(--warn)]'
                      : 'text-[var(--danger)]',
              )}
              tabIndex={0}
            >
              Salud {terminal.latestHealthScore}
              {!online && ' · dato histórico'}
            </span>
          </Tooltip>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
        <div>
          <dt className="label">Último heartbeat</dt>
          <dd className="tabular mt-0.5 text-[var(--ink)]">
            {terminal.lastHeartbeat ? formatRelative(terminal.lastHeartbeat) : 'Nunca'}
          </dd>
        </div>
        <div>
          <dt className="label">Versión</dt>
          <dd className="tabular mt-0.5 font-mono text-[var(--ink)]">{terminal.version || '—'}</dd>
        </div>
        <div>
          <dt className="label">IP</dt>
          <dd className="tabular mt-0.5 font-mono text-[var(--ink-muted)]">
            {terminal.ipAddress || '—'}
          </dd>
        </div>
        <div>
          <dt className="label">Venue</dt>
          <dd className="mt-0.5 truncate text-[var(--ink)]">
            <Link to={`/venues/${terminal.venueId}`} className="hover:text-[var(--accent)]">
              {terminal.venue.name}
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  )
}

function ActivationSection({
  terminal,
  onGenerateCode,
  onRemoteActivate,
  generating,
  activating,
}: {
  terminal: Terminal
  onGenerateCode: () => void
  onRemoteActivate: () => void
  generating: boolean
  activating: boolean
}) {
  const hasCode = !!terminal.activationCode

  return (
    <Section title="Activación pendiente">
      <div className="rounded-[6px] border border-[var(--warn)]/30 bg-[var(--warn-faint)] p-3.5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[var(--ink)]">
              La terminal aún no está activada
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
              Genera un código para que el técnico en sitio lo ingrese, o dispara una activación
              remota si la terminal ya está prendida en el venue.
            </p>
          </div>
        </div>

        {hasCode && (
          <div className="mt-3 rounded-[4px] border border-[var(--warn)]/30 bg-[var(--canvas)] p-3">
            <p className="label">Código activo</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="tabular flex-1 font-mono text-[20px] font-bold tracking-[0.15em] text-[var(--ink)]">
                {terminal.activationCode}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (terminal.activationCode && navigator.clipboard) {
                    navigator.clipboard.writeText(terminal.activationCode)
                    toast.success('Código copiado')
                  }
                }}
                className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                <Copy className="h-3 w-3" aria-hidden />
                Copiar
              </button>
            </div>
            {terminal.activationCodeExpiry && (
              <p className="tabular mt-1 text-[10.5px] text-[var(--ink-faint)]">
                Expira {formatRelative(terminal.activationCodeExpiry)}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onGenerateCode}
            disabled={generating}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--canvas-sunken)] disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-3 w-3" aria-hidden />
            )}
            {hasCode ? 'Regenerar código' : 'Generar código'}
          </button>
          <button
            type="button"
            onClick={onRemoteActivate}
            disabled={activating}
            className={buttonVariants({ size: 'sm' })}
          >
            {activating ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Zap className="h-3 w-3" aria-hidden />
            )}
            Activar remotamente
          </button>
        </div>
      </div>
    </Section>
  )
}

function ActionRow({
  icon: Icon,
  label,
  description,
  severity = 'safe',
  disabled,
  queued,
  onClick,
}: {
  icon: LucideIcon
  label: string
  description: string
  severity?: 'safe' | 'warn'
  disabled?: boolean
  /**
   * Si `true`, el comando se manda igual pero quedará encolado hasta que la
   * terminal vuelva online. Mostramos un pill discreto "Se encolará" para
   * que el operador entienda que no es ejecución inmediata.
   */
  queued?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-start gap-3 rounded-[6px] border p-3 text-left transition-colors',
        disabled && 'cursor-not-allowed opacity-60',
        !disabled &&
          severity === 'safe' &&
          'border-[var(--line)] bg-[var(--canvas)] hover:border-[var(--accent-line)] hover:bg-[var(--accent-faint)]/40',
        !disabled &&
          severity === 'warn' &&
          'border-[var(--line)] bg-[var(--canvas)] hover:border-[var(--warn)]/40 hover:bg-[var(--warn-faint)]/40',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          severity === 'warn'
            ? 'text-[var(--warn)]'
            : 'text-[var(--ink-muted)] group-hover:text-[var(--accent)]',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-[var(--ink)]">{label}</p>
          {queued && !disabled && (
            <Badge size="sm" tone="muted" className="shrink-0">
              Se encolará
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-muted)]">{description}</p>
      </div>
    </button>
  )
}

/**
 * Banner contextual cuando la terminal está offline. Aclara que los
 * comandos siguen siendo ejecutables — el backend los encola y los
 * despacha cuando la terminal vuelve online. Sin esto, el operador
 * vería los botones habilitados sin entender por qué la terminal está
 * "Offline" en el header.
 */
function OfflineBanner() {
  return (
    <div className="flex items-start gap-3 rounded-[6px] border border-[var(--info)]/30 bg-[var(--info-faint)]/40 p-3.5">
      <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-[var(--ink)]">
          La terminal está offline — los comandos se encolan
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-muted)]">
          Las solicitudes quedan pendientes de entrega. Consulta abajo su estado y fecha de
          vencimiento; encolar no confirma que la terminal las haya ejecutado.
        </p>
      </div>
    </div>
  )
}

function VersionInstaller({
  currentVersion,
  run,
  queued,
  pending,
}: {
  currentVersion: string | null
  run: (cmd: TpvCommand, payload?: Record<string, unknown>) => void
  /** Se muestra el pill "Se encolará" cuando la terminal está offline. */
  queued: boolean
  pending: boolean
}) {
  const [version, setVersion] = useState('')
  const versionsQuery = useAppVersions()

  const options: ComboboxOption[] = useMemo(() => {
    const list = versionsQuery.data ?? []
    // The device resolves the code in its own environment. Do not offer two
    // indistinguishable commands when sandbox and production share that code.
    const byCode = new Map<number, typeof list>()
    for (const release of list) {
      const variants = byCode.get(release.versionCode) ?? []
      variants.push(release)
      byCode.set(release.versionCode, variants)
    }
    return [...byCode.entries()]
      .sort(([a], [b]) => b - a)
      .map(([code, variants]) => ({
        value: String(code),
        label: [...new Set(variants.map((v) => v.versionName))].join(' / '),
        description: `Código ${code} · ${variants.map((v) => v.environment.toLowerCase()).join(', ')}`,
        searchTokens: `${code} ${variants.map((v) => v.environment).join(' ')}`,
      }))
  }, [versionsQuery.data])

  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-3">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Instalar versión específica</p>
        {queued && (
          <Badge size="sm" tone="muted" className="shrink-0">
            Se encolará
          </Badge>
        )}
      </div>
      <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
        Solicita este código para el entorno de la TPV (sandbox o producción). Confirma el resultado
        en Comandos recientes. Instalar una versión anterior puede requerir intervención en el
        aparato.
      </p>
      {versionsQuery.isError && (
        <QueryError
          error={versionsQuery.error}
          context="cargar versiones"
          onRetry={() => versionsQuery.refetch()}
          isRetrying={versionsQuery.isFetching}
        />
      )}
      <div className="mt-2.5 flex gap-2">
        <Combobox
          ariaLabel="Versión a instalar"
          value={version}
          onChange={setVersion}
          options={options}
          placeholder={
            versionsQuery.isLoading
              ? 'Cargando versiones…'
              : currentVersion
                ? `actual: ${currentVersion}`
                : 'Selecciona una versión publicada'
          }
          searchPlaceholder="Buscar versión o versionCode…"
          emptyLabel="Sin versiones que coincidan"
          width={300}
          className="tabular h-8 flex-1 px-2 font-mono text-[12px]"
          renderTriggerValue={(v) => (
            <span className="tabular font-mono">
              {versionsQuery.data?.find((item) => String(item.versionCode) === v)?.versionName ?? v}
            </span>
          )}
        />
        <button
          type="button"
          onClick={() => {
            const selected = versionsQuery.data?.find(
              (item) => String(item.versionCode) === version && item.isActive,
            )
            if (!selected) {
              toast.error('Selecciona una versión publicada')
              return
            }
            run('INSTALL_VERSION', { versionCode: selected.versionCode })
            setVersion('')
          }}
          disabled={!version || pending || versionsQuery.isError}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--canvas-sunken)] disabled:opacity-50"
        >
          <Box className="h-3 w-3" aria-hidden />
          Instalar
        </button>
      </div>
    </div>
  )
}

function DangerZone({
  danger,
  setDanger,
  confirmInput,
  setConfirmInput,
  onConfirm,
  terminal,
  isPending,
}: {
  danger: TpvCommand | null
  setDanger: (d: TpvCommand | null) => void
  confirmInput: string
  setConfirmInput: (v: string) => void
  onConfirm: () => void
  terminal: Terminal
  isPending: boolean
}) {
  const expected = terminal.serialNumber || terminal.name

  return (
    <section className="rounded-[8px] border border-[var(--danger)]/30 bg-[var(--danger-faint)]/40 p-4">
      <div className="flex items-center gap-2">
        <ShieldOff className="h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
        <h3 className="text-[13px] font-semibold text-[var(--danger)]">Acciones destructivas</h3>
      </div>
      <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">
        Estas acciones borran datos o detienen la terminal. Cada una requiere escribir el serial
        para confirmar.
      </p>

      <div className="mt-3 space-y-1.5">
        <DangerButton
          icon={Trash2}
          label="Restablecer caché y almacenamiento"
          description={
            (terminal.commandProtocolVersion ?? 0) >= 2
              ? 'Restablece caché, ajustes y sesión del personal. Conserva la evidencia financiera y los recibos de comandos. Espera a resolver pagos y devoluciones pendientes; después requiere reabrir y activar la app.'
              : 'Borra datos locales, caché, ajustes y sesión. Comprueba primero que todos los pagos y devoluciones estén sincronizados. Después requiere reabrir y activar la app.'
          }
          active={danger === 'FACTORY_RESET'}
          onActivate={() => {
            setDanger('FACTORY_RESET')
            setConfirmInput('')
          }}
        />
        <DangerButton
          icon={PowerOff}
          label="Cerrar app"
          description="Cierra Avoqado. El personal tendrá que abrir la app de nuevo para usarla."
          active={danger === 'SHUTDOWN'}
          onActivate={() => {
            setDanger('SHUTDOWN')
            setConfirmInput('')
          }}
        />
      </div>

      {danger && (
        <div className="mt-4 rounded-[4px] border border-[var(--danger)]/40 bg-[var(--canvas)] p-3">
          <p className="text-[12px] font-semibold text-[var(--danger)]">
            Confirma: {humanizeCommandShort(danger)}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">
            Escribe exactamente{' '}
            <code className="font-mono text-[11px] text-[var(--ink)]">{expected}</code> para
            ejecutar.
          </p>
          <div className="mt-2.5 flex gap-2">
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={expected}
              autoFocus
              className="h-8 flex-1 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--danger)]"
            />
            <button
              type="button"
              onClick={() => {
                setDanger(null)
                setConfirmInput('')
              }}
              className="inline-flex h-8 items-center rounded-[4px] border border-[var(--line-strong)] px-3 text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmInput.trim() !== expected || isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-[var(--danger)] px-3 text-[12px] font-semibold text-white hover:bg-[var(--danger)]/90 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              Ejecutar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function DangerButton({
  icon: Icon,
  label,
  description,
  active,
  onActivate,
}: {
  icon: LucideIcon
  label: string
  description: string
  active: boolean
  onActivate: () => void
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        'flex w-full items-start gap-3 rounded-[6px] border p-3 text-left transition-colors',
        active
          ? 'border-[var(--danger)]/50 bg-[var(--canvas)]'
          : 'border-[var(--line)] bg-[var(--canvas)] hover:border-[var(--danger)]/30',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--ink)]">{label}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-muted)]">{description}</p>
      </div>
    </button>
  )
}

/** Versión corta para toasts: "Reiniciar" en vez de "Reiniciar app", etc. */
function humanizeCommandShort(cmd: TpvCommand): string {
  switch (cmd) {
    case 'FACTORY_RESET':
      return 'Restablecer terminal'
    case 'SHUTDOWN':
      return 'Cerrar app'
    case 'RESTART':
      return 'Reiniciar'
    case 'CLEAR_CACHE':
      return 'Limpiar caché'
    case 'LOCK':
      return 'Bloquear'
    case 'UNLOCK':
      return 'Desbloquear'
    case 'MAINTENANCE_MODE':
      return 'Mantenimiento ON'
    case 'EXIT_MAINTENANCE':
      return 'Mantenimiento OFF'
    case 'INSTALL_VERSION':
      return 'Instalar versión'
    case 'REQUEST_UPDATE':
      return 'Pedir update'
    case 'SYNC_DATA':
      return 'Sync de datos'
    case 'EXPORT_LOGS':
      return 'Export logs'
    default:
      return cmd
  }
}

function CommandHistory({ terminalId }: { terminalId: string }) {
  const [page, setPage] = useState(1)
  const query = useTerminalCommands(terminalId, page)
  const labels: Record<string, string> = {
    PENDING: 'Esperando conexión',
    QUEUED: 'Pendiente de entrega',
    SENT: 'Enviado, sin acuse',
    RECEIVED: 'Recibido',
    EXECUTING: 'En ejecución',
    COMPLETED: 'Completado',
    FAILED: 'Falló',
    EXPIRED: 'Venció',
    CANCELLED: 'Cancelado',
  }
  return (
    <Section title="Comandos recientes">
      {query.isError ? (
        <QueryError error={query.error} context="cargar comandos" onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <p className="text-sm">Cargando comandos…</p>
      ) : query.data.data.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          No hay comandos para esta TPV en este venue.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {query.data.data.map((command) => {
            const expired =
              ['PENDING', 'QUEUED'].includes(command.status) &&
              command.expiresAt &&
              Date.parse(command.expiresAt) <= Date.now()
            const status = expired ? 'EXPIRED' : command.status
            return (
              <li key={command.id} className="py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span>{humanizeCommandShort(command.commandType)}</span>
                  <Badge
                    tone={
                      status === 'COMPLETED'
                        ? 'success'
                        : ['FAILED', 'EXPIRED'].includes(status)
                          ? 'danger'
                          : 'muted'
                    }
                  >
                    {labels[status] ?? status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {formatDateTime(command.createdAt)}
                </p>
                {command.resultMessage && <p className="mt-1 text-xs">{command.resultMessage}</p>}
                {['PENDING', 'QUEUED'].includes(status) && (
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    {command.expiresAt
                      ? `Vence: ${formatDateTime(command.expiresAt)}`
                      : 'Sin vencimiento mientras espera'}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page === 1 || query.isFetching}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </Button>
        <span className="text-xs">
          {query.data?.total ?? 0} comandos · página {page}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!query.data || page * 25 >= query.data.total || query.isFetching}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          Actualizar
        </Button>
      </div>
    </Section>
  )
}
