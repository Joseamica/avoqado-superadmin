import { useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import { uploadAnnouncementImage } from './api'
import { IconButton } from '@/shared/ui/IconButton'
import type { ContentBlock } from './types'

const NUEVOS: Array<{ label: string; make: () => ContentBlock }> = [
  { label: 'Subtítulo', make: () => ({ type: 'heading', text: '' }) },
  { label: 'Texto', make: () => ({ type: 'paragraph', text: '' }) },
  { label: 'Viñetas', make: () => ({ type: 'bullets', items: [''] }) },
  { label: 'Foto', make: () => ({ type: 'image', url: '', alt: '' }) },
  { label: 'Ficha técnica', make: () => ({ type: 'specs', rows: [{ label: '', value: '' }] }) },
  { label: 'Recuadro', make: () => ({ type: 'callout', tone: 'info', text: '' }) },
  { label: 'Botón', make: () => ({ type: 'button', label: '', url: '' }) },
  { label: 'Separador', make: () => ({ type: 'divider' }) },
]

// Mismas medidas que `Field` (h-10 / px-3 / 14px) para que no se vean de dos tamaños
// distintos junto a los campos con etiqueta.
const input =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

const textarea = input.replace('h-10 ', '') + ' py-2 leading-relaxed'

/**
 * Editor del contenido ampliado — lo que se ve al hacer clic en el anuncio.
 *
 * Los bloques se guardan como una lista ordenada y cada cliente los pinta nativo (React,
 * Compose, SwiftUI). Por eso NO es HTML ni markdown: un WebView en las apps se ve ajeno e
 * ignora el tema oscuro.
 */
export function BlocksEditor({
  bloques,
  onChange,
}: {
  bloques: ContentBlock[]
  onChange: (b: ContentBlock[]) => void
}) {
  const [subiendo, setSubiendo] = useState<number | null>(null)
  const reemplazar = (i: number, b: ContentBlock) =>
    onChange(bloques.map((x, j) => (j === i ? b : x)))
  const quitar = (i: number) => onChange(bloques.filter((_, j) => j !== i))
  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= bloques.length) return
    const copia = [...bloques]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    onChange(copia)
  }

  return (
    <div className="space-y-3">
      {bloques.map((b, i) => (
        <div key={i} className="rounded-[8px] border border-[var(--line-strong)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] uppercase tracking-wide text-[var(--ink-faint)]">
              {b.type}
            </span>
            <div className="flex gap-0.5">
              <IconButton
                size="sm"
                onClick={() => mover(i, -1)}
                aria-label="Subir bloque"
                disabled={i === 0}
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
              <IconButton
                size="sm"
                onClick={() => mover(i, 1)}
                aria-label="Bajar bloque"
                disabled={i === bloques.length - 1}
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
              <IconButton size="sm" onClick={() => quitar(i)} aria-label="Quitar bloque">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          {(b.type === 'heading' || b.type === 'paragraph' || b.type === 'callout') && (
            <textarea
              className={textarea}
              rows={b.type === 'paragraph' ? 3 : 1}
              value={b.text}
              placeholder={b.type === 'callout' ? 'Ojo con esto…' : 'Escribe aquí'}
              onChange={(e) => reemplazar(i, { ...b, text: e.target.value })}
            />
          )}

          {b.type === 'bullets' && (
            <div className="space-y-1.5">
              {b.items.map((it, k) => (
                <input
                  key={k}
                  className={input}
                  value={it}
                  placeholder={`Punto ${k + 1}`}
                  onChange={(e) =>
                    reemplazar(i, {
                      ...b,
                      items: b.items.map((x, m) => (m === k ? e.target.value : x)),
                    })
                  }
                />
              ))}
              <button
                type="button"
                className="inline-flex h-8 items-center px-1 text-[12px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                onClick={() => reemplazar(i, { ...b, items: [...b.items, ''] })}
              >
                + otro punto
              </button>
            </div>
          )}

          {b.type === 'image' && (
            <div className="space-y-1.5">
              {b.url ? (
                <img
                  src={b.url}
                  alt=""
                  className="h-28 w-full rounded-[8px] border border-[var(--line-strong)] object-contain"
                />
              ) : null}
              <div className="flex items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center rounded-[6px] border border-[var(--line-strong)] px-3 text-[12px] text-[var(--ink-muted)] transition-colors hover:border-[var(--ink-faint)] hover:text-[var(--ink)]">
                  {subiendo === i ? 'Subiendo…' : 'Subir foto'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={subiendo !== null}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setSubiendo(i)
                      try {
                        const url = await uploadAnnouncementImage(file)
                        reemplazar(i, { ...b, url })
                      } catch (err) {
                        const info = inspectApiError(err, 'subir la foto')
                        toast.error(info.title, { description: info.description })
                      } finally {
                        setSubiendo(null)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
                <span className="text-[12px] text-[var(--ink-faint)]">
                  PNG, JPG o WEBP · hasta 8 MB
                </span>
              </div>
              <input
                className={input}
                value={b.url}
                placeholder="…o pega la URL de la foto"
                onChange={(e) => reemplazar(i, { ...b, url: e.target.value })}
              />
              <input
                className={input}
                value={b.alt}
                placeholder="Descripción de la foto (para quien no la ve)"
                onChange={(e) => reemplazar(i, { ...b, alt: e.target.value })}
              />
              <input
                className={input}
                value={b.caption ?? ''}
                placeholder="Pie de foto (opcional)"
                onChange={(e) => reemplazar(i, { ...b, caption: e.target.value })}
              />
            </div>
          )}

          {b.type === 'specs' && (
            <div className="space-y-1.5">
              {b.rows.map((r, k) => (
                <div key={k} className="flex gap-1.5">
                  <input
                    className={input}
                    value={r.label}
                    placeholder="Pantallas"
                    onChange={(e) =>
                      reemplazar(i, {
                        ...b,
                        rows: b.rows.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)),
                      })
                    }
                  />
                  <input
                    className={input}
                    value={r.value}
                    placeholder="2 táctiles"
                    onChange={(e) =>
                      reemplazar(i, {
                        ...b,
                        rows: b.rows.map((x, m) => (m === k ? { ...x, value: e.target.value } : x)),
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="inline-flex h-8 items-center px-1 text-[12px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                onClick={() => reemplazar(i, { ...b, rows: [...b.rows, { label: '', value: '' }] })}
              >
                + otra fila
              </button>
            </div>
          )}

          {b.type === 'button' && (
            <div className="space-y-1.5">
              <input
                className={input}
                value={b.label}
                placeholder="Texto del botón: Quiero una"
                onChange={(e) => reemplazar(i, { ...b, label: e.target.value })}
              />
              <input
                className={input}
                type="url"
                value={b.url}
                placeholder="https://avoqado.io/terminales"
                onChange={(e) => reemplazar(i, { ...b, url: e.target.value })}
              />
              {b.label.trim() && !b.url.trim() && (
                <p className="text-[12px] text-[var(--danger)]">
                  Pon el enlace o este botón no hará nada.
                </p>
              )}
            </div>
          )}

          {b.type === 'divider' && <div className="h-px bg-[var(--line-strong)]" />}
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        {NUEVOS.map((n) => (
          <button
            key={n.label}
            type="button"
            onClick={() => onChange([...bloques, n.make()])}
            className="inline-flex h-8 items-center rounded-[6px] border border-dashed border-[var(--line-strong)] px-3 text-[12px] text-[var(--ink-muted)] transition-colors hover:border-[var(--ink-faint)] hover:text-[var(--ink)]"
          >
            + {n.label}
          </button>
        ))}
      </div>
    </div>
  )
}
