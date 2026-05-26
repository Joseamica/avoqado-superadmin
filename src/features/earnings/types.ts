export interface EarningsTotals {
  netProfit: number
  terminalNet: number
  onlineFees: number
  tramoProvider: number
  tramoAggregator: number
  aggregatorKept: number
  volume: number
  transactions: number
  averageMargin: number
}
export interface VenueEarnings {
  venueId: string
  venueName: string
  netProfit: number
  terminalNet: number
  onlineFees: number
  volume: number
  transactions: number
}
export interface MerchantEarnings {
  merchantAccountId: string
  label: string
  providerCode: string
  hasAggregator: boolean
  netProfit: number
  tramoProvider: number
  tramoAggregator: number
  volume: number
  transactions: number
}
export interface ProviderEarnings {
  providerId: string
  providerCode: string
  providerName: string
  volume: number
  netProfit: number
  transactions: number
}
export interface CardTypeEarnings {
  type: string
  transactions: number
  volume: number
  netProfit: number
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
  terminalNet: number
  onlineFees: number
  net: number
}
export type Granularity = 'daily' | 'weekly' | 'monthly'
