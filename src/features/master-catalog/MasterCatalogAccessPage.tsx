import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { MasterCatalogOrganizationDrawer } from './MasterCatalogOrganizationDrawer'
import { useMasterCatalogOrganizations } from './use-master-catalog'
import type { MasterCatalogOrganizationSummary } from './types'

export function MasterCatalogAccessPage() {
  const [cursor, setCursor] = useState<string | undefined>()
  const [history, setHistory] = useState<(string | undefined)[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const organizations = useMasterCatalogOrganizations({ cursor, pageSize: 100 })

  const columns = useMemo<ColumnDef<MasterCatalogOrganizationSummary, unknown>[]>(
    () => [
      {
        id: 'organization',
        header: 'Organización',
        accessorFn: (organization) => `${organization.name} ${organization.slug ?? ''}`,
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="text-[13.5px] font-semibold text-[var(--ink)]">{row.original.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--ink-faint)]">
              {row.original.slug ?? row.original.id}
            </p>
          </div>
        ),
      },
      {
        id: 'venues',
        header: 'Venues',
        accessorFn: (organization) => organization._count.venues,
        cell: ({ row }) => (
          <span className="tabular text-[13px] text-[var(--ink-muted)]">
            {row.original._count.venues}
          </span>
        ),
      },
      {
        id: 'scope',
        header: 'Scope',
        accessorFn: () => 'ORGANIZATION_ONLY',
        cell: () => (
          <Badge size="sm" tone="muted">
            ORGANIZATION_ONLY
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Control',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label={`Abrir control de ${row.original.name}`}
            onClick={() => setSelectedOrganizationId(row.original.id)}
          >
            Abrir
          </Button>
        ),
      },
    ],
    [],
  )

  function nextPage() {
    const nextCursor = organizations.data?.nextCursor
    if (!nextCursor) return
    setHistory((current) => [...current, cursor])
    setCursor(nextCursor)
  }

  function previousPage() {
    const previousCursor = history.at(-1)
    setHistory((current) => current.slice(0, -1))
    setCursor(previousCursor)
  }

  const rows = organizations.data?.items ?? []
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Control plane · ENTERPRISE/custom</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Catálogo maestro
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-[var(--ink-muted)]">
            Otorga acceso comercial explícito y avanza rollout operativo sin editar Products,
            precios ni contenido corporativo.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
          <ShieldCheck className="h-4 w-4 text-[var(--success)]" aria-hidden />
          Staff activo · SUPERADMIN · sin impersonación
        </div>
      </header>

      <section className="mb-6 grid gap-px overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--line)] md:grid-cols-3">
        {[
          ['1', 'Entitlement', 'Grant comercial explícito; nunca nace del tier ni del deploy.'],
          ['2', 'Módulo', 'Asignación organization-only y config versionada fail-closed.'],
          ['3', 'Venue', 'ENFORCED sólo después de readiness y canary verificados.'],
        ].map(([step, title, description]) => (
          <article key={step} className="bg-[var(--canvas)] p-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[var(--ink-faint)]">0{step}</span>
              <h2 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h2>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-muted)]">
              {description}
            </p>
          </article>
        ))}
      </section>

      {organizations.isError && (
        <QueryError
          className="mb-5"
          error={organizations.error}
          context="cargar organizaciones del catálogo maestro"
          onRetry={() => organizations.refetch()}
        />
      )}

      <DataTable
        data={rows}
        columns={columns}
        caption={`Organizaciones disponibles para control del catálogo maestro. Página ${history.length + 1}.`}
        searchPlaceholder="Buscar organización…"
        pageSize={25}
        emptyState={{
          title: organizations.isLoading ? 'Cargando organizaciones…' : 'Sin organizaciones',
          description:
            'No se crea ningún grant automáticamente. Las organizaciones aparecerán aquí para revisión explícita.',
        }}
        toolbar={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={history.length === 0}
              onClick={previousPage}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!organizations.data?.nextCursor}
              onClick={nextPage}
              aria-label="Página siguiente"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        }
      />

      <MasterCatalogOrganizationDrawer
        organizationId={selectedOrganizationId}
        open={selectedOrganizationId !== null}
        onOpenChange={(next) => !next && setSelectedOrganizationId(null)}
      />
    </div>
  )
}
