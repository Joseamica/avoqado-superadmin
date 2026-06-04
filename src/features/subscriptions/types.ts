/** Mirror of avoqado-server SubscriptionState (subscription.service.ts). */
export type SubscriptionState =
  | 'none'
  | 'trial'
  | 'active'
  | 'canceling'
  | 'past_due'
  | 'suspended'
  | 'canceled'
/** Mirror of avoqado-server PlanTier enum (schema.prisma:5629). */
export type PlanTier = 'GRATIS' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | null

export interface SuperadminVenueSubscription {
  venueId: string
  name: string
  slug: string
  planTier: PlanTier
  state: SubscriptionState
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  mrr: number
  stripeSubscriptionId: string | null
  owner: { name: string | null; email: string | null }
}

export interface SubscriptionOverview {
  counts: {
    active: number
    trial: number
    canceling: number
    past_due: number
    suspended: number
    canceled: number
    none: number
    total: number
  }
  mrr: { total: number; currency: 'MXN' }
  trialsEndingSoon: Array<{ venueId: string; name: string; trialEndsAt: string }>
}

// Tone union mirrors src/shared/ui/Badge.tsx ('muted'|'success'|'warn'|'danger'|'info'|'accent').
export const STATE_TONE: Record<
  SubscriptionState,
  'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'
> = {
  active: 'success',
  trial: 'info',
  canceling: 'warn',
  past_due: 'warn',
  suspended: 'danger',
  canceled: 'muted',
  none: 'muted',
}

const STATE_LABEL: Record<SubscriptionState, string> = {
  active: 'Activa',
  trial: 'En prueba',
  canceling: 'Por cancelar',
  past_due: 'Pago vencido',
  suspended: 'Suspendida',
  canceled: 'Cancelada',
  none: 'Sin plan',
}

export function humanizeState(state: SubscriptionState): string {
  return STATE_LABEL[state] ?? 'Desconocido'
}
