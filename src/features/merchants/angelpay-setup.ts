/**
 * Non-component exports for the AngelPay setup flow.
 * Kept in a plain .ts file so react-refresh/only-export-components
 * never fires on the drawer/panel .tsx files.
 */
import type { CardRates } from './types'
import type { AngelPayFullSetupPayload } from './api'

export interface AngelPayDraft {
  venueId: string | null
  venueName: string | null
  loginMode: 'existing' | 'new'
  angelpayUserAccountId: string | null
  email: string
  pin: string
  environment: 'QA' | 'PROD'
  externalMerchantId: string
  merchantName: string
  affiliation: string
  displayName: string
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  slotMode: 'fill' | 'replace'
  replacedAccountId: string | null
  cost: CardRates | null
  costIncludesTax: boolean
  pricing: CardRates | null
  pricingIncludesTax: boolean
  settlement: { DEBIT: number; CREDIT: number; AMEX: number; INTERNATIONAL: number }
  settlementDayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime: string
  cutoffTimezone: string
}

export const INITIAL_ANGELPAY_DRAFT: AngelPayDraft = {
  venueId: null,
  venueName: null,
  loginMode: 'new',
  angelpayUserAccountId: null,
  email: '',
  pin: '',
  environment: 'QA',
  externalMerchantId: '',
  merchantName: '',
  affiliation: '',
  displayName: '',
  accountType: 'PRIMARY',
  slotMode: 'fill',
  replacedAccountId: null,
  cost: null,
  costIncludesTax: true,
  pricing: null,
  pricingIncludesTax: true,
  settlement: { DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 },
  settlementDayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
}

/** Ensamble puro del body de full-setup-angelpay. Tasas DECIMAL (SIN ×100). + effectiveFrom. */
export function buildAngelPayPayload(draft: AngelPayDraft): AngelPayFullSetupPayload {
  const now = new Date().toISOString()
  const rate = (r: CardRates, includesTax: boolean) => ({
    debitRate: r.DEBIT,
    creditRate: r.CREDIT,
    amexRate: r.AMEX,
    internationalRate: r.INTERNATIONAL,
    includesTax,
    taxRate: 0.16,
    effectiveFrom: now,
  })
  return {
    venueId: draft.venueId as string,
    login:
      draft.loginMode === 'existing'
        ? { mode: 'existing', angelpayUserAccountId: draft.angelpayUserAccountId as string }
        : { mode: 'new', email: draft.email, pin: draft.pin, environment: draft.environment },
    merchant: {
      mode: 'create',
      externalMerchantId: draft.externalMerchantId,
      name: draft.merchantName,
      affiliation: draft.affiliation,
      displayName: draft.displayName,
    },
    slot: {
      accountType: draft.accountType,
      mode: draft.slotMode,
      ...(draft.slotMode === 'replace' && draft.replacedAccountId
        ? { replacedAccountId: draft.replacedAccountId }
        : {}),
    },
    terminalIds: [],
    ...(draft.cost ? { cost: rate(draft.cost, draft.costIncludesTax) } : {}),
    ...(draft.pricing ? { pricing: rate(draft.pricing, draft.pricingIncludesTax) } : {}),
    settlement: {
      settlementDays: draft.settlement.DEBIT,
      settlementDaysByCard: { ...draft.settlement },
      settlementDayType: draft.settlementDayType,
      cutoffTime: draft.cutoffTime,
      cutoffTimezone: draft.cutoffTimezone,
      effectiveFrom: now,
    },
  }
}
