import { Fragment, useMemo, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/ui/IconButton'
import { ExportDialog } from './ExportDialog'
import type { CSVColumn } from '@/shared/lib/csv'

export interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  /** Placeholder del input de búsqueda global. */
  searchPlaceholder?: string
  /** Slot para chips/filter pills justo después del search. */
  toolbar?: ReactNode
  /** Empty state cuando data + filtros no devuelven nada. */
  emptyState?: { title: string; description?: string }
  /** Si se pasa, muestra botón "Exportar" con dialog (CSV o Excel). */
  exportable?: {
    filename: string
    columns: (CSVColumn<TData> & { defaultEnabled?: boolean })[]
    dateAccessor?: (row: TData) => Date | string | null
  }
  /** Orden inicial. */
  initialSorting?: SortingState
  /** Tamaño de página. Si 0 o undefined, sin paginación. */
  pageSize?: number
  /** min-width de la tabla para el overflow-x en mobile. */
  minWidth?: number
  /** Caption sr-only para a11y de la tabla. */
  caption?: string
  /**
   * Si se pasa, cada fila se vuelve expandible: aparece una columna de chevron
   * al principio y el callback decide qué se muestra en la zona expandida
   * (puede ocupar el ancho completo de la tabla).
   */
  renderExpandedRow?: (row: TData) => ReactNode
}

export function DataTable<TData>({
  data,
  columns,
  searchPlaceholder = 'Buscar…',
  toolbar,
  emptyState,
  exportable,
  initialSorting = [],
  pageSize,
  minWidth = 720,
  caption,
  renderExpandedRow,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  // Cuando hay renderExpandedRow, prepend una columna de chevron antes de las
  // del consumidor. Useamos useMemo para que la referencia sea estable y la
  // tabla no se re-instancie.
  const finalColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!renderExpandedRow) return columns
    const expandColumn: ColumnDef<TData, unknown> = {
      id: '__expand',
      header: () => <span className="sr-only">Expandir</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <IconButton
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
          aria-label={row.getIsExpanded() ? 'Contraer fila' : 'Expandir fila'}
          aria-expanded={row.getIsExpanded()}
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
        </IconButton>
      ),
      meta: { headerClassName: 'w-[40px]', cellClassName: 'p-2' },
    }
    return [expandColumn, ...columns]
  }, [columns, renderExpandedRow])

  const table = useReactTable({
    data,
    columns: finalColumns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      expanded,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pageSize ? getPaginationRowModel() : undefined,
    getExpandedRowModel: renderExpandedRow ? getExpandedRowModel() : undefined,
    getRowCanExpand: renderExpandedRow ? () => true : undefined,
    initialState: pageSize ? { pagination: { pageIndex: 0, pageSize } } : undefined,
  })

  const visibleRows = table.getRowModel().rows
  const filteredRowCount = table.getFilteredRowModel().rows.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2.5">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="dt-search" className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-faint)]"
            aria-hidden
          />
          <input
            id="dt-search"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] pl-9 pr-3 text-[14px] placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
        {toolbar}
        {exportable && (
          <ExportDialog
            data={table.getFilteredRowModel().rows.map((r) => r.original)}
            columns={exportable.columns}
            filename={exportable.filename}
            dateAccessor={exportable.dateAccessor}
          />
        )}
      </div>

      <div className="overflow-x-auto rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)]">
        <table className="w-full border-collapse text-[14px]" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--line-strong)] bg-[var(--canvas-sunken)]"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDir = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        'px-4 py-2.5 text-left eyebrow',
                        header.column.columnDef.meta?.headerClassName,
                      )}
                      aria-sort={
                        sortDir === 'asc'
                          ? 'ascending'
                          : sortDir === 'desc'
                            ? 'descending'
                            : canSort
                              ? 'none'
                              : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-[var(--ink)]"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon dir={sortDir} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={finalColumns.length} className="px-5 py-14 text-center">
                  <p className="font-display text-[15px] font-semibold text-[var(--ink)]">
                    {emptyState?.title ?? 'Sin resultados'}
                  </p>
                  {emptyState?.description && (
                    <p className="mt-1 text-[12.5px] text-[var(--ink-faint)]">
                      {emptyState.description}
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="group border-b border-[var(--line)] transition-colors hover:bg-[var(--canvas-sunken)]/60">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-4 py-3 align-top',
                          cell.column.columnDef.meta?.cellClassName,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {renderExpandedRow && row.getIsExpanded() && (
                    <tr className="border-b border-[var(--line)] bg-[var(--canvas-sunken)]/50">
                      <td colSpan={row.getVisibleCells().length} className="px-4 pb-4 pt-1">
                        {renderExpandedRow(row.original)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-col gap-2 text-[11.5px] text-[var(--ink-faint)] sm:flex-row sm:items-center sm:justify-between">
        <span className="tabular">
          {filteredRowCount} de {data.length} fila{data.length === 1 ? '' : 's'}
        </span>
        {pageSize ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[12px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="tabular px-1">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[12px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        ) : null}
      </footer>
    </div>
  )
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' | false }) {
  if (dir === 'asc') return <ChevronUp className="h-3 w-3 text-[var(--ink)]" aria-hidden />
  if (dir === 'desc') return <ChevronDown className="h-3 w-3 text-[var(--ink)]" aria-hidden />
  return <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
}

declare module '@tanstack/react-table' {
  // Augment ColumnMeta for our custom header/cell classnames.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string
    cellClassName?: string
  }
}
