export interface CalendarAgg {
  gross: number
  commission: number
  net: number
  count: number
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
