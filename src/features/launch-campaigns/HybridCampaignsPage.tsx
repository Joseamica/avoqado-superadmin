import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Combobox } from '@/shared/ui/Combobox'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
} from '@/shared/ui/Drawer'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatDateTime } from '@/shared/lib/datetime'
import { HybridCampaignEditor } from './HybridCampaignEditor'
import {
  changeHybridStatus,
  fetchHybridCampaign,
  fetchHybridRedemptions,
  type HybridRedemption,
  fetchHybridCampaigns,
  hybridPesos,
  publishHybridCampaign,
  type HybridCampaign,
  type HybridStatus,
} from './hybrid-api'
const QUERY = ['superadmin', 'hybrid-campaigns'] as const
const statuses: Record<HybridStatus, string> = {
  DRAFT: 'Borrador',
  PAUSED: 'Pausada',
  ACTIVE: 'Activa',
  ENDED: 'Terminada',
}
function Status({ value }: { value: HybridStatus }) {
  return (
    <Badge tone={value === 'ACTIVE' ? 'success' : value === 'PAUSED' ? 'warn' : 'muted'}>
      {statuses[value]}
    </Badge>
  )
}

export function HybridCampaignsPage() {
  const [search, setSearch] = useState(''),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<{ campaign?: HybridCampaign; duplicate?: boolean } | null>(
      null,
    )
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])
  const cache = useQueryClient()
  const list = useQuery({
    queryKey: [...QUERY, q, status, page],
    queryFn: () => fetchHybridCampaigns({ q, ...(status ? { status } : {}), page, pageSize: 25 }),
    staleTime: 30000,
  })
  const columns = useMemo<ColumnDef<HybridCampaign, unknown>[]>(
    () =>
      [
        {
          accessorKey: 'name',
          header: 'Campaña',
          cell: ({ row }: { row: { original: HybridCampaign } }) => (
            <div>
              <Button
                variant="ghost"
                onClick={() => setSelected(row.original.id)}
                aria-label={`Ver ${row.original.name}`}
              >
                {row.original.name}
              </Button>
              <p className="text-sm text-[var(--ink-faint)]">{row.original.code}</p>
            </div>
          ),
        },
        {
          accessorKey: 'status',
          header: 'Estado',
          cell: ({ row }: { row: { original: HybridCampaign } }) => (
            <Status value={row.original.status} />
          ),
        },
        {
          id: 'offer',
          header: 'Oferta',
          cell: ({ row }: { row: { original: HybridCampaign } }) => {
            const offer = row.original.draftDefinition
            return (
              <span>
                {offer.kind === 'PLAN'
                  ? `Plan ${offer.planTier}`
                  : offer.kind === 'CHOICE_BUNDLE'
                    ? `Elige ${offer.choiceCount}`
                    : `${offer.featureCodes.length} ${offer.featureCodes.length === 1 ? 'función' : 'funciones'}`}
              </span>
            )
          },
        },
        {
          id: 'price',
          header: 'Total mensual · IVA incluido',
          cell: ({ row }: { row: { original: HybridCampaign } }) => (
            <span className="tabular block text-right">
              {hybridPesos(row.original.draftDefinition.terms.price)}
            </span>
          ),
        },
        {
          id: 'capacity',
          header: 'Lugares',
          cell: ({ row }: { row: { original: HybridCampaign } }) => (
            <span className="tabular">
              Contratados: {row.original.redeemedCount} · Reservados: {row.original.reservedCount} /{' '}
              {row.original.capacity}
            </span>
          ),
        },
      ].map((column) => ({ ...column, enableSorting: false })),
    [],
  )
  const refresh = () => cache.invalidateQueries({ queryKey: QUERY })
  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display">Planes y funciones</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)]">
            Configura ofertas de plan, funciones específicas o paquetes a elección. Cada campaña usa
            el mismo onboarding.
          </p>
          <Link
            className="mt-2 inline-block text-sm underline underline-offset-4"
            to="/launch-campaigns"
          >
            Ver campañas de lanzamiento existentes
          </Link>
        </div>
        <Button size="lg" onClick={() => setEditing({})}>
          Crear campaña
        </Button>
      </header>
      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        serverSearch={{ value: search, onChange: setSearch }}
        searchPlaceholder="Buscar campañas"
        caption="Campañas configurables de planes y funciones"
        toolbar={
          <Combobox
            className="sm:w-48 sm:shrink-0"
            ariaLabel="Estado de la campaña"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Todos los estados' },
              ...Object.entries(statuses).map(([value, label]) => ({ value, label })),
            ]}
          />
        }
        emptyState={{
          title: list.isPending
            ? 'Cargando campañas…'
            : list.isError
              ? 'La lista no está disponible'
              : 'Todavía no hay campañas que coincidan',
          description: 'Crea una oferta y revisa sus condiciones antes de publicarla.',
        }}
      />
      {list.isError && (
        <QueryError
          error={list.error}
          context="cargar las campañas"
          onRetry={() => list.refetch()}
        />
      )}
      {list.data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm tabular">
            {list.data.total} {list.data.total === 1 ? 'campaña' : 'campañas'} · página {page} de{' '}
            {Math.max(1, Math.ceil(list.data.total / 25))}
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
              disabled={page * 25 >= list.data.total || list.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Condiciones de la campaña</DrawerTitle>
            <DrawerSubtitle>Las compras aceptadas conservan su versión.</DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody>
            {selected && (
              <CampaignDetail
                id={selected}
                onChange={refresh}
                onEdit={(campaign, duplicate) => {
                  setSelected(null)
                  setEditing({ campaign, duplicate })
                }}
              />
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <Drawer
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {editing?.duplicate
                ? 'Duplicar campaña'
                : editing?.campaign
                  ? 'Editar borrador'
                  : 'Crear campaña'}
            </DrawerTitle>
            <DrawerSubtitle>Importes en pesos MXN con IVA incluido.</DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody>
            {editing && (
              <HybridCampaignEditor
                key={`${editing.campaign?.id ?? 'new'}:${editing.duplicate}`}
                {...editing}
                onClose={() => setEditing(null)}
                onSaved={(row) => {
                  setEditing(null)
                  setSelected(row.id)
                  void refresh()
                  toast.success('Borrador guardado')
                }}
              />
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function CampaignDetail({
  id,
  onChange,
  onEdit,
}: {
  id: string
  onChange: () => Promise<void>
  onEdit: (campaign: HybridCampaign, duplicate?: boolean) => void
}) {
  const query = useQuery({
    queryKey: [...QUERY, 'detail', id],
    queryFn: () => fetchHybridCampaign(id),
    staleTime: 15000,
  })
  const [confirm, setConfirm] = useState<Exclude<HybridStatus, 'DRAFT'> | null>(null)
  const mutation = useMutation({
    mutationFn: (action: 'PUBLISH' | Exclude<HybridStatus, 'DRAFT'>) =>
      action === 'PUBLISH'
        ? publishHybridCampaign(query.data!)
        : changeHybridStatus(query.data!, action),
    onSuccess: async () => {
      setConfirm(null)
      await onChange()
      await query.refetch()
    },
    onError: (e) => {
      const issue = inspectApiError(e, 'actualizar la campaña')
      toast.error(issue.title, { description: issue.serverMessage ?? issue.description })
    },
  })
  if (query.isPending) return <p role="status">Cargando condiciones…</p>
  if (query.isError)
    return (
      <QueryError error={query.error} context="cargar la campaña" onRetry={() => query.refetch()} />
    )
  const row = query.data,
    publication = row.publications?.[0],
    offer = publication?.definition ?? row.draftDefinition
  const terms = offer.terms
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Status value={row.status} />
        <h2 className="display">{row.name}</h2>
        <p>
          {offer.kind === 'PLAN'
            ? `Plan ${offer.planTier}`
            : offer.kind === 'CHOICE_BUNDLE'
              ? `Elige ${offer.choiceCount} funciones`
              : `${offer.featureCodes.length} funciones específicas`}{' '}
          · <span className="tabular">{hybridPesos(terms.price)}</span> al mes, IVA incluido.
        </p>
        <p className="text-sm text-[var(--ink-muted)]">
          {terms.renewal.kind === 'END'
            ? `Termina después de ${terms.promotionCycles} meses.`
            : terms.renewal.kind === 'REPRICE'
              ? `${terms.promotionCycles} meses de promoción; después ${hybridPesos(terms.renewal.price)} al mes.`
              : 'Renovación al mismo precio.'}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="label">Vigencia · Ciudad de México</dt>
          <dd className="tabular">
            {formatDateTime(row.startsAt)} — {formatDateTime(row.endsAt)}
          </dd>
        </div>
        <div>
          <dt className="label">Lugares</dt>
          <dd className="tabular">
            Contratados: {row.redeemedCount} · Reservados: {row.reservedCount} · Disponibles:{' '}
            {Math.max(0, row.capacity - row.redeemedCount - row.reservedCount)}
          </dd>
        </div>
        <div>
          <dt className="label">Publicación</dt>
          <dd>{publication ? `Versión ${publication.version}` : 'Todavía no publicada'}</dd>
        </div>
        <div>
          <dt className="label">Catálogo</dt>
          <dd>{row.listed ? 'Oferta pública' : 'Sólo mediante enlace'}</dd>
        </div>
      </dl>
      <p className="text-sm text-[var(--ink-muted)]">
        Página de campaña:{' '}
        <a
          className="break-all underline underline-offset-4"
          href={`https://avoqado.io/ofertas/${row.slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          https://avoqado.io/ofertas/{row.slug}
        </a>
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => onEdit(row)} disabled={row.status === 'ENDED'}>
          Editar borrador
        </Button>
        <Button variant="ghost" onClick={() => onEdit(row, true)}>
          Duplicar
        </Button>
        {row.status !== 'ENDED' && (
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate('PUBLISH')}
          >
            Publicar versión sin activar
          </Button>
        )}
      </div>
      {row.status !== 'ENDED' && (
        <section className="space-y-3 border-t border-[var(--line)] pt-5">
          <p className="text-sm text-[var(--ink-muted)]">
            Publicar congela las condiciones y deja la oferta pausada. Activar abre nuevas
            contrataciones; pausar o terminar respeta los pagos e intentos ya aceptados.
          </p>
          <div className="flex flex-wrap gap-3">
            {row.status !== 'ACTIVE' && (
              <Button
                disabled={!publication || mutation.isPending}
                onClick={() => setConfirm('ACTIVE')}
              >
                Activar ventas
              </Button>
            )}
            {row.status === 'ACTIVE' && (
              <Button variant="secondary" onClick={() => setConfirm('PAUSED')}>
                Pausar ventas
              </Button>
            )}
            <Button variant="ghost" onClick={() => setConfirm('ENDED')}>
              Terminar campaña
            </Button>
          </div>
          {confirm && (
            <section className="space-y-3" aria-label="Confirmación de estado">
              <p>
                {confirm === 'ACTIVE'
                  ? `Se abrirán nuevas contrataciones de ${row.name} con el precio y la renovación mostrados.`
                  : confirm === 'PAUSED'
                    ? 'Se detendrán nuevas contrataciones hasta que la reactives.'
                    : 'La campaña terminará. Para vender de nuevo tendrás que duplicarla.'}
              </p>
              <div className="flex gap-2">
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate(confirm)}>
                  {confirm === 'ACTIVE'
                    ? 'Confirmar activación'
                    : confirm === 'PAUSED'
                      ? 'Confirmar pausa'
                      : 'Confirmar finalización'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Volver
                </Button>
              </div>
            </section>
          )}
        </section>
      )}
      <Redemptions campaignId={id} />
    </div>
  )
}

function Redemptions({ campaignId }: { campaignId: string }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])
  const query = useQuery({
    queryKey: [...QUERY, campaignId, 'redemptions', page, q, status],
    queryFn: () =>
      fetchHybridRedemptions(campaignId, { page, pageSize: 25, q, ...(status ? { status } : {}) }),
    staleTime: 15000,
  })
  const columns = useMemo<ColumnDef<HybridRedemption, unknown>[]>(
    () => [
      {
        accessorKey: 'venueName',
        header: 'Negocio',
        cell: ({ row }) => (
          <Link className="underline underline-offset-4" to={`/venues/${row.original.venueId}`}>
            {row.original.venueName}
          </Link>
        ),
        enableSorting: false,
      },
      {
        id: 'status',
        header: 'Contratación',
        cell: ({ row }) => (
          <span>
            {row.original.lastIssue
              ? 'Revisión de pago pendiente'
              : row.original.status === 'REDEEMED'
                ? 'Contratada'
                : row.original.status === 'RELEASED'
                  ? 'Lugar liberado'
                  : 'Esperando pago'}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'amount',
        header: 'Total de hoy',
        cell: ({ row }) => (
          <span className="tabular">{hybridPesos(Number(row.original.dueNow))}</span>
        ),
        enableSorting: false,
      },
      {
        id: 'expires',
        header: 'Ventana de pago · CDMX',
        cell: ({ row }) =>
          row.original.paymentExpiresAt ? formatDateTime(row.original.paymentExpiresAt) : '—',
        enableSorting: false,
      },
    ],
    [],
  )
  return (
    <section className="space-y-3 border-t border-[var(--line)] pt-5">
      <h3 className="eyebrow">Contrataciones y lugares reservados</h3>
      <p className="text-sm text-[var(--ink-muted)]">
        Una respuesta de pago pendiente conserva el lugar hasta verificar el resultado. La
        conciliación retoma el mismo intento.
      </p>
      <DataTable
        data={query.data?.items ?? []}
        columns={columns}
        serverSearch={{ value: search, onChange: setSearch }}
        searchPlaceholder="Buscar negocio"
        minWidth={580}
        toolbar={
          <Combobox
            className="sm:w-48 sm:shrink-0"
            ariaLabel="Estado de contratación"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Todos' },
              { value: 'RESERVED', label: 'Reservados' },
              { value: 'REDEEMED', label: 'Contratados' },
              { value: 'RELEASED', label: 'Liberados' },
            ]}
          />
        }
        emptyState={{
          title: query.isPending
            ? 'Cargando contrataciones…'
            : query.isError
              ? 'Lista no disponible'
              : 'No hay contrataciones con estos filtros',
        }}
      />
      {query.isError && (
        <QueryError
          error={query.error}
          context="cargar las contrataciones"
          onRetry={() => query.refetch()}
        />
      )}
      {query.data && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="tabular">
            {query.data.total} {query.data.total === 1 ? 'contratación' : 'contrataciones'} · página{' '}
            {page}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Página anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={page * 25 >= query.data.total || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Página siguiente
          </Button>
        </div>
      )}
    </section>
  )
}
