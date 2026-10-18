import { Button } from '@/shared/ui/Button'
export function DocumentRequestPagination({
  page,
  pageSize,
  total,
  busy,
  onChange,
  noun = 'expedientes',
}: {
  page: number
  pageSize: number
  total: number
  busy?: boolean
  onChange: (page: number) => void
  noun?: string
}) {
  return (
    <nav
      aria-label={`Paginación de ${noun}`}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] py-3 text-sm"
    >
      <span className="tabular text-[var(--ink-muted)]">
        {total} {noun} · Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          aria-label="Página anterior"
          disabled={busy || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label="Siguiente página"
          disabled={busy || page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  )
}
