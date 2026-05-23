import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas)] px-6 text-center">
      <p className="eyebrow text-[var(--accent)]">404 · ruta inexistente</p>
      <h1 className="mt-4 font-display text-[clamp(56px,9vw,108px)] font-semibold leading-none tracking-[-0.032em] text-[var(--ink)]">
        No la encontramos.
      </h1>
      <p className="mt-4 max-w-[420px] text-[13.5px] leading-relaxed text-[var(--ink-muted)]">
        La ruta que escribiste no existe o fue movida. Si llegaste aquí desde un enlace dentro de la
        consola, repórtalo al equipo.
      </p>
      <Link
        to="/dashboard"
        className="mt-7 inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al resumen
      </Link>
    </div>
  )
}
