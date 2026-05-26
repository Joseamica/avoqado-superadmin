import type { CSVColumn } from './csv'

/** Build a 2D array (header row + data rows) from typed columns. Pure + testable. */
export function rowsToAoa<T>(rows: T[], columns: CSVColumn<T>[]): (string | number | boolean)[][] {
  const header = columns.map((c) => c.header)
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = c.accessor(row)
      if (v === null || v === undefined) return ''
      if (v instanceof Date) return v.toISOString()
      return v
    }),
  )
  return [header, ...body]
}

/**
 * Write rows to a real .xlsx file and trigger the download. SheetJS is imported
 * lazily here so the (heavy) lib only loads when the user actually exports Excel
 * — it never touches the initial or page bundle otherwise.
 */
export async function downloadXlsx<T>(
  rows: T[],
  columns: CSVColumn<T>[],
  filename: string,
  sheetName = 'Datos',
): Promise<void> {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.aoa_to_sheet(rowsToAoa(rows, columns))
  const workbook = XLSX.utils.book_new()
  // Excel limits sheet names to 31 chars.
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
