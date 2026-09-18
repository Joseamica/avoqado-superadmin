import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, X } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/data-table/DataTable'
import { Drawer, DrawerClose, DrawerContent, DrawerSubtitle, DrawerTitle } from '@/shared/ui/Drawer'
import { IconButton } from '@/shared/ui/IconButton'
import { QueryError } from '@/shared/components/QueryError'
import { formatDateTime } from '@/shared/lib/datetime'
import { centsToLabel } from './money'
import { estadoDeLaCampana, reservasEstancadas } from './campaign-status'
import { useLaunchCampaign, useRedemptions, useReservasVivas } from './use-launch-campaigns'
import type { LaunchCampaignRedemptionStatus, LaunchCampaignRow, RedemptionRow } from './types'

const ESTADO_REDENCION: Record<
  LaunchCampaignRedemptionStatus,
  { label: string; tone: 'muted' | 'success' | 'warn' }
> = {
  RESERVED: { label: 'Apartado', tone: 'warn' },
  APPLIED: { label: 'Cobrado', tone: 'success' },
  RELEASED: { label: 'Liberado', tone: 'muted' },
}

function Metrica({
  valor,
  etiqueta,
  ayuda,
}: {
  valor: number | string
  etiqueta: string
  ayuda?: string
}) {
  return (
    <div className="rounded-[8px] border border-[var(--line-strong)] px-3.5 py-3">
      <div className="tabular text-[22px] font-medium leading-none text-[var(--ink)]">{valor}</div>
      <div className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{etiqueta}</div>
      {ayuda && <div className="mt-0.5 text-[12px] text-[var(--ink-faint)]">{ayuda}</div>}
    </div>
  )
}

/**
 * El detalle: qué está haciendo la campaña y quién pagó con ella.
 *
 * Las métricas van SEPARADAS y nunca sumadas, porque miden cosas distintas:
 * "reclamadas" son altas que dijeron venir del anuncio (hayan pagado o no) y
 * "cobradas" son las que pagaron. Juntarlas daría un número que no significa nada.
 */
export function LaunchCampaignDetail({
  campana,
  onClose,
}: {
  campana: LaunchCampaignRow | null
  onClose: () => void
}) {
  return (
    <Drawer open={campana !== null} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-w-[760px]">
        {campana && <ContenidoDelDetalle campanaId={campana.id} inicial={campana} />}
      </DrawerContent>
    </Drawer>
  )
}

function ContenidoDelDetalle({
  campanaId,
  inicial,
}: {
  campanaId: string
  inicial: LaunchCampaignRow
}) {
  const detalle = useLaunchCampaign(campanaId)
  const redenciones = useRedemptions(campanaId)
  const reservadas = useReservasVivas(campanaId)

  // Mientras el detalle carga se usa la fila de la lista: la cabecera nunca sale
  // vacía, y los números que sólo existen en el detalle se marcan como tales.
  const c = detalle.data ?? inicial
  const estado = estadoDeLaCampana(c)
  const m = detalle.data?.metrics

  const filasReservadas = reservadas.data?.rows ?? []
  // 🔴 El número que manda es el del SERVIDOR (`metrics.staleReserved`), que lo
  // cuenta sobre TODAS las filas. Aquí sólo hay la primera página de apartados
  // —100, y ordenadas de la más nueva a la más vieja—, así que en una campaña con
  // más de 100 apartados los rancios caen en la página 2 y el recuento local da
  // 0. Y 0 no pinta una alerta más chica: no pinta ninguna, que es exactamente la
  // ceguera que esta alerta existe para quitar.
  const minutosRancio = m?.staleReservedMinutes ?? 30
  const delServidor = m?.staleReserved
  const contadoPorElServidor = typeof delServidor === 'number'
  // El recuento local sobrevive como respaldo: un servidor que todavía no manda
  // el campo (o el detalle aún cargando) deja un aviso aproximado, no ninguno.
  const estancadas = contadoPorElServidor
    ? delServidor
    : reservasEstancadas(filasReservadas, new Date(), minutosRancio * 60_000)
  // "Al menos" es la marca de que el número es una COTA INFERIOR medida sobre las
  // filas cargadas. Con el conteo del servidor no aplica: ése ya los vio todos.
  const hayMas =
    !contadoPorElServidor && (reservadas.data?.meta.total ?? 0) > filasReservadas.length

  const filas = useMemo(
    () => redenciones.data?.pages.flatMap((p) => p.rows) ?? [],
    [redenciones.data],
  )
  const total = redenciones.data?.pages[0]?.meta.total ?? 0

  const columns = useMemo<ColumnDef<RedemptionRow, unknown>[]>(
    () => [
      {
        accessorKey: 'organization',
        header: 'Negocio',
        accessorFn: (r) => `${r.organization.name} ${r.venue?.name ?? ''}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] text-[var(--ink)]">
              {row.original.organization.name}
            </div>
            {row.original.venue && (
              <div className="truncate text-[12px] text-[var(--ink-muted)]">
                {row.original.venue.name}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const e = ESTADO_REDENCION[row.original.status]
          return <Badge tone={e.tone}>{e.label}</Badge>
        },
      },
      {
        accessorKey: 'advertisedPriceCents',
        header: () => <span className="block text-right">Precio que aceptó</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <div className="tabular text-[13px] text-[var(--ink)]">
              {centsToLabel(row.original.advertisedPriceCents)}
            </div>
            <div className="tabular text-[12px] text-[var(--ink-muted)]">
              × {row.original.discountMonths} {row.original.discountMonths === 1 ? 'mes' : 'meses'}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'utmSource',
        header: 'Atribución',
        cell: ({ row }) => {
          const r = row.original
          const partes = [r.acquisitionSource, r.utmSource, r.utmCampaign].filter(Boolean)
          return partes.length ? (
            <span className="text-[12px] text-[var(--ink-muted)]">{partes.join(' · ')}</span>
          ) : (
            <span className="text-[13px] text-[var(--ink-faint)]">—</span>
          )
        },
      },
      {
        accessorKey: 'reservedAt',
        header: 'Apartado',
        cell: ({ row }) => (
          <span className="tabular text-[12px] text-[var(--ink-muted)]">
            {formatDateTime(row.original.reservedAt)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line-strong)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DrawerTitle className="font-sans text-[15px] font-medium">{c.code}</DrawerTitle>
            <Badge tone={estado.tone}>{estado.label}</Badge>
          </div>
          <DrawerSubtitle>{c.name}</DrawerSubtitle>
        </div>
        <DrawerClose asChild>
          <IconButton aria-label="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </DrawerClose>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <p className="text-[13px] text-[var(--ink-muted)]">{estado.explicacion}</p>

        {detalle.isError && (
          <QueryError
            error={detalle.error}
            context="cargar el detalle de la campaña"
            onRetry={() => detalle.refetch()}
          />
        )}

        {/* 🔴 La alerta de lugares estancados. No es opcional: es lo único que
            hace visible que el cupo se está consumiendo con reservas muertas. */}
        {estancadas > 0 && (
          <div className="flex items-start gap-2.5 rounded-[8px] bg-[var(--warn-faint)] px-3.5 py-3 text-[13px] text-[var(--warn)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                {hayMas ? 'Al menos ' : ''}
                {estancadas} {estancadas === 1 ? 'lugar apartado' : 'lugares apartados'} hace más de{' '}
                {minutosRancio} min
              </p>
              <p className="mt-0.5">
                Un lugar apartado sigue contando contra el cupo hasta que el cobro se completa o
                falla. Si nadie reintenta, ese lugar no se libera solo: revísalos antes de concluir
                que la campaña se llenó.
              </p>
            </div>
          </div>
        )}

        <section>
          <h3 className="mb-2.5 text-[13px] font-medium text-[var(--ink)]">Cómo va</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Metrica
              valor={m ? `${m.count} / ${m.cap}` : `${c.redemptionCount} / ${c.redemptionCap}`}
              etiqueta="Cupo usado"
              ayuda="Apartados + cobrados"
            />
            <Metrica valor={m?.applied ?? '—'} etiqueta="Cobradas" ayuda="Ya pagaron" />
            <Metrica valor={m?.reserved ?? '—'} etiqueta="Apartadas" ayuda="Cobro en curso" />
            <Metrica
              valor={m?.claimed ?? '—'}
              etiqueta="Reclamadas"
              ayuda="Altas que dijeron venir de aquí"
            />
            <Metrica
              valor={m?.released ?? '—'}
              etiqueta="Liberadas"
              ayuda="No cobraron; no ocupan cupo"
            />
            <Metrica
              valor={centsToLabel(c.advertisedPriceCents)}
              etiqueta="Precio anunciado"
              ayuda={`${c.discountMonths} ${c.discountMonths === 1 ? 'mes' : 'meses'} · ${c.planTier === 'PRO' ? 'Pro' : 'Premium'}`}
            />
          </div>
        </section>

        <section className="space-y-2 border-t border-[var(--line-strong)] pt-5">
          <h3 className="text-[13px] font-medium text-[var(--ink)]">Ficha</h3>
          <dl className="grid gap-1.5 text-[13px] sm:grid-cols-2">
            <Dato termino="Landing" valor={`/oferta/${c.landingSlug}`} />
            <Dato termino="Cupón en Stripe" valor={c.stripeCouponId ?? 'todavía no se ha creado'} />
            <Dato
              termino="Precio de lista congelado"
              valor={centsToLabel(c.listPriceCentsSnapshot)}
            />
            <Dato termino="Descuento del cupón" valor={centsToLabel(c.discountAmountCents)} />
            <Dato
              termino="Vigencia"
              valor={`${formatDateTime(c.validFrom)} → ${formatDateTime(c.validUntil)}`}
            />
            <Dato
              termino="Activada"
              valor={c.activatedAt ? formatDateTime(c.activatedAt) : 'nunca'}
            />
          </dl>
        </section>

        <section className="space-y-3 border-t border-[var(--line-strong)] pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-medium text-[var(--ink)]">Quién la usó</h3>
            <span className="tabular text-[12px] text-[var(--ink-faint)]">
              {filas.length} de {total}
            </span>
          </div>

          {redenciones.isError ? (
            <QueryError
              error={redenciones.error}
              context="cargar las redenciones"
              onRetry={() => redenciones.refetch()}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={filas}
                minWidth={620}
                searchPlaceholder="Buscar negocio… (entre las cargadas)"
                emptyState={{
                  title: redenciones.isLoading
                    ? 'Cargando…'
                    : 'Nadie ha usado esta campaña todavía',
                  description: redenciones.isLoading
                    ? undefined
                    : 'Aquí aparece cada negocio que aceptó la oferta, con el precio que se le prometió.',
                }}
                caption="Redenciones de la campaña"
              />
              {redenciones.hasNextPage && (
                <div className="flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => redenciones.fetchNextPage()}
                    disabled={redenciones.isFetchingNextPage}
                  >
                    {redenciones.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--ink-muted)]">{termino}</dt>
      <dd className="tabular truncate text-[var(--ink)]">{valor}</dd>
    </div>
  )
}
