import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/Dialog'
import { downloadCsv, rowsToCsv, type CSVColumn } from '@/shared/lib/csv'

interface ExportableColumn<T> extends CSVColumn<T> {
  /** Si false, el checkbox sale destildado por default. */
  defaultEnabled?: boolean
}

interface ExportDialogProps<T> {
  data: T[]
  columns: ExportableColumn<T>[]
  filename: string
  /**
   * Si está presente, muestra inputs de date-range que filtran las filas
   * por esa columna antes de exportar.
   */
  dateAccessor?: (row: T) => Date | string | null
  trigger?: React.ReactNode
}

export function ExportDialog<T>({
  data,
  columns,
  filename,
  dateAccessor,
  trigger,
}: ExportDialogProps<T>) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultEnabled !== false).map((c) => c.key)),
  )
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const enabledColumns = useMemo(
    () => columns.filter((c) => selected.has(c.key)),
    [columns, selected],
  )

  const filteredRows = useMemo(() => {
    if (!dateAccessor || (!fromDate && !toDate)) return data
    const fromMs = fromDate ? new Date(fromDate).getTime() : -Infinity
    // toDate inclusive (end of day)
    const toMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Infinity
    return data.filter((row) => {
      const value = dateAccessor(row)
      if (!value) return false
      const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
      return ms >= fromMs && ms <= toMs
    })
  }, [data, dateAccessor, fromDate, toDate])

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(columns.map((c) => c.key)))
  const clearAll = () => setSelected(new Set())

  const handleExport = () => {
    const csv = rowsToCsv(filteredRows, enabledColumns)
    const datedFilename =
      fromDate || toDate ? `${filename}-${fromDate || 'inicio'}-${toDate || 'fin'}` : filename
    downloadCsv(csv, datedFilename)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" size="md">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Exportar CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar a CSV</DialogTitle>
          <DialogDescription>
            Escoge las columnas y, si quieres, un rango de fechas. Se exportan únicamente las filas
            ya visibles después de filtrar y buscar.
          </DialogDescription>
        </DialogHeader>

        {dateAccessor && (
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-[var(--ink-muted)]">Desde</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[12.5px] text-[var(--ink)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-[var(--ink-muted)]">Hasta</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[12.5px] text-[var(--ink)]"
              />
            </label>
          </div>
        )}

        <div className="rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-[var(--ink-faint)]">
              Columnas ({selected.size}/{columns.length})
            </p>
            <div className="flex items-center gap-3 text-[11.5px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-[var(--accent)] hover:underline"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-[var(--ink-muted)] hover:underline"
              >
                Ninguna
              </button>
            </div>
          </div>
          <ul className="max-h-[260px] divide-y divide-[var(--line)] overflow-y-auto">
            {columns.map((c) => {
              const checked = selected.has(c.key)
              return (
                <li key={c.key}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[12.5px] hover:bg-[var(--canvas)]">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(c.key)}
                      aria-label={c.header}
                    />
                    <span className="text-[var(--ink)]">{c.header}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="mt-3 text-[11.5px] text-[var(--ink-faint)]">
          {filteredRows.length} fila{filteredRows.length === 1 ? '' : 's'} serán exportadas
          {' · '}
          {enabledColumns.length} columna{enabledColumns.length === 1 ? '' : 's'}.
        </p>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleExport}
            disabled={enabledColumns.length === 0 || filteredRows.length === 0}
          >
            Descargar
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
