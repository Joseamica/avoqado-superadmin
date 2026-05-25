/**
 * Non-component exports for the Blumon setup flow.
 * Kept in a plain .ts file so react-refresh/only-export-components
 * never fires on the drawer/panel .tsx files.
 */
import type { CardRates } from './types'
import type { BlumonFullSetupPayload } from './api'

export interface BlumonDraft {
  venueId: string | null
  venueName: string | null
  serialNumber: string
  brand: string
  model: string
  environment: 'SANDBOX' | 'PRODUCTION'
  displayName: string
  businessCategory: string
  accountSlot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  cost: CardRates | null
  costIncludesTax: boolean
  pricing: CardRates | null
  pricingIncludesTax: boolean
  settlement: { DEBIT: number; CREDIT: number; AMEX: number; INTERNATIONAL: number }
}

export const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

export const INITIAL_DRAFT: BlumonDraft = {
  venueId: null,
  venueName: null,
  serialNumber: '',
  brand: 'PAX',
  model: 'A910S',
  environment: 'SANDBOX',
  displayName: '',
  businessCategory: '',
  accountSlot: 'PRIMARY',
  cost: null,
  costIncludesTax: true,
  pricing: null,
  pricingIncludesTax: true,
  settlement: { DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 },
}

/** decimal → % (e.g. 0.025 → 2.5) */
export const toPct = (d: number) => Math.round(d * 10000) / 100

/** Assembles the full-setup request body from the wizard draft. Exported for tests. */
export function buildBlumonPayload(draft: BlumonDraft): BlumonFullSetupPayload {
  return {
    serialNumber: draft.serialNumber,
    brand: draft.brand,
    model: draft.model,
    displayName: draft.displayName || undefined,
    environment: draft.environment,
    businessCategory: draft.businessCategory || undefined,
    target: { type: 'venue', id: draft.venueId as string },
    accountSlot: draft.accountSlot,
    additionalTerminalIds: [],
    ...(draft.cost && {
      costStructureOverrides: {
        debitRate: toPct(draft.cost.DEBIT),
        creditRate: toPct(draft.cost.CREDIT),
        amexRate: toPct(draft.cost.AMEX),
        internationalRate: toPct(draft.cost.INTERNATIONAL),
        includesTax: draft.costIncludesTax,
      },
    }),
    ...(draft.pricing && {
      venuePricing: {
        debitRate: toPct(draft.pricing.DEBIT),
        creditRate: toPct(draft.pricing.CREDIT),
        amexRate: toPct(draft.pricing.AMEX),
        internationalRate: toPct(draft.pricing.INTERNATIONAL),
        includesTax: draft.pricingIncludesTax,
      },
    }),
    settlementConfig: {
      debitDays: draft.settlement.DEBIT,
      creditDays: draft.settlement.CREDIT,
      amexDays: draft.settlement.AMEX,
      internationalDays: draft.settlement.INTERNATIONAL,
    },
  }
}
