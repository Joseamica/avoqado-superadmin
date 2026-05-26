const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const mxnCompact = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Full MXN amount, e.g. "$128,450.20". Render inside a `tabular-nums` element. */
export function formatMoney(value: number | null | undefined): string {
  return mxn.format(value ?? 0)
}

/** Abbreviated MXN amount for headline KPIs, e.g. "$4.2M". */
export function formatCompactMoney(value: number | null | undefined): string {
  return mxnCompact.format(value ?? 0)
}
