/**
 * SAT catalog options (subset relevant to platform billing) + line presets +
 * money helpers. The catalogs feed Combobox dropdowns; presets feed the
 * "Nueva factura" quick buttons. All money helpers convert at the cents boundary.
 */
import type { ComboboxOption } from '@/shared/ui/Combobox'
import type { PlatformCfdiLine } from './types'

/** c_FormaPago — payment method (Stripe card, transfer, cash, or "Por definir" for PPD). */
export const FORMA_PAGO_OPTIONS: ComboboxOption[] = [
  { value: '01', label: '01 · Efectivo' },
  { value: '02', label: '02 · Cheque nominativo' },
  { value: '03', label: '03 · Transferencia electrónica' },
  { value: '04', label: '04 · Tarjeta de crédito' },
  { value: '28', label: '28 · Tarjeta de débito' },
  { value: '99', label: '99 · Por definir (PPD)' },
]

/** c_UsoCFDI — common uses for fees/services and goods. */
export const USO_CFDI_OPTIONS: ComboboxOption[] = [
  { value: 'G01', label: 'G01 · Adquisición de mercancías' },
  {
    value: 'G03',
    label: 'G03 · Gastos en general',
    description: 'Default para honorarios/servicios',
  },
  { value: 'I04', label: 'I04 · Equipo de cómputo y accesorios' },
  { value: 'S01', label: 'S01 · Sin efectos fiscales' },
]

/** c_RegimenFiscal — common regimes for receptors. */
export const REGIMEN_FISCAL_OPTIONS: ComboboxOption[] = [
  { value: '601', label: '601 · General de Ley Personas Morales' },
  { value: '603', label: '603 · Personas Morales con Fines no Lucrativos' },
  { value: '605', label: '605 · Sueldos y Salarios' },
  { value: '612', label: '612 · Personas Físicas con Actividades Empresariales' },
  { value: '616', label: '616 · Sin obligaciones fiscales' },
  { value: '621', label: '621 · Incorporación Fiscal' },
  { value: '626', label: '626 · Régimen Simplificado de Confianza (RESICO)' },
]

export const METODO_PAGO_OPTIONS: ComboboxOption[] = [
  { value: 'PUE', label: 'PUE · Pago en una sola exhibición', description: 'Ya te pagaron' },
  { value: 'PPD', label: 'PPD · Pago en parcialidades o diferido', description: 'Aún no te pagan' },
]

/** Line presets for the "Nueva factura" quick buttons (price in pesos for the UI). */
export interface LinePreset {
  key: string
  label: string
  line: Omit<PlatformCfdiLine, 'unitPriceCents'> & { unitPricePesos: number }
}

export const LINE_PRESETS: LinePreset[] = [
  {
    key: 'mensualidad',
    label: 'Mensualidad 1599+IVA',
    line: {
      // Clave que Avoqado usa en sus CFDIs reales (Servicios Tecnológicos AVO).
      description: 'Suscripción mensual plataforma - punto de venta y gestión',
      satProductKey: '43232611',
      satUnitKey: 'E48',
      quantity: 1,
      unitPricePesos: 1599,
      taxRate: 0.16,
    },
  },
  {
    key: 'venta-tpv',
    label: 'Venta TPV',
    line: {
      description: 'Terminal punto de venta (TPV)',
      satProductKey: '43211902',
      satUnitKey: 'H87',
      quantity: 1,
      unitPricePesos: 0,
      taxRate: 0.16,
    },
  },
]

// ── Money helpers (cents ↔ pesos boundary) ───────────────────────────────────

const MXN_FMT = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100)
}

export function centsToPesos(cents: number): number {
  return Math.round(cents) / 100
}

/** Format integer cents as "$1,854.84". */
export function formatCents(cents: number): string {
  return MXN_FMT.format(centsToPesos(cents))
}

/** Read a File as base64 WITHOUT the `data:...;base64,` prefix (what the backend's Buffer.from expects). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Local mirror of the backend total math (IVA add-on) so the UI can preview before issuing. */
export function previewTotals(
  lines: Array<{
    quantity: number
    unitPriceCents: number
    discountCents?: number
    taxRate?: number
    taxExempt?: boolean
  }>,
) {
  let subtotalCents = 0
  let discountCents = 0
  let taxCents = 0
  for (const l of lines) {
    const importe = Math.round(l.quantity * l.unitPriceCents)
    const lineDiscount = Math.round(l.discountCents ?? 0)
    const base = importe - lineDiscount
    const lineTax = l.taxExempt ? 0 : Math.round(base * (l.taxRate ?? 0.16))
    subtotalCents += importe
    discountCents += lineDiscount
    taxCents += lineTax
  }
  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
  }
}
