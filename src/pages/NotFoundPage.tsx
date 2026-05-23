import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">La ruta que buscas no existe.</p>
      <Link
        to="/dashboard"
        className="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Volver al dashboard
      </Link>
    </div>
  )
}
