import { DEFAULT_TIMEZONE, formatDateTime, timezoneShort } from '@/lib/datetime'

export function DashboardPage() {
  const now = new Date().toISOString()

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen del estado de la plataforma · {formatDateTime(now)} ({timezoneShort(DEFAULT_TIMEZONE)})
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Venues activos</h2>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-xs text-muted-foreground">por implementar</p>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Pagos hoy</h2>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-xs text-muted-foreground">por implementar</p>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">KYC pendientes</h2>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-xs text-muted-foreground">por implementar</p>
        </article>
      </section>
    </div>
  )
}
