import { expect, test } from '@playwright/test'

test.setTimeout(45_000)

const summary = {
  id: 'spei-case-lab',
  organizationId: 'org-lab',
  venueId: 'venue-lab',
  receivableId: 'receivable-lab',
  paymentAttemptId: 'attempt-lab',
  policyVersionId: 'policy-lab',
  observedAmountMinor: '2500000',
  currency: 'MXN',
  bankReference: 'SPEI-LAB-778899',
  observedAt: '2026-09-01T15:00:00.000Z',
  createdById: 'operator-lab',
  requiredApprovals: 2,
  exceptionReasons: ['AMOUNT_MISMATCH'],
  status: 'AWAITING_APPROVAL',
  reconciledReceiptId: null,
  evidenceCount: 1,
  approvalCount: 1,
  createdAt: '2026-09-01T15:01:00.000Z',
  updatedAt: '2026-09-01T15:02:00.000Z',
}

const detail = {
  ...summary,
  receivingAccountFingerprint: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  attributedCommercialActorIds: ['seller-lab'],
  evidence: [
    {
      id: 'evidence-lab',
      sequence: 1,
      contentSha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      mimeType: 'application/pdf',
      sizeBytes: 51200,
      uploadedById: 'operator-lab',
      createdAt: '2026-09-01T15:01:00.000Z',
      reviews: [],
    },
  ],
  approvals: [
    {
      id: 'approval-lab',
      actorId: 'reviewer-lab',
      policyVersionId: 'policy-lab',
      exceptionReasons: ['AMOUNT_MISMATCH'],
      createdAt: '2026-09-01T15:02:00.000Z',
    },
  ],
}

test('shows exact SPEI money and never submits approval before explicit confirmation', async ({
  page,
}) => {
  let approvalBody: unknown = null
  await page.addInitScript(() => window.localStorage.setItem('avoqado_session_hint', 'true'))
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    }),
  )
  await page.route('**/api/v1/dashboard/auth/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'superadmin-lab',
          firstName: 'Avoqado',
          lastName: 'Ops',
          email: 'ops@avoqado.test',
          photoUrl: null,
          role: 'SUPERADMIN',
          venues: [],
        },
      }),
    }),
  )
  await page.route('**/api/v1/superadmin/commercial/billing/manual-spei/cases?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [summary], nextCursor: null } }),
    }),
  )
  await page.route(
    '**/api/v1/superadmin/commercial/billing/manual-spei/cases/spei-case-lab',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: detail }),
      }),
  )
  await page.route(
    '**/api/v1/superadmin/commercial/billing/manual-spei/cases/spei-case-lab/approve',
    async (route) => {
      approvalBody = await route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { decision: 'APPROVAL_RECORDED' } }),
      })
    },
  )

  await page.goto('/commercial-billing')
  await expect(page.getByRole('heading', { name: 'Conciliación SPEI' })).toBeVisible()
  await expect(page.getByText('$25,000.00')).toBeVisible()
  await expect(page.getByText('SPEI-LAB-778899')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar caso' }).click()

  const approve = page.getByRole('button', { name: 'Registrar aprobación' })
  await expect(approve).toBeDisabled()
  expect(approvalBody).toBeNull()
  await page
    .getByRole('checkbox', { name: 'Confirmo que revisé importe, referencia y evidencia' })
    .check()
  await expect(approve).toBeEnabled()
  await approve.click()
  await expect
    .poll(() => approvalBody)
    .toEqual({ organizationId: 'org-lab', venueId: 'venue-lab', confirm: true })
})
