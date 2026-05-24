import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
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
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatDateTime, formatRelative } from '@/shared/lib/datetime'
import {
  useAppVersions,
  useGenerateActivationCode,
  useRemoteActivate,
  useTerminalCommand,
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

  const commandMutation = useTerminalCommand()
  const generateCodeMutation = useGenerateActivationCode()
  const remoteActivateMutation = useRemoteActivate()

  function run(command: TpvCommand, payload?: Record<string, unknown>) {
    commandMutation.mutate(
      { terminalId: terminal.id, command, payload },
      {
        onSuccess: () => {
          toast.success(`Comando "${humanizeCommandShort(command)}" encolado`, {
            description: online
              ? 'La terminal lo ejecutará en segundos.'
              : 'Quedará en cola hasta que la terminal vuelva online.',
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
            disabled={commandMutation.isPending}
            queued={!online}
            onClick={() => run('RESTART')}
          />
          <ActionRow
            icon={Eraser}
            label="Limpiar caché"
            description="Borra cachés en disco (menús, imágenes). No toca configuraciones."
            disabled={commandMutation.isPending}
            queued={!online}
            onClick={() => run('CLEAR_CACHE')}
          />
          <ActionRow
            icon={Wrench}
            label={inMaintenance ? 'Salir de mantenimiento' : 'Poner en mantenimiento'}
            description={
              inMaintenance
                ? 'Vuelve a operación normal — los empleados pueden tomar órdenes y cobrar.'
                : 'Bloquea operación; muestra pantalla de mantenimiento. Útil para hardware fixes.'
            }
            severity="warn"
            disabled={commandMutation.isPending}
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
            disabled={commandMutation.isPending}
            queued={!online}
            onClick={() => run(locked ? 'UNLOCK' : 'LOCK')}
          />
        </Section>

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
            pending={commandMutation.isPending}
          />
          <ActionRow
            icon={Zap}
            label="Pedir actualización"
            description="Muestra diálogo en la terminal; el usuario decide actualizar."
            disabled={commandMutation.isPending}
            queued={!online}
            onClick={() => run('REQUEST_UPDATE')}
          />
        </Section>

        <Section title="Datos y configuración">
          <ActionRow
            icon={RefreshCw}
            label="Sincronizar datos"
            description="Forzar pull de menú, staff, configs actuales."
            disabled={commandMutation.isPending}
            queued={!online}
            onClick={() => run('SYNC_DATA')}
          />
          <ActionRow
            icon={FileDown}
            label="Exportar logs"
            description="La terminal sube logs al backend para inspección."
            disabled={commandMutation.isPending}
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
                Settings avanzados, merchant accounts, comportamiento de payments, modo de
                impresión.
              </p>
            </div>
            <ExternalLink
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
              aria-hidden
            />
          </Link>
        </Section>

        <DangerZone
          danger={danger}
          setDanger={setDanger}
          confirmInput={confirmInput}
          setConfirmInput={setConfirmInput}
          onConfirm={handleDangerConfirm}
          terminal={terminal}
          isPending={commandMutation.isPending}
        />
      </DrawerBody>
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
                terminal.latestHealthScore >= 80
                  ? 'text-[var(--success)]'
                  : terminal.latestHealthScore >= 50
                    ? 'text-[var(--warn)]'
                    : 'text-[var(--danger)]',
              )}
              tabIndex={0}
            >
              Salud {terminal.latestHealthScore}
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
          {queued && (
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
          Puedes mandar acciones igual. El backend las guarda como{' '}
          <code className="font-mono text-[11px] text-[var(--ink)]">QUEUED</code> y las despacha en
          cuanto la terminal vuelva a conectarse. El estado del comando se ve en el histórico del
          terminal.
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
    return (
      list
        // Sort por versionCode desc — las versiones más nuevas arriba.
        .slice()
        .sort((a, b) => b.versionCode - a.versionCode)
        .map((v) => ({
          value: v.versionName,
          label: v.versionName,
          description:
            [
              `vCode ${v.versionCode}`,
              v.environment.toLowerCase(),
              v.updateMode === 'FORCE'
                ? 'force-update'
                : v.updateMode === 'BANNER'
                  ? 'banner'
                  : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
          searchTokens: `${v.versionCode} ${v.environment}`,
        }))
    )
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
        Override silencioso a una versión exacta (rollback o upgrade). La terminal descarga e
        instala sin pedir permiso al usuario.
      </p>
      <div className="mt-2.5 flex gap-2">
        <Combobox
          value={version}
          onChange={setVersion}
          options={options}
          placeholder={
            versionsQuery.isLoading
              ? 'Cargando versiones…'
              : currentVersion
                ? `actual: ${currentVersion}`
                : 'Selecciona o escribe versión'
          }
          searchPlaceholder="Buscar versión o versionCode…"
          emptyLabel="Sin versiones que coincidan"
          allowCustomValue
          width={300}
          className="tabular h-8 flex-1 px-2 font-mono text-[12px]"
          renderTriggerValue={(v) => <span className="tabular font-mono">{v}</span>}
        />
        <button
          type="button"
          onClick={() => {
            if (!version.trim()) {
              toast.error('Selecciona o escribe una versión')
              return
            }
            run('INSTALL_VERSION', { version: version.trim() })
            setVersion('')
          }}
          disabled={!version.trim() || pending}
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
          description="Factory reset — borra TODA la data local (caché, configs, credenciales). La terminal vuelve a estado de primera activación. Necesita re-activación con código."
          active={danger === 'FACTORY_RESET'}
          onActivate={() => {
            setDanger('FACTORY_RESET')
            setConfirmInput('')
          }}
        />
        <DangerButton
          icon={PowerOff}
          label="Apagar terminal"
          description="Shutdown completo. El staff tendrá que prenderla físicamente para volverla a usar."
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
            Confirmá: {humanizeCommandShort(danger)}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">
            Escribí exactamente{' '}
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
      return 'Apagar'
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
