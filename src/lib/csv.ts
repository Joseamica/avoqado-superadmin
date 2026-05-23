/**
 * Serializa filas a CSV y dispara la descarga.
 * RFC 4180-ish (escapa comas/comillas/newlines). Prepend BOM UTF-8 para que
 * Excel abra el archivo con acentos correctos.
 */

type CSVValue = string | number | boolean | null | undefined | Date

export interface CSVColumn<T> {
  key: string
  header: string
  accessor: (row: T) => CSVValue
}

function escapeCell(value: CSVValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function rowsToCsv<T>(rows: T[], columns: CSVColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(',')
  const bodyLines = rows.map((row) => columns.map((c) => escapeCell(c.accessor(row))).join(','))
  return [headerLine, ...bodyLines].join('\r\n')
}

export function downloadCsv(csv: string, filename: string): void {
  // BOM for Excel.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
