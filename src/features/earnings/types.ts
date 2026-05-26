export interface EarningsTotals {
  grossProfit: number
  terminalProfit: number
  onlineFees: number
  volume: number
  transactions: number
  averageMargin: number
}
export interface VenueEarnings {
  venueId: string
  venueName: string
  profit: number
  terminalProfit: number
  onlineFees: number
  volume: number
  transactions: number
}
export interface MerchantEarnings {
  merchantAccountId: string
  label: string
  providerCode: string
  profit: number
  volume: number
  transactions: number
}
export interface ProviderEarnings {
  providerId: string
  providerCode: string
  providerName: string
  volume: number
  cost: number
  transactions: number
}
export interface CardTypeEarnings {
  type: string
  transactions: number
  volume: number
  profit: number
  margin: number
}
export interface ChannelEarnings {
  ecommerceMerchantId: string
  label: string
  providerCode: string
  fees: number
  volume: number
  transactions: number
}
export interface EarningsSummary {
  range: { startDate: string; endDate: string }
  totals: EarningsTotals
  byVenue: VenueEarnings[]
  byMerchant: MerchantEarnings[]
  byProvider: ProviderEarnings[]
  byCardType: CardTypeEarnings[]
  byChannel: ChannelEarnings[]
}
export interface EarningsTimePoint {
  date: string
  terminalProfit: number
  onlineFees: number
  profit: number
}
export type Granularity = 'daily' | 'weekly' | 'monthly'
