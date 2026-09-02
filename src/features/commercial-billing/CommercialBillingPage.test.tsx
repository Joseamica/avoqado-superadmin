import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { CommercialBillingPage } from './CommercialBillingPage'

const baseURL = 'http://localhost:3000/api/v1'
const summary = {
  id: 'spei-case-1',
  organizationId: 'org-1',
  venueId: 'venue-1',
  receivableId: 'recv-1',
  paymentAttemptId: 'attempt-1',
  policyVersionId: 'policy-v1',
  observedAmountMinor: '2500000',
  currency: 'MXN',
  bankReference: 'SPEI-778899',
  observedAt: '2026-09-01T15:00:00.000Z',
  createdById: 'operator-1',
  requiredApprovals: 2,
  exceptionReasons: ['AMOUNT_MISMATCH'],
  status: 'AWAITING_APPROVAL',
  reconciledReceiptId: null,
  evidenceCount: 1,
  approvalCount: 1,
  createdAt: '2026-09-01T15:01:00.000Z',
  updatedAt: '2026-09-01T15:02:00.000Z',
} as const

const detail = {
  ...summary,
  receivingAccountFingerprint: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  attributedCommercialActorIds: ['seller-1'],
  evidence: [
    {
      id: 'evidence-1',
      sequence: 1,
      contentSha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      mimeType: 'application/pdf',
      sizeBytes: 51200,
      uploadedById: 'operator-1',
      createdAt: '2026-09-01T15:01:00.000Z',
      reviews: [],
    },
  ],
  approvals: [
    {
      id: 'approval-1',
      actorId: 'reviewer-1',
      policyVersionId: 'policy-v1',
      exceptionReasons: ['AMOUNT_MISMATCH'],
      createdAt: '2026-09-01T15:02:00.000Z',
    },
  ],
}

let approvalBody: unknown
let reviewBody: unknown
let evidenceAccessQuery: URLSearchParams | undefined
const server = setupServer(
  http.get(`${baseURL}/superadmin/commercial/billing/manual-spei/cases`, () =>
    HttpResponse.json({ success: true, data: { items: [summary], nextCursor: null } }),
  ),
  http.get(`${baseURL}/superadmin/commercial/billing/manual-spei/cases/:caseId`, () =>
    HttpResponse.json({ success: true, data: detail }),
  ),
  http.post(
    `${baseURL}/superadmin/commercial/billing/manual-spei/cases/:caseId/approve`,
    async ({ request }) => {
      approvalBody = await request.json()
      return HttpResponse.json({ success: true, data: { decision: 'APPROVAL_RECORDED' } })
    },
  ),
  http.post(
    `${baseURL}/superadmin/commercial/billing/manual-spei/evidence/:evidenceId/review`,
    async ({ request }) => {
      reviewBody = await request.json()
      return HttpResponse.json({
        success: true,
        data: { evidenceId: 'evidence-1', caseId: 'spei-case-1', status: 'REJECTED' },
      })
    },
  ),
  http.get(
    `${baseURL}/superadmin/commercial/billing/manual-spei/evidence/:evidenceId/access`,
    ({ request }) => {
      evidenceAccessQuery = new URL(request.url).searchParams
      return HttpResponse.json({
        success: true,
        data: {
          url: 'https://storage.test/signed-proof',
          expiresInMinutes: 10,
          mimeType: 'application/pdf',
          sizeBytes: 51200,
        },
      })
    },
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  approvalBody = undefined
  reviewBody = undefined
  evidenceAccessQuery = undefined
  vi.restoreAllMocks()
  server.resetHandlers()
})
afterAll(() => server.close())

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommercialBillingPage />
    </QueryClientProvider>,
  )
}

describe('CommercialBillingPage', () => {
  it('shows an exact SPEI amount and requires explicit confirmation before approval', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Conciliación SPEI' })).toBeInTheDocument()
    expect(await screen.findByText('$25,000.00')).toBeInTheDocument()
    expect(screen.getByText('SPEI-778899')).toBeInTheDocument()
    expect(screen.getByText('1 de 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revisar caso' }))

    expect(await screen.findByText('01234567…cdef')).toBeInTheDocument()
    expect(screen.getByText('Evidencia #1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir evidencia #1' }))
    await waitFor(() => {
      expect(evidenceAccessQuery?.get('organizationId')).toBe('org-1')
      expect(evidenceAccessQuery?.get('venueId')).toBe('venue-1')
      expect(open).toHaveBeenCalledWith(
        'https://storage.test/signed-proof',
        '_blank',
        'noopener,noreferrer',
      )
    })
    const approve = screen.getByRole('button', { name: 'Registrar aprobación' })
    expect(approve).toBeDisabled()

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Confirmo que revisé importe, referencia y evidencia',
      }),
    )
    expect(approve).toBeEnabled()
    await user.click(approve)

    await waitFor(() =>
      expect(approvalBody).toEqual({
        organizationId: 'org-1',
        venueId: 'venue-1',
        confirm: true,
      }),
    )
    await waitFor(() => expect(approve).toBeDisabled())
  })

  it('requires a reason to reject evidence and sends only the scoped review payload', async () => {
    const pending = { ...summary, status: 'PENDING_REVIEW' as const, approvalCount: 0 }
    server.use(
      http.get(`${baseURL}/superadmin/commercial/billing/manual-spei/cases`, () =>
        HttpResponse.json({ success: true, data: { items: [pending], nextCursor: null } }),
      ),
      http.get(`${baseURL}/superadmin/commercial/billing/manual-spei/cases/:caseId`, () =>
        HttpResponse.json({ success: true, data: { ...detail, ...pending, approvals: [] } }),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Revisar caso' }))
    const reject = await screen.findByRole('button', { name: 'Rechazar evidencia' })
    expect(reject).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo si se rechaza'), 'La referencia no coincide')
    expect(reject).toBeEnabled()
    await user.click(reject)

    await waitFor(() =>
      expect(reviewBody).toEqual({
        organizationId: 'org-1',
        venueId: 'venue-1',
        action: 'REJECT',
        reason: 'La referencia no coincide',
      }),
    )
  })

  it('loads the next server page instead of silently hiding cases after the first page', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/commercial/billing/manual-spei/cases`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        if (cursor === 'cursor-1') {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                {
                  ...summary,
                  id: 'spei-case-2',
                  bankReference: 'SPEI-SECOND-PAGE',
                },
              ],
              nextCursor: null,
            },
          })
        }
        return HttpResponse.json({
          success: true,
          data: { items: [summary], nextCursor: 'cursor-1' },
        })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('SPEI-778899')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cargar más casos' }))
    expect(await screen.findByText('SPEI-SECOND-PAGE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar más casos' })).not.toBeInTheDocument()
  })
})
