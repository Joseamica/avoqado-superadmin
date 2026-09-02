const INTEGER_MINOR_UNITS = /^-?\d+$/
const ISO_CURRENCY = /^[A-Z]{3}$/

/**
 * Formats an integer amount expressed in hundredths without ever coercing it
 * to `Number`. Reconciliation values can outgrow `Number.MAX_SAFE_INTEGER`;
 * using BigInt keeps the operator's view bit-for-bit aligned with Server.
 */
export function formatMinorUnits(amountMinor: string, currency: string): string {
  if (!INTEGER_MINOR_UNITS.test(amountMinor)) {
    throw new Error('Importe menor inválido')
  }
  if (!ISO_CURRENCY.test(currency)) {
    throw new Error('Moneda inválida')
  }

  const value = BigInt(amountMinor)
  const negative = value < 0n
  const absolute = negative ? -value : value
  const whole = absolute / 100n
  const cents = (absolute % 100n).toString().padStart(2, '0')
  const formatted = `${whole.toLocaleString('en-US')}.${cents}`
  const prefix = currency === 'MXN' ? '$' : `${currency} `

  return `${negative ? '-' : ''}${prefix}${formatted}`
}
