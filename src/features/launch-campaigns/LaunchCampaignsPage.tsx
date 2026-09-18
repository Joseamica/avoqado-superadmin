import { useCallback, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { formatDate } from '@/shared/lib/datetime'
import { centsToLabel } from './money'
import { estadoDeLaCampana } from './campaign-status'
import { useLaunchCampaigns } from './use-launch-campaigns'
import { LaunchCampaignEditor } from './LaunchCampaignEditor'
import { LaunchCampaignDetail } from './LaunchCampaignDetail'
import { LaunchCampaignStatusActions } from './LaunchCampaignStatusActions'
import type { LaunchCampaignRow, LaunchCampaignStatus } from './types'

const FILTROS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'PAUSED', label: 'Pausadas' },
  { value: 'ENDED', label: 'Terminadas' },
]

const VERTICAL: Record<string, string> = {
  ALL: 'Todos',
  FOOD_SERVICE: 'Restaurantes',
  RETAIL: 'Tiendas',
  SERVICES: 'Servicios',
  HOSPITALITY: 'Hospedaje',
  ENTERTAINMENT: 'Entretenimiento',
}

/**
 * El esqueleto de carga.
 *
 * 🔴 `DataTable` no tiene estado de carga: con `data=[]` pinta su estado vacío,
 * así que sin esto la pantalla dice "Todavía no hay campañas" durante el primer
 * fetch — le afirma al operador justo lo contrario de lo que está pasando, y en
 * una consola de operación eso es suficiente para que alguien cree una campaña
 * duplicada.
 */
function EsqueletoDeLista() {
  return (
    <div
      className="space-y-2 rounded-[10px] border border-[var(--line)] p-3"
      role="status"
      aria-label="Cargando campañas"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--canvas-raised)]" />
          <div className="h-4 flex-1 animate-pulse rounded bg-[var(--canvas-raised)]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[var(--canvas-raised)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--canvas-raised)]" />
        </div>
      ))}
      <span className="sr-only">Cargando campañas…</span>
    </div>
  )
}

export function LaunchCampaignsPage() {
  const [filtro, setFiltro] = useState<string>('')
  const campanas = useLaunchCampaigns(
    filtro ? { status: filtro as LaunchCampaignStatus, pageSize: 100 } : { pageSize: 100 },
  )
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [editando, setEditando] = useState<LaunchCampaignRow | null>(null)
  const [detalle, setDetalle] = useState<LaunchCampaignRow | null>(null)

  const abrirNueva = () => {
    setEditando(null)
    setEditorAbierto(true)
  }
  const abrirEdicion = useCallback((c: LaunchCampaignRow) => {
    setEditando(c)
    setEditorAbierto(true)
  }, [])
  const cerrarEditor = () => {
    setEditorAbierto(false)
    setEditando(null)
  }

  const columns = useMemo<ColumnDef<LaunchCampaignRow, unknown>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Campaña',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setDetalle(row.original)}
            className="min-w-0 max-w-full text-left transition-colors hover:text-[var(--ink)]"
          >
            <div className="tabular truncate text-[13px] text-[var(--ink)] underline decoration-transparent underline-offset-2 transition-colors hover:decoration-[var(--ink-faint)]">
              {row.original.code}
            </div>
            <div className="truncate text-[12px] text-[var(--ink-muted)]">{row.original.name}</div>
          </button>
        ),
      },
      {
        accessorKey: 'vertical',
        header: 'Giro',
        cell: ({ row }) => (
          <span className="text-[13px] text-[var(--ink-muted)]">
            {VERTICAL[row.original.vertical] ?? row.original.vertical}
          </span>
        ),
      },
      {
        accessorKey: 'advertisedPriceCents',
        header: () => <span className="block text-right">Oferta</span>,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="text-right">
              <div className="tabular text-[13px] text-[var(--ink)]">
                {centsToLabel(c.advertisedPriceCents)} × {c.discountMonths}{' '}
                {c.discountMonths === 1 ? 'mes' : 'meses'}
              </div>
              <div className="text-[12px] text-[var(--ink-muted)]">
                {c.planTier === 'PRO' ? 'Pro' : 'Premium'} · después{' '}
                <span className="tabular">{centsToLabel(c.listPriceCentsSnapshot)}</span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'redemptionCount',
        header: () => <span className="block text-right">Cupo</span>,
        cell: ({ row }) => {
          const c = row.original
          const lleno = c.redemptionCount >= c.redemptionCap
          return (
            <div className="text-right">
              <div
                className={`tabular text-[13px] ${lleno ? 'text-[var(--danger)]' : 'text-[var(--ink)]'}`}
              >
                {c.redemptionCount} / {c.redemptionCap}
              </div>
              {lleno && <div className="text-[12px] text-[var(--danger)]">sin lugares</div>}
            </div>
          )
        },
      },
      {
        accessorKey: 'validUntil',
        header: 'Vigencia',
        cell: ({ row }) => (
          <div className="tabular text-[12px] text-[var(--ink-muted)]">
            {formatDate(row.original.validFrom)} → {formatDate(row.original.validUntil)}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          // 🔴 El badge NO pinta `status` a secas: una ficha ACTIVE puede estar
          // vencida, llena o sin arrancar, y en los tres casos la landing no la
          // ofrece. `estadoDeLaCampana` responde lo mismo que el endpoint público.
          const e = estadoDeLaCampana(row.original)
          return (
            <span title={e.explicacion}>
              <Badge tone={e.tone}>{e.label}</Badge>
            </span>
          )
        },
      },
      {
        id: 'acciones',
        header: () => <span className="sr-only">Acciones</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="flex items-center justify-end gap-1.5">
              {c.status !== 'ENDED' && (
                <Button size="sm" variant="ghost" onClick={() => abrirEdicion(c)}>
                  Editar
                </Button>
              )}
              <LaunchCampaignStatusActions campana={c} />
            </div>
          )
        },
      },
    ],
    [abrirEdicion],
  )

  const filas = campanas.data?.rows ?? []
  const total = campanas.data?.meta.total ?? 0
  const activas = filas.filter((c) => estadoDeLaCampana(c).vendiendo).length

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Campañas de lanzamiento
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Cada anuncio con su precio, su cupo y su vigencia. Quien llega de la landing paga lo que
            dice la ficha, y aquí se ve quién pagó.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              ·{' '}
              {campanas.isLoading
                ? 'cargando…'
                : `${total} ${total === 1 ? 'campaña' : 'campañas'}, ${activas} ofreciéndose ahora`}
            </span>
          </p>
        </div>
        <Button size="lg" className="shrink-0" onClick={abrirNueva}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nueva campaña
        </Button>
      </header>

      {campanas.isError && (
        <QueryError
          className="mb-5"
          error={campanas.error}
          context="cargar las campañas"
          onRetry={() => campanas.refetch()}
        />
      )}

      {campanas.isLoading ? (
        <EsqueletoDeLista />
      ) : (
        <DataTable
          columns={columns}
          data={filas}
          minWidth={960}
          searchPlaceholder="Buscar por código o nombre…"
          toolbar={
            <Combobox
              value={filtro}
              onChange={setFiltro}
              options={FILTROS}
              ariaLabel="Filtrar por estado"
              width={220}
            />
          }
          emptyState={{
            title: filtro ? 'Ninguna campaña con ese estado' : 'Todavía no hay campañas',
            description: filtro
              ? 'Quita el filtro para ver el resto.'
              : 'Crea la primera para que un anuncio tenga una oferta que cobrar.',
          }}
          caption="Campañas de lanzamiento"
        />
      )}

      {/* El `key` remonta el formulario al pasar de una ficha a otra: sin él React
          reusa el estado y arrastra el precio de la campaña anterior. */}
      <LaunchCampaignEditor
        key={editando?.id ?? 'nueva'}
        abierto={editorAbierto}
        onClose={cerrarEditor}
        campana={editando}
      />
      <LaunchCampaignDetail campana={detalle} onClose={() => setDetalle(null)} />
    </div>
  )
}
