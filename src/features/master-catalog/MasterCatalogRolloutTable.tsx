import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/data-table/DataTable'
import { formatDateTime } from '@/shared/lib/datetime'
import type { MasterCatalogVenueControl } from './types'

interface Props {
  venues: MasterCatalogVenueControl[]
  onRequestEnforcement: (venue: MasterCatalogVenueControl) => void
  canMutate?: boolean
}

function statusTone(value: string): 'success' | 'warn' | 'danger' | 'muted' {
  if (value === 'READY' || value === 'ENABLED' || value === 'ENFORCED') return 'success'
  if (value.includes('FAILED')) return 'danger'
  if (value.includes('READY_TO') || value === 'BOOTSTRAPPING' || value === 'CLIENTS_NOT_READY')
    return 'warn'
  return 'muted'
}

function actorLabel(venue: MasterCatalogVenueControl): string {
  const actor = venue.lastFailure?.actor
  if (!actor) return venue.rollout.updatedBy?.email ?? 'Sin actor'
  if (actor.type === 'SERVICE') return actor.servicePrincipalId
  if (!actor.staff) return actor.staffId
  const name = [actor.staff.firstName, actor.staff.lastName].filter(Boolean).join(' ')
  return name || actor.staff.email
}

export function MasterCatalogRolloutTable({
  venues,
  onRequestEnforcement,
  canMutate = true,
}: Props) {
  const columns = useMemo<ColumnDef<MasterCatalogVenueControl, unknown>[]>(
    () => [
      {
        id: 'venue',
        header: 'Venue',
        accessorFn: (venue) => venue.name,
        cell: ({ row }) => (
          <div className="min-w-[160px]">
            <p className="text-[13.5px] font-semibold text-[var(--ink)]">{row.original.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--ink-faint)]">
              rev {row.original.rollout.identifierRevision}
            </p>
          </div>
        ),
      },
      {
        id: 'rollout',
        header: 'Rollout',
        accessorFn: (venue) => venue.rollout.governanceState,
        cell: ({ row }) => (
          <div className="min-w-[190px] space-y-1.5">
            <Badge size="sm" tone={statusTone(row.original.rollout.registryState)}>
              {row.original.rollout.registryState}
            </Badge>
            <div className="flex flex-wrap gap-1">
              <Badge size="sm" tone={statusTone(row.original.rollout.aliasPublicationState)}>
                {row.original.rollout.aliasPublicationState}
              </Badge>
              <Badge size="sm" tone={statusTone(row.original.rollout.governanceState)}>
                {row.original.rollout.governanceState}
              </Badge>
            </div>
          </div>
        ),
      },
      {
        id: 'readiness',
        header: 'Clientes',
        accessorFn: (venue) => venue.readiness.state,
        cell: ({ row }) => (
          <div className="min-w-[180px] space-y-1">
            <Badge size="sm" tone={row.original.readiness.state === 'READY' ? 'success' : 'warn'}>
              {row.original.readiness.state}
            </Badge>
            {row.original.readiness.staleFamilies.map((family) => (
              <p key={`stale-${family}`} className="text-[11px] text-[var(--warn)]">
                {family} stale
              </p>
            ))}
            {row.original.readiness.missingFamilies.map((family) => (
              <p key={`missing-${family}`} className="text-[11px] text-[var(--danger)]">
                {family} sin observación
              </p>
            ))}
            {row.original.readiness.incompatibleFamilies.map((family) => (
              <p key={`version-${family}`} className="text-[11px] text-[var(--danger)]">
                {family} incompatible
              </p>
            ))}
          </div>
        ),
      },
      {
        id: 'evidence',
        header: 'Última evidencia',
        accessorFn: (venue) => venue.lastFailure?.occurredAt ?? venue.rollout.updatedAt ?? '',
        cell: ({ row }) => {
          const timestamp = row.original.lastFailure?.occurredAt ?? row.original.rollout.updatedAt
          return (
            <div className="min-w-[210px]">
              <p className="text-[12px] font-medium text-[var(--ink)]">
                {actorLabel(row.original)}
              </p>
              <p className="tabular mt-0.5 text-[11px] text-[var(--ink-faint)]">
                {formatDateTime(timestamp, row.original.timezone)}
              </p>
              {row.original.lastFailure?.message && (
                <p className="mt-1 text-[11px] text-[var(--danger)]">
                  {row.original.lastFailure.message}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Acción',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canMutate || row.original.rollout.governanceState !== 'READY_TO_ENFORCE'}
            aria-label={`Solicitar ENFORCED para ${row.original.name}`}
            onClick={() => onRequestEnforcement(row.original)}
          >
            Enforce
          </Button>
        ),
      },
    ],
    [canMutate, onRequestEnforcement],
  )

  return (
    <DataTable
      data={venues}
      columns={columns}
      caption="Rollout y readiness del catálogo maestro por venue."
      searchPlaceholder="Buscar venue…"
      pageSize={25}
      emptyState={{
        title: 'Sin venues',
        description: 'La organización todavía no tiene venues que preparar para rollout.',
      }}
    />
  )
}
