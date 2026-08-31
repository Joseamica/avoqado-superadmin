import type { ContentBlock } from './types'

/**
 * Vista previa de cómo lo verá el negocio.
 *
 * Pinta los MISMOS bloques que se guardan, con el mismo orden. No es una maqueta aparte:
 * si diverge de lo que reciben los clientes, la vista previa miente — que es peor que no
 * tenerla.
 */
export function AnnouncementPreview({
  title,
  body,
  bloques,
  actionLabel,
}: {
  title: string
  body: string
  bloques: ContentBlock[]
  actionLabel?: string
}) {
  return (
    <div className="rounded-[12px] border border-[var(--line-strong)] bg-[var(--canvas-raised)] p-4">
      <div className="text-[15px] font-medium text-[var(--ink)]">
        {title || 'Título del anuncio'}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        {body || 'El texto del aviso va aquí.'}
      </p>

      <div className="mt-3 space-y-3">
        {bloques.map((b, i) => {
          if (b.type === 'heading')
            return (
              <div key={i} className="text-[14px] font-medium text-[var(--ink)]">
                {b.text}
              </div>
            )
          if (b.type === 'paragraph')
            return (
              <p key={i} className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
                {b.text}
              </p>
            )
          if (b.type === 'bullets')
            return (
              <ul key={i} className="list-disc space-y-1 pl-4 text-[13px] text-[var(--ink-muted)]">
                {b.items.filter(Boolean).map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
              </ul>
            )
          if (b.type === 'image')
            return (
              <div key={i}>
                {b.url ? (
                  // `object-contain` y sin alto fijo: la foto se ve COMPLETA. Con
                  // `object-cover` y altura fija se recortaba, y la vista previa mentía
                  // sobre lo que el negocio iba a recibir.
                  <img
                    src={b.url}
                    alt={b.alt || 'Vista previa'}
                    className="max-h-48 w-full rounded-[8px] border border-[var(--line-strong)] object-contain"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-[8px] border border-dashed border-[var(--line-strong)] text-[12px] text-[var(--ink-faint)]">
                    foto del aparato
                  </div>
                )}
                {b.caption && (
                  <div className="mt-1 text-[12px] text-[var(--ink-faint)]">{b.caption}</div>
                )}
              </div>
            )
          if (b.type === 'specs')
            return (
              <div key={i} className="rounded-[8px] border border-[var(--line-strong)]">
                {b.rows.map((r, k) => (
                  <div
                    key={k}
                    className="flex justify-between border-b border-[var(--line-strong)] px-2.5 py-1.5 text-[12px] last:border-b-0"
                  >
                    <span className="text-[var(--ink-muted)]">{r.label}</span>
                    <span className="text-[var(--ink)]">{r.value}</span>
                  </div>
                ))}
              </div>
            )
          if (b.type === 'callout')
            return (
              <div
                key={i}
                className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 py-2 text-[12px] text-[var(--ink-muted)]"
              >
                {b.text}
              </div>
            )
          if (b.type === 'button')
            return (
              <div
                key={i}
                className="inline-flex rounded-[6px] bg-[var(--surface-primary)] px-3 py-1.5 text-[13px] text-[var(--on-surface-primary)]"
              >
                {b.label || 'Botón'}
              </div>
            )
          if (b.type === 'divider') return <div key={i} className="h-px bg-[var(--line-strong)]" />
          return null
        })}
      </div>

      {actionLabel && (
        <div className="mt-4 inline-flex rounded-[6px] bg-[var(--surface-primary)] px-3 py-1.5 text-[13px] text-[var(--on-surface-primary)]">
          {actionLabel}
        </div>
      )}
    </div>
  )
}
