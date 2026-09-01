import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { TerminalMigrationDrawer } from './TerminalMigrationDrawer'
import type { Terminal } from './types'

// Radix Popover / cmdk usan ResizeObserver y scrollIntoView; jsdom no los trae.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const baseURL = 'http://localhost:3000/api/v1'

function makeTerminal(overrides: Partial<Terminal> = {}): Terminal {
  return {
    id: 't1',
    serialNumber: '1850072345',
    name: 'TPV Barra',
    type: 'TPV_ANDROID',
    brand: 'PAX',
    model: 'A910s',
    status: 'ACTIVE',
    lastHeartbeat: new Date(Date.now() - 60_000).toISOString(),
    version: '1.42.0',
    latestHealthScore: 85,
    latestHealthAt: new Date(Date.now() - 60_000).toISOString(),
    ipAddress: '192.168.1.10',
    isLocked: false,
    lockedAt: null,
    lockedReason: null,
    assignedMerchantIds: [],
    activationCode: null,
    activationCodeExpiry: null,
    activatedAt: '2026-01-01T00:00:00.000Z',
    venueId: 'v_source',
    venue: { id: 'v_source', name: 'Pez Volador', slug: 'pez-volador' },
    migration: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    ...overrides,
  }
}

function venueRow(id: string, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    status: 'ACTIVE',
    monthlyRevenue: 0,
    totalTransactions: 0,
    organizationId: 'org1',
    organization: { id: 'org1', name: 'Org Uno', email: 'org@example.com' },
    owner: { id: 'o1', firstName: 'O', lastName: 'Uno', email: 'o@example.com' },
    analytics: {
      monthlyTransactions: 0,
      monthlyRevenue: 0,
      averageOrderValue: 0,
      activeUsers: 0,
      lastActivityAt: '2026-01-01T00:00:00.000Z',
    },
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

let preflightCalled = false

const server = setupServer(
  http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
    HttpResponse.json({
      success: true,
      data: [venueRow('v_dest', 'Sucursal Norte'), venueRow('v_other', 'Sucursal Sur')],
    }),
  ),
  http.get(`${baseURL}/superadmin/onboarding/merchant-accounts`, () =>
    HttpResponse.json({ success: true, data: [], count: 0 }),
  ),
  http.get(`${baseURL}/superadmin/venues/v_dest/staff-access/candidates`, () =>
    HttpResponse.json({ data: [], message: 'ok' }),
  ),
  http.post(`${baseURL}/superadmin/terminals/t1/migrate-preflight`, () => {
    preflightCalled = true
    return HttpResponse.json({
      data: {
        canProceed: true,
        blockers: [],
        warnings: [],
        fromVenueId: 'v_source',
        toVenueId: 'v_dest',
      },
    })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  preflightCalled = false
})
afterAll(() => server.close())

describe('TerminalMigrationDrawer — step order', () => {
  it('desde "pick", al verificar destino avanza al paso de staff (NO directo a preflight)', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithProviders(
      <TerminalMigrationDrawer terminal={makeTerminal()} open onOpenChange={() => {}} />,
    )

    // Paso pick: elegir venue destino.
    const venueCombo = await screen.findByRole('button', { name: /selecciona venue destino/i })
    await user.click(venueCombo)
    await waitFor(() => expect(screen.getByText('Sucursal Norte')).toBeInTheDocument())
    await user.click(screen.getByText('Sucursal Norte'))

    // Click "Verificar destino" → debe ir al paso de staff, no al preflight.
    await user.click(screen.getByRole('button', { name: /verificar destino/i }))

    // El paso de staff renderiza su heading.
    await waitFor(() => expect(screen.getByText('Dar acceso en el destino')).toBeInTheDocument())
    // El preflight todavía NO debió correr (corre tras dar acceso u omitir).
    expect(preflightCalled).toBe(false)
  }, 15000)

  it('al omitir el paso de staff corre el preflight y avanza a la verificación', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithProviders(
      <TerminalMigrationDrawer terminal={makeTerminal()} open onOpenChange={() => {}} />,
    )

    const venueCombo = await screen.findByRole('button', { name: /selecciona venue destino/i })
    await user.click(venueCombo)
    await waitFor(() => expect(screen.getByText('Sucursal Norte')).toBeInTheDocument())
    await user.click(screen.getByText('Sucursal Norte'))
    await user.click(screen.getByRole('button', { name: /verificar destino/i }))

    await waitFor(() => expect(screen.getByText('Dar acceso en el destino')).toBeInTheDocument())

    // Omitir → corre preflight → muestra el resultado de la verificación.
    await user.click(screen.getByRole('button', { name: /^omitir$/i }))

    await waitFor(() => expect(preflightCalled).toBe(true))
    await waitFor(() =>
      expect(screen.getByText('Resultado de la verificación')).toBeInTheDocument(),
    )
  }, 15000)
})

// Asana 1218069201250971 (2026-09-01): un blocker MIGRATION_IN_PROGRESS ya no es un
// callejón sin salida. El backend describe el borrado pendiente (`pendingWipe`) y el
// drawer ofrece la salida: aquí, la de «descartar» tras 24 h de silencio.
describe('TerminalMigrationDrawer — MIGRATION_IN_PROGRESS tiene salida', () => {
  it('con un borrado pendiente de 24 h+ ofrece «Descartar», llama migrate-discard y vuelve a verificar', async () => {
    let discardCalled = false
    let preflightCalls = 0
    server.use(
      http.post(`${baseURL}/superadmin/terminals/t1/migrate-preflight`, () => {
        preflightCalls += 1
        if (preflightCalls === 1) {
          return HttpResponse.json({
            data: {
              canProceed: false,
              blockers: [
                { code: 'MIGRATION_IN_PROGRESS', message: 'Hay un borrado de fábrica pendiente.' },
              ],
              warnings: [],
              fromVenueId: 'v_source',
              toVenueId: 'v_dest',
              pendingWipe: {
                commandId: 'cmd-old',
                queuedAt: '2026-04-09T16:30:40.000Z',
                status: 'SENT',
                origin: 'MANUAL',
                toVenueId: null,
                cancellable: false,
                discardable: true,
                discardableAt: '2026-04-10T16:30:40.000Z',
              },
            },
          })
        }
        return HttpResponse.json({
          data: {
            canProceed: true,
            blockers: [],
            warnings: [],
            fromVenueId: 'v_source',
            toVenueId: 'v_dest',
            pendingWipe: null,
          },
        })
      }),
      http.post(`${baseURL}/superadmin/terminals/t1/migrate-discard`, () => {
        discardCalled = true
        return HttpResponse.json({ data: { discarded: 1, commandIds: ['cmd-old'] } })
      }),
    )

    const user = userEvent.setup({ delay: null })
    renderWithProviders(
      <TerminalMigrationDrawer terminal={makeTerminal()} open onOpenChange={() => {}} />,
    )
    const venueCombo = await screen.findByRole('button', { name: /selecciona venue destino/i })
    await user.click(venueCombo)
    await waitFor(() => expect(screen.getByText('Sucursal Norte')).toBeInTheDocument())
    await user.click(screen.getByText('Sucursal Norte'))
    await user.click(screen.getByRole('button', { name: /verificar destino/i }))
    await waitFor(() => expect(screen.getByText('Dar acceso en el destino')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^omitir$/i }))

    // El bloqueo se explica con fecha y origen; el banner pelón NO se repite.
    await waitFor(() =>
      expect(screen.getByText(/factory reset pendiente desde el/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText('Hay un borrado de fábrica pendiente.')).toBeNull()
    expect(screen.getByText(/factory reset manual/i)).toBeInTheDocument()

    // Descartar pide un segundo clic, y después vuelve a correr el preflight solo.
    await user.click(screen.getByRole('button', { name: /descartar el borrado/i }))
    await user.click(screen.getByRole('button', { name: /sí, descartarlo/i }))

    await waitFor(() => expect(discardCalled).toBe(true))
    await waitFor(() => expect(preflightCalls).toBe(2))
    await waitFor(() =>
      expect(screen.getByText(/sin bloqueadores ni advertencias/i)).toBeInTheDocument(),
    )
  }, 15000)

  it('con un borrado que la terminal aún no recibe ofrece «Cancelar», no «Descartar»', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/terminals/t1/migrate-preflight`, () =>
        HttpResponse.json({
          data: {
            canProceed: false,
            blockers: [
              { code: 'MIGRATION_IN_PROGRESS', message: 'Hay un borrado de fábrica pendiente.' },
            ],
            warnings: [],
            fromVenueId: 'v_source',
            toVenueId: 'v_dest',
            pendingWipe: {
              commandId: 'cmd-q',
              queuedAt: new Date().toISOString(),
              status: 'QUEUED',
              origin: 'MIGRATION',
              toVenueId: 'v_other',
              cancellable: true,
              discardable: false,
              discardableAt: new Date(Date.now() + 86_400_000).toISOString(),
            },
          },
        }),
      ),
    )

    const user = userEvent.setup({ delay: null })
    renderWithProviders(
      <TerminalMigrationDrawer terminal={makeTerminal()} open onOpenChange={() => {}} />,
    )
    const venueCombo = await screen.findByRole('button', { name: /selecciona venue destino/i })
    await user.click(venueCombo)
    await waitFor(() => expect(screen.getByText('Sucursal Norte')).toBeInTheDocument())
    await user.click(screen.getByText('Sucursal Norte'))
    await user.click(screen.getByRole('button', { name: /verificar destino/i }))
    await waitFor(() => expect(screen.getByText('Dar acceso en el destino')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^omitir$/i }))

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /cancelar el borrado pendiente/i }),
      ).toBeInTheDocument(),
    )
    // Nombra el venue al que iba la migración que dejó el borrado.
    expect(screen.getByText(/migración a Sucursal Sur/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /descartar el borrado/i })).toBeNull()
  }, 15000)
})
