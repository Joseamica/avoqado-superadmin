const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Compact NUMBER (no currency): ICU's compact *currency* in es-MX renders the
// symbol trailing with a non-breaking space ("4.2 M$"), which reads oddly for
// money. We format the number compactly and prepend "$" so it reads "$4.2M".
const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Full MXN amount, e.g. "$128,450.20". Render inside a `tabular-nums` element. */
export function formatMoney(value: number | null | undefined): string {
  return mxn.format(value ?? 0)
}

/** Abbreviated MXN amount for chart axes / headline KPIs, e.g. "$4.2M" / "-$1.2K". */
export function formatCompactMoney(value: number | null | undefined): string {
  const n = value ?? 0
  return n < 0 ? `-$${compactNumber.format(Math.abs(n))}` : `$${compactNumber.format(n)}`
}
