export interface CalendarAgg {
  gross: number
  commission: number
  net: number
  count: number
}

/**
 * Una afiliación (merchant account) dentro de un venue-día.
 *
 * Un negocio no es UNA relación bancaria: Amaena cobra por dos afiliaciones
 * AngelPay con tarifas distintas. El proveedor deposita por AFILIACIÓN, no por
 * negocio — sin este desglose la fila del negocio no cuadra con ningún depósito
 * real, y no hay forma de saber cuál de las dos faltó.
 */
export interface CalendarMerchant extends CalendarAgg {
  merchantAccountId: string
  label: string
  /** Afiliación / serie con la que el proveedor identifica la cuenta. */
  affiliation: string | null
  providerName: string | null
  aggregatorName: string | null
  /** T+n de la config que aplicó. Dos afiliaciones pueden liquidar en días distintos. */
  settlementDays: number | null
}

export interface CalendarVenue extends CalendarAgg {
  venueId: string
  venueName: string
  /**
   * Pista visual: el dinero de este venue-día pasó por un agregador. Es
   * best-effort — en prod el dato está incompleto (unos merchants traen el FK,
   * otros sólo se reconocen por llamarse "Externo"). Sirve como etiqueta, nunca
   * como filtro duro de dinero.
   */
  hasAggregator: boolean
  aggregatorNames: string[]
  /** Desglose por afiliación. Siempre suma exactamente al total del negocio. */
  merchants: CalendarMerchant[]
}

export interface CalendarDay extends CalendarAgg {
  date: string // yyyy-MM-dd (día local del venue)
  status: 'settled' | 'today' | 'projected'
  venues: CalendarVenue[]
}

export interface SettlementCalendar {
  from: string
  to: string
  days: CalendarDay[]
  total: CalendarAgg
  venueCount: number
  /** Dinero con tarjeta que no se pudo ubicar en un día (sin costo o sin regla). */
  unprojected: { count: number; gross: number }
}
