import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox } from '@/shared/ui/Combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { HighlightedJson } from '@/shared/components/HighlightedJson'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatDateTime } from '@/shared/lib/datetime'
import { MasterCatalogRolloutTable } from './MasterCatalogRolloutTable'
import {
  useMasterCatalogOrganization,
  useUpdateMasterCatalogConfig,
  useUpdateMasterCatalogEntitlement,
  useUpdateMasterCatalogGovernance,
  useUpdateMasterCatalogModule,
} from './use-master-catalog'
import {
  SAFE_MASTER_CATALOG_CONFIG,
  type ControlMutationResult,
  type EntitlementInput,
  type EntitlementSource,
  type EntitlementStatus,
  type GovernanceMode,
  type MasterCatalogConfigV1,
  type MasterCatalogOrganizationControl,
  type MasterCatalogVenueControl,
} from './types'

interface Props {
  organizationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PendingChange {
  title: string
  description: string
  execute: () => Promise<ControlMutationResult>
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo', description: 'Grant comercial vigente.' },
  { value: 'REVOKED', label: 'Revocado', description: 'Detiene nuevas operaciones corporativas.' },
] as const

const SOURCE_OPTIONS = [
  { value: 'CONTRACT', label: 'Contrato', description: 'Derecho comercial firmado.' },
  { value: 'CUSTOM', label: 'Custom', description: 'Excepción comercial explícita.' },
] as const

const GOVERNANCE_OPTIONS = [
  { value: 'OFF', label: 'OFF', description: 'Sin gobierno de altas.' },
  { value: 'ADVISORY', label: 'ADVISORY', description: 'Validación y canary sin bloqueo legacy.' },
  { value: 'ENFORCED', label: 'ENFORCED', description: 'Techo global para venues ya preparados.' },
] as const

export function MasterCatalogOrganizationDrawer({ organizationId, open, onOpenChange }: Props) {
  const detail = useMasterCatalogOrganization(organizationId)
  const entitlementMutation = useUpdateMasterCatalogEntitlement()
  const moduleMutation = useUpdateMasterCatalogModule()
  const configMutation = useUpdateMasterCatalogConfig()
  const governanceMutation = useUpdateMasterCatalogGovernance()
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [lastChange, setLastChange] = useState<ControlMutationResult | null>(null)

  async function confirmChange() {
    if (!pending) return
    try {
      const result = await pending.execute()
      setLastChange(result)
      setPending(null)
      toast.success('Control de catálogo actualizado')
    } catch (error) {
      const inspected = inspectApiError(error, 'actualizar el control de catálogo')
      toast.error(inspected.title, { description: inspected.description })
    }
  }

  function requestGovernance(venue: MasterCatalogVenueControl) {
    if (!organizationId) return
    setPending({
      title: `Confirmar ENFORCED para ${venue.name}`,
      description:
        'El cutoff del venue es write-once. Confirma únicamente después de revisar clientes, canary y rollback operativo.',
      execute: () =>
        governanceMutation.mutateAsync([organizationId, venue.id, { governanceState: 'ENFORCED' }]),
    })
  }

  const isPending =
    entitlementMutation.isPending ||
    moduleMutation.isPending ||
    configMutation.isPending ||
    governanceMutation.isPending

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-w-[920px]">
          <DrawerHeader onClose={() => onOpenChange(false)}>
            <DrawerTitle>{detail.data?.organization.name ?? 'Control de catálogo'}</DrawerTitle>
            <DrawerSubtitle>
              Entitlement comercial, módulo operativo y rollout por venue. No edita contenido ni
              precios.
            </DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody className="space-y-6">
            {detail.isError && (
              <QueryError
                error={detail.error}
                context="cargar el control de catálogo"
                onRetry={() => detail.refetch()}
              />
            )}
            {detail.isLoading && (
              <p className="text-[13px] text-[var(--ink-muted)]">Cargando autoridad vigente…</p>
            )}
            {detail.data && organizationId && (
              <OrganizationControls
                key={`${organizationId}:${detail.data.entitlement?.updatedAt ?? 'none'}:${detail.data.module?.updatedAt ?? 'none'}`}
                data={detail.data}
                onPending={setPending}
                onRequestGovernance={requestGovernance}
                updateEntitlement={(input) =>
                  entitlementMutation.mutateAsync([organizationId, input])
                }
                updateModule={(enabled) =>
                  moduleMutation.mutateAsync([organizationId, { enabled }])
                }
                updateConfig={(config) => configMutation.mutateAsync([organizationId, { config }])}
              />
            )}
            {lastChange && (
              <section
                aria-live="polite"
                className="rounded-[8px] border border-[var(--success)]/35 bg-[var(--success-faint)] p-4"
              >
                <h3 className="text-[14px] font-semibold text-[var(--success)]">Cambio aplicado</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <h4 className="label mb-1.5">Antes</h4>
                    <HighlightedJson value={lastChange.before} />
                  </div>
                  <div>
                    <h4 className="label mb-1.5">Después</h4>
                    <HighlightedJson value={lastChange.after} />
                  </div>
                </div>
              </section>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Dialog open={pending !== null} onOpenChange={(next) => !next && setPending(null)}>
        <DialogContent aria-label={pending?.title}>
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            <DialogDescription>{pending?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={confirmChange} disabled={isPending}>
              {isPending ? 'Aplicando…' : 'Confirmar cambio'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface ControlsProps {
  data: MasterCatalogOrganizationControl
  onPending: (change: PendingChange) => void
  onRequestGovernance: (venue: MasterCatalogVenueControl) => void
  updateEntitlement: (input: EntitlementInput) => Promise<ControlMutationResult>
  updateModule: (enabled: boolean) => Promise<ControlMutationResult>
  updateConfig: (config: MasterCatalogConfigV1) => Promise<ControlMutationResult>
}

function OrganizationControls({
  data,
  onPending,
  onRequestGovernance,
  updateEntitlement,
  updateModule,
  updateConfig,
}: ControlsProps) {
  const [status, setStatus] = useState<EntitlementStatus>(data.entitlement?.status ?? 'ACTIVE')
  const [source, setSource] = useState<EntitlementSource>(data.entitlement?.source ?? 'CONTRACT')
  const [reason, setReason] = useState(data.entitlement?.reason ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [config, setConfig] = useState(data.access.config ?? SAFE_MASTER_CATALOG_CONFIG)
  const canMutate = data.access.canConfigureControlPlane

  function requestEntitlement() {
    const normalizedReason = reason.trim()
    if (!normalizedReason) {
      setFormError('Escribe el motivo contractual u operativo del cambio.')
      return
    }
    setFormError(null)
    const input = {
      status,
      source,
      reason: normalizedReason,
      startsAt: data.entitlement?.startsAt ?? new Date().toISOString(),
      endsAt: data.entitlement?.endsAt ?? null,
    }
    onPending({
      title: 'Confirmar cambio de entitlement',
      description:
        'Este grant es comercial y explícito. No habilita por sí solo el módulo ni cambia ningún Product.',
      execute: () => updateEntitlement(input),
    })
  }

  return (
    <>
      <section className="grid gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] md:grid-cols-2">
        <article className="bg-[var(--canvas)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Entitlement</p>
              <h3 className="mt-1 text-[15px] font-semibold text-[var(--ink)]">
                {data.entitlement
                  ? `${data.entitlement.source} · ${data.entitlement.status}`
                  : 'Sin grant explícito'}
              </h3>
            </div>
            <Badge tone={data.access.entitlementActive ? 'success' : 'danger'}>
              {data.access.entitlementActive ? 'Vigente' : 'Inactivo'}
            </Badge>
          </div>
          {data.entitlement && (
            <p className="tabular mt-2 text-[11px] text-[var(--ink-faint)]">
              {formatDateTime(data.entitlement.startsAt)} →{' '}
              {formatDateTime(data.entitlement.endsAt)}
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="label">Estado</span>
              <Combobox
                value={status}
                onChange={(next) => setStatus(next as EntitlementStatus)}
                options={STATUS_OPTIONS}
                ariaLabel="Estado del entitlement"
                disabled={!canMutate}
              />
            </label>
            <label className="space-y-1.5">
              <span className="label">Fuente</span>
              <Combobox
                value={source}
                onChange={(next) => setSource(next as EntitlementSource)}
                options={SOURCE_OPTIONS}
                ariaLabel="Fuente del entitlement"
                disabled={!canMutate}
              />
            </label>
          </div>
          <label className="mt-3 block space-y-1.5">
            <span className="label">Motivo del entitlement</span>
            <textarea
              aria-label="Motivo del entitlement"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!canMutate}
              className="min-h-20 w-full resize-y rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus-visible:border-[var(--accent-line)]"
            />
          </label>
          {formError && <p className="mt-2 text-[12px] text-[var(--danger)]">{formError}</p>}
          <Button
            type="button"
            className="mt-3 w-full sm:w-auto"
            disabled={!canMutate}
            onClick={requestEntitlement}
          >
            {data.entitlement ? 'Revisar entitlement' : 'Crear grant explícito'}
          </Button>
        </article>

        <article className="bg-[var(--canvas)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Módulo operativo</p>
              <h3 className="mt-1 text-[15px] font-semibold text-[var(--ink)]">MASTER_CATALOG</h3>
            </div>
            <Badge tone={data.module?.enabled ? 'success' : 'muted'}>
              {data.module?.enabled ? 'Habilitado' : 'Deshabilitado'}
            </Badge>
          </div>
          <p className="mt-2 text-[12px] text-[var(--ink-muted)]">
            Scope {data.module?.scope ?? 'ORGANIZATION_ONLY'} · definición{' '}
            {data.module?.definitionActive === false ? 'inactiva' : 'activa'}
          </p>
          <Badge
            className="mt-3"
            tone={data.access.reasonCode === 'ACCESSIBLE' ? 'success' : 'warn'}
          >
            {data.access.reasonCode}
          </Badge>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              disabled={!canMutate}
              onClick={() =>
                onPending({
                  title: data.module?.enabled
                    ? 'Confirmar pausa del módulo'
                    : 'Confirmar habilitación del módulo',
                  description:
                    'El módulo controla el rollout operativo. Cambiarlo no crea un entitlement ni publica contenido.',
                  execute: () => updateModule(!data.module?.enabled),
                })
              }
            >
              {data.module?.enabled ? 'Deshabilitar módulo' : 'Habilitar módulo'}
            </Button>
          </div>
        </article>
      </section>

      <section className="rounded-[8px] border border-[var(--line-strong)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Configuración efectiva</p>
            <h3 className="mt-1 text-[15px] font-semibold text-[var(--ink)]">Schema v1</h3>
            <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
              Los tres gates nacen apagados. Una versión desconocida se presenta y guarda
              fail-closed.
            </p>
          </div>
          {data.access.config === null && <Badge tone="danger">Config inválida o ausente</Badge>}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {[
            ['catalogCoreEnabled', 'Catálogo base'],
            ['identifiersEnabled', 'Identificadores'],
            ['regionalPricingEnabled', 'Pricing regional'],
          ].map(([key, label]) => {
            const configKey = key as
              | 'catalogCoreEnabled'
              | 'identifiersEnabled'
              | 'regionalPricingEnabled'
            const checked = config[configKey]
            return (
              <label
                key={key}
                className="flex items-center gap-2 rounded-[6px] border border-[var(--line)] p-3"
              >
                <Checkbox
                  checked={checked}
                  disabled={!canMutate || !data.module}
                  onCheckedChange={(next) =>
                    setConfig((current) => ({ ...current, [configKey]: next === true }))
                  }
                />
                <span className="text-[12.5px] text-[var(--ink)]">
                  {label} {checked ? 'encendido' : 'apagado'}
                </span>
              </label>
            )
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="space-y-1.5">
            <span className="label">Modo de gobernanza</span>
            <Combobox
              value={config.governanceMode}
              onChange={(next) =>
                setConfig((current) => ({ ...current, governanceMode: next as GovernanceMode }))
              }
              options={GOVERNANCE_OPTIONS}
              ariaLabel="Modo de gobernanza"
              disabled={!canMutate || !data.module}
            />
          </label>
          <Button
            type="button"
            disabled={!canMutate || !data.module}
            onClick={() =>
              onPending({
                title: 'Confirmar configuración del catálogo',
                description:
                  'Revisa los gates y el modo. OFF y valores false conservan todos los flujos legacy sin activar.',
                execute: () => updateConfig(config),
              })
            }
          >
            Guardar configuración
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="eyebrow">Rollout por venue</p>
          <h3 className="mt-1 text-[15px] font-semibold text-[var(--ink)]">
            Readiness y evidencia
          </h3>
        </div>
        <MasterCatalogRolloutTable
          venues={data.venues}
          canMutate={canMutate}
          onRequestEnforcement={onRequestGovernance}
        />
      </section>
    </>
  )
}
