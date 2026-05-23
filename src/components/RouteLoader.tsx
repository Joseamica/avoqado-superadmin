export function RouteLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-[var(--canvas)]"
    >
      <span className="eyebrow text-[var(--ink-faint)]">Cargando…</span>
    </div>
  )
}
