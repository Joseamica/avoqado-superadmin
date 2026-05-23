/**
 * Types matching the server response from `GET /api/v1/superadmin/activity-log`.
 * Source of truth: avoqado-server/src/services/dashboard/activity-log.service.ts
 * (SuperadminActivityLogEntry + PaginatedSuperadminActivityLogs).
 */

export interface ActivityLogStaff {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface ActivityLogEntry {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  /** jsonb — shape varies per action; render as JSON when shown. */
  data: unknown
  ipAddress: string | null
  /** ISO 8601 UTC string from the server. */
  createdAt: string
  staff: ActivityLogStaff | null
  venueId: string | null
  venueName: string | null
  organizationName: string | null
}

export interface ActivityLogPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ActivityLogResponse {
  logs: ActivityLogEntry[]
  pagination: ActivityLogPagination
}

export interface ActivityLogQueryParams {
  organizationId?: string
  venueId?: string
  staffId?: string
  action?: string
  entity?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

/* ---------- UI-side derived categorisation (no server-side category column). */

export type ActivityCategory = 'auth' | 'kyc' | 'venue' | 'terminal' | 'payment' | 'config'
export type ActivitySeverity = 'info' | 'success' | 'warn' | 'danger'

const KEYS: { match: RegExp; category: ActivityCategory }[] = [
  { match: /^permission|permission/i, category: 'auth' },
  { match: /kyc|verification/i, category: 'kyc' },
  { match: /terminal|app[_-]?update/i, category: 'terminal' },
  { match: /payment|order|settlement/i, category: 'payment' },
  { match: /venue|aggregator|merchant/i, category: 'venue' },
]

export function categorizeEntry(
  entry: Pick<ActivityLogEntry, 'action' | 'entity'>,
): ActivityCategory {
  const haystack = `${entry.action} ${entry.entity ?? ''}`
  for (const { match, category } of KEYS) {
    if (match.test(haystack)) return category
  }
  return 'config'
}

export function severityFor(action: string): ActivitySeverity {
  if (/DENIED|FAIL|ERROR|REJECT/i.test(action)) return 'danger'
  if (/DISABLED|MODIFIED|UPDATE|CHANGE/i.test(action)) return 'warn'
  if (/APPROV|CREAT|ACTIVAT|SUCCESS|GRANTED|ENABLED/i.test(action)) return 'success'
  return 'info'
}

export function humanizeAction(action: string): string {
  // SCREAMING_SNAKE_CASE → Sentence case
  const lower = action.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function actorDisplayName(staff: ActivityLogStaff | null): string {
  if (!staff) return 'Sistema'
  const parts = [staff.firstName, staff.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'Staff sin nombre'
}
