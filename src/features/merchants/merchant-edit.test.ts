import { describe, it, expect } from 'vitest'
import {
  buildIdentityPatch,
  costChanged,
  initMerchantEditDraft,
  providerKind,
  settlementChanged,
  validateMerchantEditDraft,
  type MerchantEditDraft,
} from './merchant-edit'
import type { MerchantAccount, ProviderCostStructure, SettlementConfiguration } from './types'

const blumon: MerchantAccount = {
  id: 'm1',
  provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
  externalMerchantId: '9814275',
  alias: null,
  displayName: 'Cuenta Principal',
  active: true,
  displayOrder: 0,
  clabeNumber: null,
  bankName: null,
  accountHolder: null,
  hasCredentials: true,
  blumonSerialNumber: '2841548417',
  blumonPosId: '376',
  blumonEnvironment: 'PRODUCTION',
  blumonMerchantId: null,
  angelpayAffiliation: null,
  angelpayMerchantName: null,
  aggregatorId: null,
  venues: [],
  terminals: [],
  counts: { costStructures: 1, venueConfigs: 0, terminals: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const angelpay: MerchantAccount = {
  ...blumon,
  id: 'm2',
  provider: { id: 'p2', code: 'ANGELPAY', name: 'AngelPay', type: 'PAYMENT_PROCESSOR' },
  blumonSerialNumber: null,
  blumonPosId: null,
  blumonEnvironment: null,
  angelpayAffiliation: '9814275',
  angelpayMerchantName: 'Amaena',
}

/** includesTax=false ⇒ la efectiva sería 0.0290; la cruda persistida es 0.025. */
const cost: ProviderCostStructure = {
  id: 'c1',
  merchantAccountId: 'm1',
  debitRate: 0.025,
  creditRate: 0.03,
  amexRate: 0.035,
  internationalRate: 0.04,
  includesTax: false,
  taxRate: 0.16,
  fixedCostPerTransaction: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  active: true,
}

const settlements: SettlementConfiguration[] = [
  {
    id: 's1',
    merchantAccountId: 'm1',
    cardType: 'DEBIT',
    settlementDays: 2,
    settlementDayType: 'BUSINESS_DAYS',
    cutoffTime: '22:00',
    cutoffTimezone: 'America/Mexico_City',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
  },
]

describe('providerKind', () => {
  it('detecta Blumon y AngelPay por code, sin importar el casing', () => {
    expect(providerKind('BLUMON')).toBe('blumon')
    expect(providerKind('angelpay')).toBe('angelpay')
  })

  it('cae en generic para un proveedor desconocido o ausente', () => {
    expect(providerKind('STRIPE')).toBe('generic')
    expect(providerKind(null)).toBe('generic')
  })
})

describe('initMerchantEditDraft', () => {
  it('siembra las tasas CRUDAS, no las efectivas — si no, el IVA se duplica al guardar', () => {
    const d = initMerchantEditDraft(blumon, cost, settlements)
    expect(d.rates.DEBIT).toBe(0.025)
    expect(d.ratesIncludeTax).toBe(false)
  })

  it('trae las columnas del proveedor y deja las credenciales vacías', () => {
    const d = initMerchantEditDraft(blumon, cost, settlements)
    expect(d.blumonSerialNumber).toBe('2841548417')
    expect(d.blumonEnvironment).toBe('PRODUCTION')
    expect(d.credApiKey).toBe('')
  })

  it('usa el día guardado por tarjeta y el default para las que no tienen fila', () => {
    const d = initMerchantEditDraft(blumon, cost, settlements)
    expect(d.settlementDays.DEBIT).toBe(2)
    expect(d.settlementDays.AMEX).toBe(3)
    expect(d.cutoffTime).toBe('22:00')
  })
})

describe('buildIdentityPatch', () => {
  it('sin cambios devuelve un parche vacío — abrir y guardar no reescribe nada', () => {
    const d = initMerchantEditDraft(blumon, cost, settlements)
    expect(buildIdentityPatch(d, blumon, 'blumon')).toEqual({})
  })

  it('sólo lleva lo que cambió', () => {
    const d: MerchantEditDraft = {
      ...initMerchantEditDraft(blumon, cost, settlements),
      blumonPosId: '999',
    }
    expect(buildIdentityPatch(d, blumon, 'blumon')).toEqual({ blumonPosId: '999' })
  })

  it('un campo vaciado viaja como null (borrar), no como cadena vacía', () => {
    const d = { ...initMerchantEditDraft(blumon, cost, settlements), blumonSerialNumber: '  ' }
    expect(buildIdentityPatch(d, blumon, 'blumon').blumonSerialNumber).toBeNull()
  })

  it('NUNCA manda columnas de Blumon en una cuenta de AngelPay', () => {
    const d = { ...initMerchantEditDraft(angelpay, null, []), blumonSerialNumber: '123' }
    const patch = buildIdentityPatch(d, angelpay, 'angelpay')
    expect(patch).not.toHaveProperty('blumonSerialNumber')
  })

  it('NUNCA manda columnas de AngelPay en una cuenta de Blumon', () => {
    const d = { ...initMerchantEditDraft(blumon, cost, settlements), angelpayAffiliation: 'X' }
    const patch = buildIdentityPatch(d, blumon, 'blumon')
    expect(patch).not.toHaveProperty('angelpayAffiliation')
  })

  it('omite credenciales si el operador no escribió ninguna', () => {
    const d = initMerchantEditDraft(blumon, cost, settlements)
    expect(buildIdentityPatch(d, blumon, 'blumon')).not.toHaveProperty('credentials')
  })

  it('manda sólo el apiKey cuando es lo único que se rotó', () => {
    const d = { ...initMerchantEditDraft(blumon, cost, settlements), credApiKey: 'sk_new' }
    expect(buildIdentityPatch(d, blumon, 'blumon').credentials).toEqual({ apiKey: 'sk_new' })
  })

  it('el banco se edita en cualquier proveedor', () => {
    const d = { ...initMerchantEditDraft(angelpay, null, []), bankName: 'BBVA' }
    expect(buildIdentityPatch(d, angelpay, 'angelpay').bankName).toBe('BBVA')
  })
})

describe('validateMerchantEditDraft', () => {
  const base = () => initMerchantEditDraft(blumon, cost, settlements)

  it('exige el ID de comercio', () => {
    expect(validateMerchantEditDraft({ ...base(), externalMerchantId: ' ' }, 'blumon')).toMatch(
      /ID de comercio/,
    )
  })

  it('acepta un CLABE vacío pero rechaza uno que no tenga 18 dígitos', () => {
    expect(validateMerchantEditDraft({ ...base(), clabeNumber: '' }, 'blumon')).toBeNull()
    expect(validateMerchantEditDraft({ ...base(), clabeNumber: '0121800' }, 'blumon')).toMatch(
      /18 dígitos/,
    )
    expect(
      validateMerchantEditDraft({ ...base(), clabeNumber: '012180001234567895' }, 'blumon'),
    ).toBeNull()
  })

  it('rechaza una hora de corte mal formada', () => {
    expect(validateMerchantEditDraft({ ...base(), cutoffTime: '25:00' }, 'blumon')).toMatch(/HH:MM/)
    expect(validateMerchantEditDraft({ ...base(), cutoffTime: '23:00' }, 'blumon')).toBeNull()
  })

  it('rechaza días de liquidación negativos', () => {
    const d = base()
    d.settlementDays.CREDIT = -1
    expect(validateMerchantEditDraft(d, 'blumon')).toMatch(/enteros/)
  })
})

describe('costChanged / settlementChanged', () => {
  it('no dispara guardado de costo si nadie tocó las tasas', () => {
    expect(costChanged(initMerchantEditDraft(blumon, cost, settlements), cost)).toBe(false)
  })

  it('detecta un cambio de tasa y un cambio del flag de IVA', () => {
    const d = initMerchantEditDraft(blumon, cost, settlements)
    expect(costChanged({ ...d, rates: { ...d.rates, DEBIT: 0.02 } }, cost)).toBe(true)
    expect(costChanged({ ...d, ratesIncludeTax: true }, cost)).toBe(true)
  })

  it('sin costo previo, dejar las tasas en cero no crea una estructura vacía', () => {
    expect(costChanged(initMerchantEditDraft(blumon, null, []), null)).toBe(false)
  })

  it('sin liquidación previa, dejar los defaults no crea configuraciones', () => {
    expect(settlementChanged(initMerchantEditDraft(blumon, null, []), [])).toBe(false)
  })

  it('detecta un cambio de días y uno de hora de corte', () => {
    const d = initMerchantEditDraft(blumon, cost, settlements)
    expect(settlementChanged(d, settlements)).toBe(false)
    expect(
      settlementChanged({ ...d, settlementDays: { ...d.settlementDays, DEBIT: 5 } }, settlements),
    ).toBe(true)
    expect(settlementChanged({ ...d, cutoffTime: '20:00' }, settlements)).toBe(true)
  })
})
