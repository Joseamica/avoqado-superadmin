import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { apiErrorPayload, inspectApiError } from '@/shared/lib/api-error'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import {
  fetchPercentGroup,
  fetchPercentGroups,
  PERCENT_GROUPS,
  recalculatePercentGroup,
  setPercentGroupStatus,
  type HybridStatus,
  type PercentGroup,
  type PercentGroupStatus,
} from './hybrid-api'

const PAGE_SIZE = 25
type Action = PercentGroupStatus | 'RECALCULATE'
const STATUS: Record<PercentGroupStatus, { tone: 'success' | 'warn' | 'muted'; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Activo' },
  PAUSED: { tone: 'warn', label: 'Pausado' },
  ENDED: { tone: 'muted', label: 'Terminado' },
}
const PROMOTION: Record<HybridStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  ENDED: 'Terminada',
}
const DONE: Record<Action, { title: string; description: string }> = {
  ACTIVE: { title: 'Descuento activado', description: 'Sus promociones ya se pueden contratar.' },
  PAUSED: {
    title: 'Descuento pausado',
    description: 'Sin contrataciones nuevas; quien ya lo contrató conserva su precio.',
  },
  ENDED: {
    title: 'Descuento terminado',
    description: 'Quien ya lo contrató conserva su precio.',
  },
  RECALCULATE: {
    title: 'Descuento recalculado',
    description:
      'El % ya aplica sobre la lista vigente. Sigue pausado: actívalo cuando lo revises.',
  },
}
// What the server refuses a group action for, in the operator's words; without a description the server's message is it.
const STALE = 'Ya cargamos su estado vigente: revísalo y vuelve a intentarlo.'
const REFUSALS: Record<string, { title: string; description?: string }> = {
  HYBRID_SALES_CLOSED: {
    title: 'La venta de ofertas está cerrada',
    description:
      'Activar abre contrataciones nuevas y el servidor todavía no las admite. El descuento sigue pausado.',
  },
  HYBRID_CAMPAIGN_STALE: { title: 'El descuento cambió mientras lo veías', description: STALE },
  HYBRID_PROMOTION_GROUP_ENDED: {
    title: 'Este descuento ya terminó',
    description: 'Ya cargamos su estado vigente. Un descuento terminado no se reactiva: crea otro.',
  },
  HYBRID_PROMOTION_GROUP_NOT_PAUSED: { title: 'Pausa el descuento antes de recalcularlo' },
  HYBRID_PUBLICATION_REQUIRED: { title: 'Hay una promoción sin publicar' },
  HYBRID_PROMOTION_NO_LIST: { title: 'Una función ya no tiene precio de lista' },
  HYBRID_OFFER_UNAVAILABLE: { title: 'La vigencia del descuento ya terminó' },
}
const CONTEXT: Record<Action, string> = {
  ACTIVE: 'activar el descuento',
  PAUSED: 'pausar el descuento',
  ENDED: 'terminar el descuento',
  RECALCULATE: 'recalcular el descuento',
}

const percentSummary = (group: Pick<PercentGroup, 'percentOff' | 'functions'>) =>
  `Descuento ${group.percentOff} % · ${group.functions} ${group.functions === 1 ? 'función' : 'funciones'}`

/**
 * «Descuentos %»: one row per group, paged by the server (its campaigns never show in «Campañas»). Pausing, activating,
 * ending or recalculating moves all its promotions together, conditional on the revision on screen.
 */
export function PercentGroups() {
  const cache = useQueryClient()
  const [page, setPage] = useState(1)
  const [ending, setEnding] = useState<PercentGroup | null>(null)
  const list = useQuery({
    queryKey: [...PERCENT_GROUPS, page],
    queryFn: () => fetchPercentGroups({ page, pageSize: PAGE_SIZE }),
    staleTime: 30_000,
  })
  // A group changes what the campaign list and the «Precios» screen show (its promotions, the lists it covers).
  const refresh = () =>
    Promise.all(
      [PERCENT_GROUPS, ['superadmin', 'hybrid-campaigns'], ['pricing']].map((queryKey) =>
        cache.invalidateQueries({ queryKey }),
      ),
    )
  const action = useMutation({
    mutationFn: ({ group, next }: { group: PercentGroup; next: Action }) =>
      next === 'RECALCULATE' ? recalculatePercentGroup(group) : setPercentGroupStatus(group, next),
    onSuccess: (_, { next }) => {
      setEnding(null)
      void refresh()
      toast.success(DONE[next].title, { description: DONE[next].description })
    },
    onError: (error, { next }) => {
      setEnding(null)
      void refresh()
      const { code } = apiErrorPayload(error)
      const issue = inspectApiError(error, CONTEXT[next])
      const known = code ? REFUSALS[code] : undefined
      toast.error(known?.title ?? issue.title, {
        description: known?.description ?? issue.serverMessage ?? issue.description,
      })
    },
  })
  const run = (group: PercentGroup, next: Action) => action.mutate({ group, next })

  const columns: ColumnDef<PercentGroup, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Descuento',
      cell: ({ row }) => (
        <div>
          <p className="text-[var(--ink)]">{row.original.name}</p>
          <p className="tabular text-[12px] text-[var(--ink-muted)]">
            {percentSummary(row.original)}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</Badge>
      ),
    },
    {
      id: 'window',
      header: 'Vigencia · Ciudad de México',
      cell: ({ row }) => (
        <span className="tabular text-[13px]">
          {formatDateTime(row.original.startsAt)} — {formatDateTime(row.original.endsAt)}
        </span>
      ),
    },
    {
      id: 'terms',
      header: 'Duración · cupo',
      cell: ({ row }) => (
        <span className="tabular text-[13px]">
          {row.original.promotionCycles === null
            ? 'Para siempre'
            : `${row.original.promotionCycles} ${row.original.promotionCycles === 1 ? 'mes' : 'meses'}`}
          {` · ${row.original.capacityPerFeature} por función`}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const group = row.original
        if (group.status === 'ENDED') return null
        const busy = action.isPending
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {group.status === 'PAUSED' ? (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  aria-label={`Activar ${group.name}`}
                  onClick={() => run(group, 'ACTIVE')}
                >
                  Activar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  aria-label={`Recalcular ${group.name}`}
                  onClick={() => run(group, 'RECALCULATE')}
                >
                  Recalcular
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                aria-label={`Pausar ${group.name}`}
                onClick={() => run(group, 'PAUSED')}
              >
                Pausar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={`Terminar ${group.name}`}
              onClick={() => setEnding(group)}
            >
              Terminar
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <section className="space-y-3" aria-labelledby="percent-groups">
      <h2 id="percent-groups" className="eyebrow">
        Descuentos %
      </h2>
      <p className="max-w-2xl text-sm text-[var(--ink-muted)]">
        Cada descuento genera una promoción por función con precio de lista y se mueve completo.
        Recalcular aplica el % sobre la lista vigente y sólo se puede con el descuento pausado.
      </p>
      <DataTable
        data={list.data?.items ?? []}
        columns={columns}
        searchPlaceholder="Buscar en esta página"
        caption="Descuentos % y sus promociones"
        minWidth={900}
        renderExpandedRow={(group) => <GroupCampaigns id={group.id} />}
        emptyState={{
          title: list.isPending
            ? 'Cargando descuentos…'
            : list.isError
              ? 'Los descuentos no están disponibles'
              : 'Todavía no hay descuentos %',
          description:
            'Crea uno con «Descuento %»: genera una promoción por cada función con precio de lista.',
        }}
      />
      {list.isError && (
        <QueryError
          error={list.error}
          context="cargar los descuentos"
          onRetry={() => list.refetch()}
        />
      )}
      {list.data && list.data.total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm">
            {list.data.total} descuentos · página {page} de {Math.ceil(list.data.total / PAGE_SIZE)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page === 1 || list.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={page * PAGE_SIZE >= list.data.total || list.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      <Dialog open={ending !== null} onOpenChange={(open) => !open && setEnding(null)}>
        <DialogContent className="max-w-md">
          {ending && (
            <>
              <DialogHeader>
                <DialogTitle>Terminar «{ending.name}»</DialogTitle>
                <DialogDescription>
                  {`Sus ${ending.functions} promociones dejan de venderse y el descuento no se puede reactivar: para vender de nuevo, crea otro. Quien ya lo contrató conserva su precio.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="danger"
                  disabled={action.isPending}
                  onClick={() => run(ending, 'ENDED')}
                >
                  Terminar descuento
                </Button>
                <Button variant="ghost" onClick={() => setEnding(null)}>
                  Volver
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** The group's promotions, one per function, as they sell now. */
function GroupCampaigns({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: [...PERCENT_GROUPS, 'detail', id],
    queryFn: () => fetchPercentGroup(id),
    staleTime: 30_000,
  })
  if (detail.isPending) return <p role="status">Cargando sus promociones…</p>
  if (detail.isError)
    return (
      <QueryError
        error={detail.error}
        context="cargar las promociones del descuento"
        onRetry={() => detail.refetch()}
      />
    )
  return (
    <ul className="space-y-1 text-[13px]">
      {detail.data.campaigns.map((campaign) => {
        const terms = (campaign.publication?.definition ?? campaign.draftDefinition).terms
        return (
          <li key={campaign.id} className="flex flex-wrap justify-between gap-3">
            <span>{campaign.name}</span>
            <span className="tabular text-[var(--ink-muted)]">
              {`${formatMoney(terms.price)} al mes · ${PROMOTION[campaign.status]}`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
