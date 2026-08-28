import { useMemo, useState } from 'react'
import { Drawer, DrawerClose, DrawerContent } from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { IconButton } from '@/shared/ui/IconButton'
import { X } from 'lucide-react'
import { AudienceFiltersEditor } from './AudienceFilters'
import { BlocksEditor } from './BlocksEditor'
import { AnnouncementPreview } from './AnnouncementPreview'
import { useDebounced } from './useDebounced'
import { useAudiencePreview, useCreateAnnouncement, usePublishAnnouncement } from './use-announcements'
import type { AudienceFilters, ContentBlock } from './types'

const FILTROS_INICIALES: AudienceFilters = {
  audienceRoles: ['OWNER', 'ADMIN'],
  targetPlanTiers: [],
  targetCategories: [],
  targetVenueIds: [],
}

export function AnnouncementEditor({ abierto, onClose }: { abierto: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [showAsBanner, setShowAsBanner] = useState(true)
  const [showAsModal, setShowAsModal] = useState(false)
  const [filters, setFilters] = useState<AudienceFilters>(FILTROS_INICIALES)
  const [bloques, setBloques] = useState<ContentBlock[]>([])

  // Debounce: sin esto sería una consulta por tecla, y del otro lado recorre los
  // vínculos de todo el personal de la plataforma.
  const filtrosDebounced = useDebounced(filters, 350)
  const preview = useAudiencePreview(filtrosDebounced, abierto && filtrosDebounced.audienceRoles.length > 0)

  const crear = useCreateAnnouncement()
  const publicar = usePublishAnnouncement()

  const puedeGuardar = useMemo(
    () =>
      title.trim().length > 0 &&
      body.trim().length > 0 &&
      filters.audienceRoles.length > 0 &&
      // Un botón sin destino es un botón que no hace nada: mejor impedirlo aquí que
      // dejar al negocio tocándolo sin que pase nada.
      (!actionLabel.trim() || actionUrl.trim().length > 0),
    [title, body, filters.audienceRoles.length, actionLabel, actionUrl],
  )

  const limpiar = () => {
    setTitle('')
    setBody('')
    setActionLabel('')
    setActionUrl('')
    setBloques([])
    setShowAsModal(false)
    setFilters(FILTROS_INICIALES)
  }

  /**
   * Deja fuera los bloques que quedaron a medias y completa lo que se puede deducir.
   *
   * 🔴 Existe porque el servidor rechazaba el anuncio ENTERO si alguien agregaba un
   * bloque y no lo llenaba — algo tan fácil como tocar "+ Subtítulo" y arrepentirse. Un
   * bloque vacío no aporta nada: se descarta y ya. Y la descripción de una foto, si falta,
   * se rellena con el título del anuncio en vez de bloquear la publicación.
   */
  const limpiarBloques = (lista: ContentBlock[], titulo: string): ContentBlock[] =>
    lista.flatMap<ContentBlock>(b => {
      switch (b.type) {
        case 'heading':
        case 'paragraph':
        case 'callout':
          return b.text.trim() ? [{ ...b, text: b.text.trim() }] : []
        case 'bullets': {
          const items = b.items.map(i => i.trim()).filter(Boolean)
          return items.length ? [{ ...b, items }] : []
        }
        case 'image':
          if (!b.url.trim()) return []
          return [{ ...b, url: b.url.trim(), alt: b.alt.trim() || titulo, caption: b.caption?.trim() || undefined }]
        case 'gallery': {
          const images = b.images.filter(i => i.url.trim()).map(i => ({ ...i, alt: i.alt.trim() || titulo }))
          return images.length ? [{ ...b, images }] : []
        }
        case 'specs': {
          const rows = b.rows.filter(r => r.label.trim()).map(r => ({ label: r.label.trim(), value: r.value.trim() }))
          return rows.length ? [{ ...b, rows }] : []
        }
        case 'button':
          return b.label.trim() && b.url.trim() ? [b] : []
        default:
          return [b]
      }
    })

  const guardar = async (publicarAhora: boolean) => {
    const limpios = limpiarBloques(bloques, title.trim())
    const anuncio = await crear.mutateAsync({
      title: title.trim(),
      body: body.trim(),
      priority: 'NORMAL',
      actionLabel: actionLabel.trim() || undefined,
      actionUrl: actionUrl.trim() || undefined,
      contentBlocks: limpios.length > 0 ? limpios : undefined,
      showAsBanner,
      showAsModal,
      ...filters,
    })
    if (publicarAhora) await publicar.mutateAsync({ id: anuncio.id })
    limpiar()
    onClose()
  }

  const trabajando = crear.isPending || publicar.isPending
  const nadieLoRecibe = preview.data?.venues === 0

  return (
    <Drawer open={abierto} onOpenChange={v => !v && onClose()}>
      {/* Sin `max-w` propio: el default del repo (640px) ya está calibrado y en una
          ventana angosta un ancho mayor desborda el contenido. Una sola columna por la
          misma razón — un grid de 2 columnas aquí adentro no respira. */}
      <DrawerContent>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-strong)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium tracking-[-0.005em] text-[var(--ink)]">Nuevo anuncio</h2>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
              Les llega al buzón del dashboard, Android e iOS.
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
            <section className="space-y-4">
              <Field
                label="Título"
                name="titulo"
                value={title}
                placeholder="Ya está disponible la terminal Sunmi D3"
                onChange={e => setTitle(e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cuerpo" className="text-[12px] font-medium tracking-[-0.005em] text-[var(--ink)]">
                  Texto del aviso
                </label>
                <textarea
                  id="cuerpo"
                  rows={3}
                  value={body}
                  placeholder="Dos pantallas: tu cajero cobra de un lado mientras el cliente hace su check-in del otro."
                  onChange={e => setBody(e.target.value)}
                  className="w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2 text-[14px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Texto del botón"
                  name="cta"
                  value={actionLabel}
                  placeholder="Quiero una"
                  hint="Opcional. Sin texto, el anuncio no lleva botón."
                  onChange={e => setActionLabel(e.target.value)}
                />
                <Field
                  label="Enlace del botón"
                  name="ctaUrl"
                  type="url"
                  value={actionUrl}
                  placeholder="https://avoqado.io/terminales"
                  hint="A dónde lleva. Se abre en una pestaña nueva."
                  error={
                    actionLabel.trim() && !actionUrl.trim()
                      ? 'Pon el enlace o el botón no hará nada'
                      : undefined
                  }
                  onChange={e => setActionUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 text-[13px] text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={showAsBanner}
                    onChange={e => setShowAsBanner(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>Mostrarlo también como banner en su pantalla de inicio</span>
                </label>

                <label className="flex items-start gap-2.5 text-[13px] text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={showAsModal}
                    onChange={e => setShowAsModal(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    Interrumpir con una ventana la próxima vez que entren
                    <span className="mt-0.5 block text-[12px] text-[var(--ink-faint)]">
                      Se cierra una vez y después se queda en la campana. Úsalo sólo para lo que no se
                      puede perder — si todo interrumpe, dejan de leerlo.
                    </span>
                  </span>
                </label>
              </div>
            </section>

            <section className="space-y-3 border-t border-[var(--line-strong)] pt-5">
              <h3 className="text-[13px] font-medium text-[var(--ink)]">A quién le llega</h3>
              <AudienceFiltersEditor
                filters={filters}
                onChange={setFilters}
                preview={preview.data}
                cargando={preview.isFetching}
              />
            </section>

            <section className="space-y-3 border-t border-[var(--line-strong)] pt-5">
              <div>
                <h3 className="text-[13px] font-medium text-[var(--ink)]">Contenido ampliado</h3>
                <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">Se ve cuando le hacen clic al anuncio.</p>
              </div>
              <BlocksEditor bloques={bloques} onChange={setBloques} />
            </section>

            <section className="space-y-3 border-t border-[var(--line-strong)] pt-5">
              <h3 className="text-[13px] font-medium text-[var(--ink)]">Así lo van a ver</h3>
              <AnnouncementPreview
                title={title}
                body={body}
                bloques={bloques}
                actionLabel={actionUrl.trim() ? actionLabel : ''}
              />
            </section>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--line-strong)] px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={trabajando}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => guardar(false)} disabled={!puedeGuardar || trabajando}>
            Guardar borrador
          </Button>
          <Button onClick={() => guardar(true)} disabled={!puedeGuardar || trabajando || nadieLoRecibe}>
            Publicar
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
