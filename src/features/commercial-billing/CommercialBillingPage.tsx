import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, CheckCircle2, Clock3, Landmark, Loader2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/data-table/DataTable'
import { FilterPill, MultiSelectFilterContent, type MultiSelectOption } from '@/shared/filters'
import { QueryError } from '@/shared/components/QueryError'
import { formatDateTime, timezoneShort } from '@/shared/lib/datetime'
import { ManualSpeiCaseDrawer } from './ManualSpeiCaseDrawer'
import { formatMinorUnits } from './money'
import {
  EXCEPTION_REASON_LABEL,
  MANUAL_SPEI_STATUS_LABEL,
  type ManualSpeiCaseStatus,
  type ManualSpeiCaseSummary,
} from './types'
import { useManualSpeiCases } from './use-commercial-billing'

const STATUS_TONE: Record<ManualSpeiCaseStatus, 'muted' | 'success' | 'warn' | 'danger' | 'info'> =
  {
    PENDING_REVIEW: 'warn',
    AWAITING_APPROVAL: 'info',
    READY_TO_RECONCILE: 'warn',
    RECONCILED: 'success',
    REJECTED: 'danger',
  }

const STATUS_OPTIONS: MultiSelectOption<ManualSpeiCaseStatus>[] = (
  Object.entries(MANUAL_SPEI_STATUS_LABEL) as [ManualSpeiCaseStatus, string][]
).map(([value, label]) => ({ value, label }))

export function CommercialBillingPage() {
  const cases = useManualSpeiCases()
  const [statuses, setStatuses] = useState<Set<ManualSpeiCaseStatus>>(new Set())
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = cases.data?.pages.flatMap((page) => page.items) ?? []
    return statuses.size === 0 ? all : all.filter((item) => statuses.has(item.status))
  }, [cases.data?.pages, statuses])

  const counts = useMemo(() => {
    const all = cases.data?.pages.flatMap((page) => page.items) ?? []
    return {
      review: all.filter((item) => item.status === 'PENDING_REVIEW').length,
      approval: all.filter((item) => item.status === 'AWAITING_APPROVAL').length,
      ready: all.filter((item) => item.status === 'READY_TO_RECONCILE').length,
      reconciled: all.filter((item) => item.status === 'RECONCILED').length,
    }
  }, [cases.data?.pages])

  const columns = useMemo<ColumnDef<ManualSpeiCaseSummary, unknown>[]>(
    () => [
      {
        id: 'case',
        header: 'Caso',
        accessorFn: (row) => `${row.id} ${row.bankReference ?? ''}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-[11.5px] font-medium text-[var(--ink)]">
              {row.original.id}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--ink-faint)]">
              {row.original.bankReference ?? 'Sin referencia'}
            </p>
          </div>
        ),
      },
      {
        id: 'amount',
        header: () => <span className="block text-right">Importe</span>,
        accessorFn: (row) => row.observedAmountMinor,
        cell: ({ row }) => (
          <span className="block text-right font-mono text-[12.5px] font-semibold tabular text-[var(--ink)]">
            {formatMinorUnits(row.original.observedAmountMinor, row.original.currency)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <Badge tone={STATUS_TONE[row.original.status]}>
            {MANUAL_SPEI_STATUS_LABEL[row.original.status]}
          </Badge>
        ),
      },
      {
        id: 'exceptions',
        header: 'Excepciones',
        accessorFn: (row) => row.exceptionReasons.join(' '),
        cell: ({ row }) =>
          row.original.exceptionReasons.length > 0 ? (
            <div className="flex max-w-[220px] flex-wrap gap-1">
              {row.original.exceptionReasons.map((reason) => (
                <Badge key={reason} tone="warn" size="sm">
                  {EXCEPTION_REASON_LABEL[reason] ?? reason}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-[var(--ink-faint)]">—</span>
          ),
      },
      {
        id: 'approvals',
        header: 'Aprobaciones',
        accessorFn: (row) => row.approvalCount,
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[var(--ink-muted)]">
            {row.original.approvalCount} de {row.original.requiredApprovals}
          </span>
        ),
      },
      {
        id: 'observedAt',
        header: `Observado · ${timezoneShort()}`,
        accessorFn: (row) => row.observedAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[11.5px] text-[var(--ink-muted)]">
            {formatDateTime(row.original.observedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-right">Acción</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelectedCaseId(row.original.id)}
            >
              Revisar caso
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  const toolbar = (
    <FilterPill label="Estado" activeCount={statuses.size} onClear={() => setStatuses(new Set())}>
      <MultiSelectFilterContent
        title="Estado del caso"
        options={STATUS_OPTIONS}
        selected={statuses}
        onApply={setStatuses}
      />
    </FilterPill>
  )

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Cobranza comercial</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Conciliación SPEI
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--ink-muted)]">
            Revisa evidencia, excepciones y doble aprobación antes de convertir una transferencia
            manual en efectivo conciliado.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--ink-faint)]">
          <Landmark className="h-3.5 w-3.5" aria-hidden /> Solo datos auditados por Server
        </div>
      </header>

      {cases.isError && (
        <QueryError
          className="mb-5"
          error={cases.error}
          context="cargar la cola de conciliación SPEI"
          onRetry={() => cases.refetch()}
          isRetrying={cases.isFetching}
        />
      )}

      <section
        aria-label="Resumen de conciliación"
        className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--line)] py-3"
      >
        <p className="eyebrow mr-1">En esta vista</p>
        {[
          {
            label: 'Por revisar',
            value: counts.review,
            icon: AlertTriangle,
            tone: 'text-[var(--warn)]',
          },
          {
            label: 'Por aprobar',
            value: counts.approval,
            icon: Clock3,
            tone: 'text-[var(--info)]',
          },
          { label: 'Listas', value: counts.ready, icon: ShieldCheck, tone: 'text-[var(--warn)]' },
          {
            label: 'Conciliadas',
            value: counts.reconciled,
            icon: CheckCircle2,
            tone: 'text-[var(--success)]',
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-[12px] text-[var(--ink-muted)]"
          >
            <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden />
            <span className="font-mono font-semibold tabular text-[var(--ink)]">{value}</span>
            <span>{label.toLowerCase()}</span>
          </div>
        ))}
        {cases.hasNextPage && (
          <span className="text-[11px] text-[var(--ink-faint)]">Hay más casos en Server</span>
        )}
      </section>

      <DataTable
        data={rows}
        columns={columns}
        minWidth={1100}
        pageSize={25}
        initialSorting={[{ id: 'observedAt', desc: true }]}
        searchPlaceholder="Buscar caso o referencia…"
        toolbar={toolbar}
        caption={`Tabla de ${rows.length} casos de conciliación SPEI.`}
        emptyState={{
          title: cases.isLoading ? 'Cargando casos…' : 'Sin casos en la cola',
          description: 'Los SPEI manuales que necesiten revisión aparecerán aquí.',
        }}
      />

      {cases.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            disabled={cases.isFetchingNextPage}
            onClick={() => cases.fetchNextPage()}
          >
            {cases.isFetchingNextPage && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            )}
            {cases.isFetchingNextPage ? 'Cargando más casos…' : 'Cargar más casos'}
          </Button>
        </div>
      )}

      <ManualSpeiCaseDrawer
        key={selectedCaseId ?? 'closed'}
        caseId={selectedCaseId}
        open={selectedCaseId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCaseId(null)
        }}
      />
    </div>
  )
}
