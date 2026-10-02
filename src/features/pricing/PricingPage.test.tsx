import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { renderWithProviders, screen, waitFor, within } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { pricingBoard } from '@/test/mocks/handlers'
import { formatDate } from '@/shared/lib/datetime'
import { toast } from 'sonner'
import PricingPage from './PricingPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

installGlobalServer()

const BASE = 'http://localhost:3000/api/v1/superadmin'
const cfdi = pricingBoard.find((row) => row.productKey === 'FEATURE:CFDI')!

async function renderPage() {
  const user = userEvent.setup()
  renderWithProviders(<PricingPage />)
  await screen.findByText('Facturación CFDI')
  return user
}

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement
}

async function openCfdiDialog(user: ReturnType<typeof userEvent.setup>, price: string) {
  await user.click(screen.getByRole('button', { name: 'Editar precio de Facturación CFDI' }))
  const dialog = await screen.findByRole('dialog')
  const input = within(dialog).getByLabelText('Precio nuevo')
  await user.clear(input)
  await user.type(input, price)
  return dialog
}

const boardWith = (patch: (row: (typeof pricingBoard)[number]) => Record<string, unknown>) =>
  http.get(`${BASE}/hybrid-pricing`, () =>
    HttpResponse.json({
      success: true,
      data: pricingBoard.map((row) => (row.productKey === 'FEATURE:CFDI' ? patch(row) : row)),
    }),
  )
const breaks = (details: unknown[]) =>
  HttpResponse.json(
    {
      message:
        'Hay promociones activas que costarían lo mismo o más que este precio de lista, o que renovarían por encima de él. Páusalas antes de guardarlo.',
      code: 'HYBRID_LIST_BREAKS_PROMOTIONS',
      details,
    },
    { status: 409 },
  )

describe('PricingPage', () => {
  it('shows plans and functions with their price, status and why a row is not editable', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Planes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Funciones' })).toBeInTheDocument()

    const cfdiRow = rowOf('Facturación CFDI')
    expect(within(cfdiRow).getByText('$199.00')).toBeInTheDocument()
    expect(within(cfdiRow).getByText('En venta suelta')).toBeInTheDocument()

    const system = rowOf('Cobra con tarjeta (TPV)')
    expect(within(system).getByText('Parte del sistema')).toBeInTheDocument()
    expect(within(system).queryByRole('button', { name: /Editar precio/ })).toBeNull()

    expect(within(rowOf('Pro')).getByText('Se edita en la fase 2')).toBeInTheDocument()
  })

  it('confirms the price change and saves it with the row revision', async () => {
    const bodies: unknown[] = []
    let path = ''
    server.use(
      http.put(`${BASE}/hybrid-pricing/lists/:productKey`, async ({ request }) => {
        path = new URL(request.url).pathname
        bodies.push(await request.json())
        return HttpResponse.json({ success: true, data: { ...cfdi, revision: 4, price: 249 } })
      }),
    )
    const user = await renderPage()
    const dialog = await openCfdiDialog(user, '249')
    expect(within(dialog).getByText('Precio actual $199.00 → Nuevo $249.00')).toBeInTheDocument()
    expect(within(dialog).getByText(/Quien ya la paga conserva su precio/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Guardar precio' }))
    await waitFor(() => expect(bodies).toEqual([{ price: 249, expectedRevision: 3 }]))
    expect(path).toBe('/api/v1/superadmin/hybrid-pricing/lists/FEATURE%3ACFDI')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('lists the promotions a price would break and pauses each group once before saving again', async () => {
    let puts = 0
    const groupPauses: { id: string; body: unknown }[] = []
    const campaignPauses: { id: string; body: unknown }[] = []
    const violation = { listPrice: 249, renewalPrice: null }
    server.use(
      http.put(`${BASE}/hybrid-pricing/lists/:productKey`, () => {
        puts += 1
        if (puts > 1)
          return HttpResponse.json({ success: true, data: { ...cfdi, revision: 4, price: 249 } })
        return HttpResponse.json(
          {
            message:
              'Hay promociones activas que costarían lo mismo o más que este precio de lista.',
            code: 'HYBRID_LIST_BREAKS_PROMOTIONS',
            details: [
              {
                ...violation,
                campaignId: 'promo-1',
                campaignName: 'Promo CFDI 20 %',
                price: 479.2,
                revision: 2,
                promotionGroupId: 'group-1',
                groupRevision: 7,
              },
              {
                ...violation,
                campaignId: 'promo-2',
                campaignName: 'Promo CFDI 20 % (bis)',
                price: 300,
                revision: 5,
                promotionGroupId: 'group-1',
                groupRevision: 7,
              },
              {
                ...violation,
                campaignId: 'manual-1',
                campaignName: 'CFDI de otoño',
                price: 260,
                renewalPrice: 300,
                revision: 9,
                promotionGroupId: null,
                groupRevision: null,
              },
            ],
          },
          { status: 409 },
        )
      }),
      http.post(`${BASE}/hybrid-pricing/percent/:groupId/status`, async ({ params, request }) => {
        groupPauses.push({ id: String(params.groupId), body: await request.json() })
        return HttpResponse.json({ success: true, data: {} })
      }),
      http.post(`${BASE}/hybrid-campaigns/:id/status`, async ({ params, request }) => {
        campaignPauses.push({ id: String(params.id), body: await request.json() })
        return HttpResponse.json({ success: true, data: {} })
      }),
    )
    const user = await renderPage()
    const dialog = await openCfdiDialog(user, '249')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar precio' }))

    expect(await within(dialog).findByText('Promo CFDI 20 % · $479.20')).toBeInTheDocument()
    expect(within(dialog).getByText('CFDI de otoño · $260.00')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Pausar estas promociones' }))

    await waitFor(() => expect(puts).toBe(2))
    expect(groupPauses).toEqual([
      { id: 'group-1', body: { status: 'PAUSED', expectedRevision: 7 } },
    ])
    expect(campaignPauses).toEqual([
      { id: 'manual-1', body: { status: 'PAUSED', expectedRevision: 9 } },
    ])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a first price reads «Sin precio actual → Nuevo»', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar precio de Inventario FIFO' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Precio nuevo'), '249')
    expect(within(dialog).getByText('Sin precio actual → Nuevo $249.00')).toBeInTheDocument()
  })

  it('names the % discount on sale over the function, to recalculate it after saving', async () => {
    server.use(
      http.get(`${BASE}/hybrid-pricing`, () =>
        HttpResponse.json({
          success: true,
          data: pricingBoard.map((row) =>
            row.productKey === 'FEATURE:CFDI'
              ? { ...row, activeGroups: [{ id: 'group-1', name: 'Septiembre 20 %', revision: 3 }] }
              : row,
          ),
        }),
      ),
    )
    const user = await renderPage()
    const dialog = await openCfdiDialog(user, '249')
    expect(
      within(dialog).getByText(
        'Un descuento activo la abarca: «Septiembre 20 %». Después de guardar, recalcúlalo en Descuentos % para que el % aplique sobre el precio nuevo.',
      ),
    ).toBeInTheDocument()
  })

  it('when only some promotions could be paused, saves again so the list shows exactly what still blocks', async () => {
    let puts = 0
    const blocking = (
      campaignId: string,
      campaignName: string,
      promotionGroupId: string | null,
    ) => ({
      campaignId,
      campaignName,
      price: 260,
      renewalPrice: null,
      listPrice: 249,
      revision: 2,
      promotionGroupId,
      groupRevision: promotionGroupId ? 7 : null,
    })
    server.use(
      http.put(`${BASE}/hybrid-pricing/lists/:productKey`, () => {
        puts += 1
        return HttpResponse.json(
          {
            message:
              'Hay promociones activas que costarían lo mismo o más que este precio de lista.',
            code: 'HYBRID_LIST_BREAKS_PROMOTIONS',
            details:
              puts === 1
                ? [
                    blocking('promo-1', 'Promo CFDI 20 %', 'group-1'),
                    blocking('manual-1', 'CFDI de otoño', null),
                  ]
                : [blocking('manual-1', 'CFDI de otoño', null)],
          },
          { status: 409 },
        )
      }),
      http.post(`${BASE}/hybrid-pricing/percent/:groupId/status`, () =>
        HttpResponse.json({ success: true, data: {} }),
      ),
      http.post(`${BASE}/hybrid-campaigns/:id/status`, () =>
        HttpResponse.json(
          { message: 'La ficha cambió.', code: 'HYBRID_CAMPAIGN_STALE' },
          { status: 409 },
        ),
      ),
    )
    const user = await renderPage()
    const dialog = await openCfdiDialog(user, '249')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar precio' }))
    await user.click(
      await within(dialog).findByRole('button', { name: 'Pausar estas promociones' }),
    )

    await waitFor(() => expect(puts).toBe(2))
    expect(await within(dialog).findByText('CFDI de otoño · $260.00')).toBeInTheDocument()
    expect(within(dialog).queryByText('Promo CFDI 20 % · $260.00')).toBeNull()
  })

  it('shows a price Stripe could not prepare as pending, with «Reintentar», instead of an error', async () => {
    let retries = 0
    server.use(
      http.put(`${BASE}/hybrid-pricing/lists/:productKey`, () =>
        HttpResponse.json(
          {
            message:
              'No pudimos preparar el precio en Stripe. El precio anterior se sigue vendiendo; reintenta.',
            code: 'HYBRID_LIST_PREPARING',
            details: { ...cfdi, revision: 4, pendingPrice: 249 },
          },
          { status: 409 },
        ),
      ),
      http.post(`${BASE}/hybrid-pricing/lists/:productKey/retry`, () => {
        retries += 1
        return HttpResponse.json({ success: true, data: { ...cfdi, revision: 5, price: 249 } })
      }),
    )
    const user = await renderPage()
    const dialog = await openCfdiDialog(user, '249')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar precio' }))

    expect(await within(dialog).findByText('Precio nuevo pendiente: $249.00')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(retries).toBe(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('reloads the board when the price changed under the dialog', async () => {
    let boardReads = 0
    server.use(
      http.get(`${BASE}/hybrid-pricing`, () => {
        boardReads += 1
        return HttpResponse.json({ success: true, data: pricingBoard })
      }),
      http.put(`${BASE}/hybrid-pricing/lists/:productKey`, () =>
        HttpResponse.json(
          { message: 'La ficha cambió.', code: 'HYBRID_CAMPAIGN_STALE' },
          { status: 409 },
        ),
      ),
    )
    const user = await renderPage()
    const dialog = await openCfdiDialog(user, '249')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar precio' }))
    await waitFor(() => expect(boardReads).toBe(2))
  })

  it('keeps a price that Stripe has not confirmed visible and retries it', async () => {
    let retried = ''
    server.use(
      http.post(`${BASE}/hybrid-pricing/lists/:productKey/retry`, ({ request }) => {
        retried = new URL(request.url).pathname
        const row = pricingBoard.find((r) => r.productKey === 'FEATURE:INVENTORY_TRACKING')!
        return HttpResponse.json({
          success: true,
          data: { ...row, price: 249, pendingPrice: null, status: 'ACTIVE' },
        })
      }),
    )
    const user = await renderPage()
    const pending = rowOf('Inventario FIFO')
    expect(within(pending).getByText('Precio nuevo pendiente: $249.00')).toBeInTheDocument()
    expect(within(pending).getByText('Preparando precio…')).toBeInTheDocument()

    await user.click(within(pending).getByRole('button', { name: /Reintentar/ }))
    await waitFor(() =>
      expect(retried).toBe(
        '/api/v1/superadmin/hybrid-pricing/lists/FEATURE%3AINVENTORY_TRACKING/retry',
      ),
    )
  })

  it('shows who pays a previous rate, with the reason in Spanish and server pagination', async () => {
    const pages: string[] = []
    const base = { venueId: 'v', listPrice: '249.00', since: '2026-06-01T06:00:00.000Z' }
    server.use(
      http.get(`${BASE}/hybrid-pricing/gaps/:productKey`, ({ request }) => {
        const url = new URL(request.url)
        pages.push(url.searchParams.get('page') ?? '')
        return HttpResponse.json({
          success: true,
          data: {
            total: 60,
            items: [
              {
                ...base,
                contractId: 'k1',
                venueName: 'Testarudo',
                organizationName: 'Testarudo SA',
                rate: '149.00',
                gap: '100.00',
                reason: 'OLD_LIST',
                reasonUntil: null,
              },
              {
                ...base,
                contractId: 'k2',
                venueName: 'Mindform',
                organizationName: 'Mindform',
                rate: '179.00',
                gap: '70.00',
                reason: 'PROMO_FOREVER',
                reasonUntil: null,
              },
              {
                ...base,
                contractId: 'k3',
                venueName: 'Amaena',
                organizationName: 'Amaena',
                rate: '199.00',
                gap: '50.00',
                reason: 'PROMO_TEMPORARY',
                reasonUntil: '2026-12-01T06:00:00.000Z',
              },
              {
                ...base,
                contractId: 'k4',
                venueName: 'Café Uno',
                organizationName: 'Uno',
                rate: '219.00',
                gap: '30.00',
                reason: 'RENEWED_OLD_LIST',
                reasonUntil: null,
              },
              {
                ...base,
                contractId: 'k5',
                venueName: 'Café Dos',
                organizationName: 'Dos',
                rate: '229.00',
                gap: '20.00',
                reason: 'PROMO_ENDING',
                reasonUntil: '2027-01-01T06:00:00.000Z',
              },
            ],
          },
        })
      }),
    )
    const user = await renderPage()
    const cfdiRow = rowOf('Facturación CFDI')
    expect(
      within(cfdiRow).getByText(
        '3 negocios con tarifa anterior · diferencia de tarifas: $300.00 al mes',
      ),
    ).toBeInTheDocument()
    await user.click(within(cfdiRow).getByRole('button', { name: /Ver quiénes/ }))

    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByText('Testarudo')).toBeInTheDocument()
    expect(within(drawer).getByText('Precio de lista anterior')).toBeInTheDocument()
    expect(within(drawer).getByText('Promoción para siempre')).toBeInTheDocument()
    expect(
      within(drawer).getByText(
        `Promoción temporal (cambia el ${formatDate('2026-12-01T06:00:00.000Z')})`,
      ),
    ).toBeInTheDocument()
    expect(within(drawer).getByText('Renovó a una lista anterior')).toBeInTheDocument()
    expect(
      within(drawer).getByText(
        `Promoción que termina el ${formatDate('2027-01-01T06:00:00.000Z')}`,
      ),
    ).toBeInTheDocument()
    expect(within(drawer).getByText(/60 contratos de 3 negocios/)).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(pages).toEqual(['1', '2']))
  })

  it('resuming a list that active promotions would break says so, and how to see and pause them', async () => {
    server.use(
      boardWith((row) => ({ ...row, status: 'PAUSED' })),
      http.post(`${BASE}/hybrid-pricing/lists/:productKey/status`, () => breaks([])),
    )
    const user = await renderPage()
    await user.click(
      screen.getByRole('button', { name: 'Reanudar venta suelta de Facturación CFDI' }),
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Hay promociones activas que chocan con este precio',
        {
          description: expect.stringMatching(
            /^Hay promociones activas que costarían .* Edita el precio para verlas y pausarlas\.$/,
          ),
        },
      ),
    )
  })

  it('pausing a list a % discount covers says its discounts stop selling too', async () => {
    const activeGroups = [{ id: 'group-1', name: 'Septiembre 20 %', revision: 3 }]
    server.use(
      boardWith((row) => ({ ...row, activeGroups })),
      http.post(`${BASE}/hybrid-pricing/lists/:productKey/status`, () =>
        HttpResponse.json({
          success: true,
          data: { ...cfdi, status: 'PAUSED', revision: 4, activeGroups },
        }),
      ),
    )
    const user = await renderPage()
    await user.click(
      screen.getByRole('button', { name: 'Pausar venta suelta de Facturación CFDI' }),
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Facturación CFDI ya no se vende suelta y sus descuentos % dejan de venderse mientras tanto',
        { description: 'Quien ya la paga conserva su precio.' },
      ),
    )
  })

  it('a retry that finds nothing pending says the price is up to date, not that a new one went on sale', async () => {
    const pendingRow = pricingBoard.find((r) => r.productKey === 'FEATURE:INVENTORY_TRACKING')!
    server.use(
      http.post(`${BASE}/hybrid-pricing/lists/:productKey/retry`, () =>
        HttpResponse.json({
          success: true,
          data: { ...pendingRow, revision: 9, pendingPrice: null },
        }),
      ),
    )
    const user = await renderPage()
    await user.click(within(rowOf('Inventario FIFO')).getByRole('button', { name: /Reintentar/ }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Precio al día', {
        description: 'No había un precio pendiente: el que ves ya está en venta.',
      }),
    )
    expect(toast.success).not.toHaveBeenCalledWith(
      expect.stringMatching(/en venta$/),
      expect.anything(),
    )
  })

  it('a save refused for breaking promotions reloads the board; after pausing, a price left pending is finished', async () => {
    let boardReads = 0
    let puts = 0
    let retries = 0
    server.use(
      http.get(`${BASE}/hybrid-pricing`, () => {
        boardReads += 1
        return HttpResponse.json({
          success: true,
          data: pricingBoard.map((row) =>
            row.productKey === 'FEATURE:CFDI' && boardReads > 1
              ? { ...row, revision: 4, pendingPrice: 249 }
              : row,
          ),
        })
      }),
      http.put(`${BASE}/hybrid-pricing/lists/:productKey`, () => {
        puts += 1
        return breaks([
          {
            campaignId: 'manual-1',
            campaignName: 'CFDI de otoño',
            price: 260,
            renewalPrice: null,
            listPrice: 249,
            revision: 9,
            promotionGroupId: null,
            groupRevision: null,
          },
        ])
      }),
      http.post(`${BASE}/hybrid-campaigns/:id/status`, () =>
        HttpResponse.json({ success: true, data: {} }),
      ),
      http.post(`${BASE}/hybrid-pricing/lists/:productKey/retry`, () => {
        retries += 1
        return HttpResponse.json({
          success: true,
          data: { ...cfdi, revision: 5, price: 249, pendingPrice: null },
        })
      }),
    )
    const user = await renderPage()
    const dialog = await openCfdiDialog(user, '249')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar precio' }))
    expect(await within(dialog).findByText('CFDI de otoño · $260.00')).toBeInTheDocument()
    await waitFor(() => expect(boardReads).toBe(2))
    await user.click(within(dialog).getByRole('button', { name: 'Pausar estas promociones' }))
    await waitFor(() => expect(retries).toBe(1))
    expect(puts).toBe(1)
  })
})
