import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { renderWithProviders, screen, waitFor, within } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { toast } from 'sonner'
import { HybridCampaignsPage } from './HybridCampaignsPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

installGlobalServer()
beforeAll(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
)
// cmdk (Combobox) scrolls the active option into view; jsdom does not implement it.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})
afterAll(() => vi.unstubAllGlobals())

const BASE = 'http://localhost:3000/api/v1/superadmin'
const definition = (featureCodes: string[], price: number) => ({
  schemaVersion: 1,
  kind: 'FEATURES',
  featureCodes,
  terms: {
    currency: 'MXN',
    interval: 'MONTHLY',
    price,
    taxIncluded: true,
    promotionCycles: null,
    renewal: { kind: 'SAME_PRICE' },
  },
})
const campaignRow = {
  slug: 'x',
  status: 'PAUSED',
  revision: 1,
  startsAt: '2026-10-01T06:00:00.000Z',
  endsAt: '2026-12-01T06:00:00.000Z',
  capacity: 10,
  reservedCount: 0,
  redeemedCount: 0,
  audience: 'ALL',
  eligibleOrganizationIds: [],
  listed: true,
  promotionGroupId: null,
}
const manual = {
  ...campaignRow,
  id: 'manual',
  code: 'OTONO',
  name: 'Campaña de otoño',
  draftDefinition: definition(['CFDI', 'LOYALTY_PROGRAM'], 299),
}
// The 31 campaigns of a 31-function group: the server leaves them out of «Campañas» when asked to.
const generated = Array.from({ length: 31 }, (_, i) => ({
  ...campaignRow,
  id: `generated-${i}`,
  code: `GGROUP_${String(i + 1).padStart(2, '0')}`,
  name: `Septiembre 20 % · Función ${i + 1}`,
  promotionGroupId: 'group-31',
  draftDefinition: definition([`F${i}`], 159.2),
}))
const group = (overrides: Record<string, unknown>) => ({
  id: 'group-31',
  name: 'Septiembre 20 %',
  percentOff: 20,
  target: { kind: 'ALL_FEATURES' },
  startsAt: '2026-10-01T06:00:00.000Z',
  endsAt: '2026-12-01T06:00:00.000Z',
  promotionCycles: null,
  capacityPerFeature: 10,
  status: 'PAUSED',
  revision: 4,
  functions: 31,
  createdAt: '2026-09-30T18:00:00.000Z',
  ...overrides,
})

function serve(groups: unknown[]) {
  const campaignQueries: URLSearchParams[] = []
  const writes: { path: string; body: unknown }[] = []
  server.use(
    http.get(`${BASE}/hybrid-campaigns`, ({ request }) => {
      const query = new URL(request.url).searchParams
      campaignQueries.push(query)
      const items = query.get('excludeGrouped') === 'true' ? [manual] : [manual, ...generated]
      return HttpResponse.json({
        success: true,
        data: { items, total: items.length, page: 1, pageSize: 25 },
      })
    }),
    http.get(`${BASE}/hybrid-pricing/percent`, () =>
      HttpResponse.json({
        success: true,
        data: { items: groups, total: groups.length, page: 1, pageSize: 25, totalPages: 1 },
      }),
    ),
    http.post(`${BASE}/hybrid-pricing/percent/:id/status`, async ({ request }) => {
      writes.push({ path: new URL(request.url).pathname, body: await request.json() })
      return HttpResponse.json({ success: true, data: group({}) })
    }),
    http.post(`${BASE}/hybrid-pricing/percent/:id/recalculate`, async ({ request }) => {
      writes.push({ path: new URL(request.url).pathname, body: await request.json() })
      return HttpResponse.json({ success: true, data: group({ revision: 5 }) })
    }),
  )
  return { campaignQueries, writes }
}

async function renderPage() {
  const user = userEvent.setup()
  renderWithProviders(<HybridCampaignsPage />)
  await screen.findByRole('button', { name: 'Ver Campaña de otoño' })
  return user
}

const groupsSection = () => screen.getByRole('region', { name: 'Descuentos %' })

describe('HybridCampaignsPage · «Descuentos %»', () => {
  it('shows a 31-function group once in «Descuentos %» and none of its campaigns in «Campañas»', async () => {
    const { campaignQueries } = serve([group({})])
    await renderPage()
    expect(
      await within(groupsSection()).findByText('Descuento 20 % · 31 funciones'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Descuento 20 % · 31 funciones')).toHaveLength(1)
    expect(screen.queryByText(/Septiembre 20 % · Función/)).toBeNull()
    expect(campaignQueries.every((query) => query.get('excludeGrouped') === 'true')).toBe(true)
  })

  it('a paused group offers Activar, Recalcular and Terminar; an active one Pausar and Terminar', async () => {
    serve([group({}), group({ id: 'group-2', name: 'Octubre 10 %', status: 'ACTIVE' })])
    await renderPage()
    const section = groupsSection()
    await within(section).findByText('Septiembre 20 %')
    for (const name of ['Activar', 'Recalcular', 'Terminar'])
      expect(
        within(section).getByRole('button', { name: `${name} Septiembre 20 %` }),
      ).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Pausar Septiembre 20 %' })).toBeNull()
    for (const name of ['Pausar', 'Terminar'])
      expect(
        within(section).getByRole('button', { name: `${name} Octubre 10 %` }),
      ).toBeInTheDocument()
    for (const name of ['Activar', 'Recalcular'])
      expect(within(section).queryByRole('button', { name: `${name} Octubre 10 %` })).toBeNull()
  })

  it('recalculates and activates with the revision it shows', async () => {
    const { writes } = serve([group({})])
    const user = await renderPage()
    await user.click(
      await within(groupsSection()).findByRole('button', { name: 'Recalcular Septiembre 20 %' }),
    )
    await waitFor(() =>
      expect(writes).toEqual([
        {
          path: '/api/v1/superadmin/hybrid-pricing/percent/group-31/recalculate',
          body: { expectedRevision: 4 },
        },
      ]),
    )
    await user.click(
      within(groupsSection()).getByRole('button', { name: 'Activar Septiembre 20 %' }),
    )
    await waitFor(() =>
      expect(writes[1]).toEqual({
        path: '/api/v1/superadmin/hybrid-pricing/percent/group-31/status',
        body: { status: 'ACTIVE', expectedRevision: 4 },
      }),
    )
  })

  it('ending a group is confirmed first, because it cannot come back', async () => {
    const { writes } = serve([group({})])
    const user = await renderPage()
    await user.click(
      await within(groupsSection()).findByRole('button', { name: 'Terminar Septiembre 20 %' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/no se puede reactivar/)).toBeInTheDocument()
    expect(writes).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Terminar descuento' }))
    await waitFor(() =>
      expect(writes).toEqual([
        {
          path: '/api/v1/superadmin/hybrid-pricing/percent/group-31/status',
          body: { status: 'ENDED', expectedRevision: 4 },
        },
      ]),
    )
  })

  it('explains that sales are closed when activating is refused for it', async () => {
    serve([group({})])
    server.use(
      http.post(`${BASE}/hybrid-pricing/percent/:id/status`, () =>
        HttpResponse.json(
          {
            message: 'Las nuevas ofertas aún no están disponibles para contratar.',
            code: 'HYBRID_SALES_CLOSED',
          },
          { status: 409 },
        ),
      ),
    )
    const user = await renderPage()
    await user.click(
      await within(groupsSection()).findByRole('button', { name: 'Activar Septiembre 20 %' }),
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'La venta de ofertas está cerrada',
        expect.objectContaining({ description: expect.stringMatching(/sigue pausado/) }),
      ),
    )
  })
})
