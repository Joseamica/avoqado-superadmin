import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { server } from '@/test/mocks/server'
import { VenuePlanSection } from './VenuePlanSection'

const baseURL = 'http://localhost:3000/api/v1'
const venueId = 'v1'

/** PlanState como lo manda `GET /dashboard/venues/:venueId/plan` (envelope aparte). */
const basePlan = {
  hasPlan: true,
  state: 'active',
  planTier: 'PRO',
  planName: 'Plan Pro',
  interval: 'month',
  price: { base: 999, gross: 1158.84, currency: 'MXN' },
  trialEndsAt: null,
  currentPeriodEnd: '2026-07-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  paymentMethod: null,
  stripeSubscriptionId: 'sub_123',
  grandfathered: false,
  retentionOfferEligible: false,
}

// `Record<string, unknown>` (no `Partial<typeof basePlan>`) para poder simular
// nulls del backend (planTier: null) sin pelear con la inferencia literal.
function mockPlan(overrides: Record<string, unknown> = {}) {
  server.use(
    http.get(`${baseURL}/dashboard/venues/${venueId}/plan`, () =>
      HttpResponse.json({ success: true, data: { ...basePlan, ...overrides } }),
    ),
  )
}

function renderSection() {
  return renderWithProviders(<VenuePlanSection venueId={venueId} />)
}

describe('VenuePlanSection', () => {
  it('muestra el tier, el estado, el sub de Stripe y el badge Grandfathered', async () => {
    mockPlan({ grandfathered: true })
    renderSection()

    expect(await screen.findByText('Grandfathered (legacy)')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('sub_123')).toBeInTheDocument()
    // Explicación de una línea del estado legacy.
    expect(screen.getByText(/Exento de paywalls y del límite de usuarios/)).toBeInTheDocument()
  })

  it('muestra "Free" cuando no hay plan base (planTier null o GRATIS)', async () => {
    mockPlan({
      hasPlan: false,
      state: 'none',
      planTier: null,
      planName: null,
      stripeSubscriptionId: null,
    })
    renderSection()

    expect(await screen.findByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Sin plan de pago')).toBeInTheDocument()
    expect(screen.queryByText('Grandfathered (legacy)')).not.toBeInTheDocument()
  })

  it('quitar grandfathered pide confirmación con consecuencias y dispara el POST', async () => {
    const user = userEvent.setup()
    mockPlan({ grandfathered: true })

    let body: unknown = null
    server.use(
      http.post(
        `${baseURL}/dashboard/superadmin/venues/${venueId}/plan/grandfathered`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            success: true,
            data: { ...basePlan, grandfathered: false },
          })
        },
      ),
    )

    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Quitar grandfathered' }))

    // Confirmación con las consecuencias — el POST NO se dispara todavía.
    expect(
      await screen.findByText(/cap de 2 usuarios en Free y paywalls Pro\/Premium/),
    ).toBeInTheDocument()
    expect(body).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(body).toEqual({ grandfathered: false }))

    // El cache se actualiza con el PlanState fresco — el badge desaparece.
    await waitFor(() =>
      expect(screen.queryByText('Grandfathered (legacy)')).not.toBeInTheDocument(),
    )
  })

  it('asignar plan comp manda el tier elegido', async () => {
    const user = userEvent.setup()
    mockPlan()

    let body: unknown = null
    server.use(
      http.post(
        `${baseURL}/dashboard/superadmin/venues/${venueId}/plan/comp`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            success: true,
            data: { ...basePlan, planTier: 'PREMIUM', planName: 'Plan Premium' },
          })
        },
      ),
    )

    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Asignar plan comp' }))
    expect(await screen.findByText(/Plan permanente sin cobro ni vencimiento/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Premium' }))
    await user.click(screen.getByRole('button', { name: 'Asignar Premium' }))

    await waitFor(() => expect(body).toEqual({ tier: 'PREMIUM' }))
  })

  it('dar días de prueba valida 1..365, permite vaciar el input y manda tier + days', async () => {
    const user = userEvent.setup()
    mockPlan()

    let body: unknown = null
    server.use(
      http.post(
        `${baseURL}/dashboard/superadmin/venues/${venueId}/plan/trial`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            success: true,
            data: { ...basePlan, state: 'trial', trialEndsAt: '2026-07-10T00:00:00.000Z' },
          })
        },
      ),
    )

    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Dar días de prueba' }))

    const input = await screen.findByLabelText('Días de prueba')
    const submit = screen.getByRole('button', { name: 'Otorgar días' })

    // Vaciar el input no atora el formulario en "0" — sólo deshabilita el submit.
    await user.clear(input)
    expect(input).toHaveValue(null)
    expect(submit).toBeDisabled()

    // Fuera de rango: > 365.
    await user.type(input, '400')
    expect(submit).toBeDisabled()
    expect(screen.getByText('Debe ser un entero entre 1 y 365.')).toBeInTheDocument()

    // Fuera de rango: < 1.
    await user.clear(input)
    await user.type(input, '0')
    expect(submit).toBeDisabled()

    // Válido — dispara el POST con el tier elegido (Premium) y los días.
    await user.clear(input)
    await user.type(input, '30')
    await user.click(screen.getByRole('button', { name: 'Premium' }))
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => expect(body).toEqual({ tier: 'PREMIUM', days: 30 }))
  })
})
