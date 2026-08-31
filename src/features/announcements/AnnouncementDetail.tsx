import { Drawer, DrawerClose, DrawerContent } from '@/shared/ui/Drawer'
import { IconButton } from '@/shared/ui/IconButton'
import { Badge } from '@/shared/ui/Badge'
import { X } from 'lucide-react'
import { AnnouncementPreview } from './AnnouncementPreview'
import { useAnnouncementMetrics } from './use-announcements'
import type { Announcement } from './types'

const ROL: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Admin',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
  WAITER: 'Mesero',
  KITCHEN: 'Cocina',
  HOST: 'Host',
  VIEWER: 'Solo lectura',
}

const GIRO: Record<string, string> = {
  FOOD_SERVICE: 'Restaurantes',
  RETAIL: 'Tiendas',
  SERVICES: 'Servicios',
  HOSPITALITY: 'Hospedaje',
  ENTERTAINMENT: 'Entretenimiento',
  OTHER: 'Otros',
}

/** Un número grande con su etiqueta y, si aplica, qué porcentaje representa. */
function Metrica({ valor, etiqueta, de }: { valor: number; etiqueta: string; de?: number }) {
  const pct = de && de > 0 ? Math.round((valor / de) * 100) : null
  return (
    <div className="rounded-[8px] border border-[var(--line-strong)] px-3.5 py-3">
      <div className="tabular text-[22px] font-medium leading-none text-[var(--ink)]">{valor}</div>
      <div className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{etiqueta}</div>
      {pct !== null && (
        <div className="mt-0.5 text-[12px] text-[var(--ink-faint)]">
          {pct}% de los que lo recibieron
        </div>
      )}
    </div>
  )
}

/**
 * El detalle de un anuncio: qué mandaste y qué pasó con él.
 *
 * 🔴 Las métricas se muestran SEPARADAS y nunca sumadas, porque miden cosas distintas:
 * "leído" es marcar el aviso en la campana (se puede hacer sin leer nada), "abierto" es
 * haber entrado al contenido. Juntarlas daría un número que no significa nada.
 */
export function AnnouncementDetail({
  anuncio,
  onClose,
}: {
  anuncio: Announcement | null
  onClose: () => void
}) {
  const metricas = useAnnouncementMetrics(anuncio?.id ?? null)
  if (!anuncio) return null

  const m = metricas.data
  const sinAbrir = m ? Math.max(0, m.reachedPeople - m.opened) : 0

  return (
    <Drawer open onOpenChange={(abierto) => !abierto && onClose()}>
      <DrawerContent>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-strong)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium text-[var(--ink)]">{anuncio.title}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
              {anuncio.publishedAt ? `Publicado por ${anuncio.createdByName}` : 'Borrador'}
            </p>
          </div>
          <DrawerClose asChild>
            <IconButton aria-label="Cerrar">
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </DrawerClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-[13px] font-medium text-[var(--ink)]">Qué pasó con él</h3>
              {metricas.isLoading ? (
                <p className="text-[13px] text-[var(--ink-muted)]">Contando…</p>
              ) : m ? (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Metrica valor={m.reachedPeople} etiqueta="Personas alcanzadas" />
                    <Metrica valor={m.reachedVenues} etiqueta="Negocios alcanzados" />
                    <Metrica valor={m.opened} etiqueta="Lo abrieron" de={m.reachedPeople} />
                    <Metrica valor={sinAbrir} etiqueta="No lo han abierto" de={m.reachedPeople} />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Metrica valor={m.read} etiqueta="Marcado como leído" de={m.reachedPeople} />
                    <Metrica valor={m.cta} etiqueta="Tocaron el botón" de={m.reachedPeople} />
                  </div>
                  <p className="text-[12px] text-[var(--ink-faint)]">
                    «Marcado como leído» y «lo abrieron» no son lo mismo: la campana marca leído al
                    abrirse, sin que nadie entre al anuncio. Los porcentajes van sobre personas.
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-[var(--ink-muted)]">Todavía no se ha publicado.</p>
              )}
            </section>

            <section className="space-y-3 border-t border-[var(--line-strong)] pt-5">
              <h3 className="text-[13px] font-medium text-[var(--ink)]">A quién se lo mandaste</h3>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[var(--ink-muted)]">Roles:</span>
                  {anuncio.audienceRoles.map((r) => (
                    <Badge key={r}>{ROL[r] ?? r}</Badge>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[var(--ink-muted)]">Plan:</span>
                  {anuncio.targetPlanTiers.length === 0 ? (
                    <span className="text-[var(--ink-faint)]">todos</span>
                  ) : (
                    anuncio.targetPlanTiers.map((p) => <Badge key={p}>{p}</Badge>)
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[var(--ink-muted)]">Giro:</span>
                  {anuncio.targetCategories.length === 0 ? (
                    <span className="text-[var(--ink-faint)]">todos</span>
                  ) : (
                    anuncio.targetCategories.map((c) => <Badge key={c}>{GIRO[c] ?? c}</Badge>)
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[var(--ink-muted)]">Dónde se ve:</span>
                  <Badge>Campana</Badge>
                  {anuncio.showAsBanner && <Badge>Banner</Badge>}
                  {anuncio.showAsModal && <Badge tone="accent">Ventana</Badge>}
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-[var(--line-strong)] pt-5">
              <h3 className="text-[13px] font-medium text-[var(--ink)]">Qué mandaste</h3>
              <AnnouncementPreview
                title={anuncio.title}
                body={anuncio.body}
                bloques={anuncio.contentBlocks ?? []}
                actionLabel={anuncio.actionLabel ?? undefined}
              />
            </section>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
