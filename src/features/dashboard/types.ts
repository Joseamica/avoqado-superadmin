/**
 * Types matching the server response from `GET /api/v1/superadmin/dashboard/summary`.
 * Source of truth: avoqado-server/src/services/superadmin/dashboard.service.ts
 */

export interface DashboardSummary {
  venues: {
    total: number
    active: number
    suspended: number
  }
  terminals: {
    total: number
    active: number
    inactive: number
    pendingActivation: number
  }
  kyc: {
    pendingReview: number
    inReview: number
    verified: number
    rejected: number
    notSubmitted: number
  }
  staff: {
    total: number
  }
  payments24h: {
    count: number
    volumeCents: number
    failedCount: number
  }
  activityLog: {
    last24h: number
  }
}
