import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { DateTime } from 'luxon'
import { renderWithProviders, screen, waitFor, within } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { toast } from 'sonner'
import { PercentPromotionForm } from './PercentPromotionForm'

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

const PERCENT = 'http://localhost:3000/api/v1/superadmin/hybrid-pricing/percent'
// The window picked in the calendar: the 1st to the 28th of next month, Mexico City time, sent in UTC.
const next = DateTime.now().setZone('America/Mexico_City').plus({ months: 1 }).startOf('month')
const startsAt = next.toUTC().toISO()
const endsAt = next
  .set({ day: 28, hour: 23, minute: 59, second: 59, millisecond: 999 })
  .toUTC()
  .toISO()

const row = {
  requires: [] as string[],
  renewalPrice: null as number | null,
}
const previewRows = [
  {
    ...row,
    featureCode: 'CFDI',
    name: 'Facturación CFDI',
    listPrice: 199,
    price: 159.2,
    status: 'OK',
  },
  {
    ...row,
    featureCode: 'AUTO_REORDER',
    name: 'Reorden automático',
    listPrice: 299,
    price: 239.2,
    status: 'OK',
    requires: ['INVENTORY_TRACKING'],
  },
  {
    ...row,
    featureCode: 'REFERRAL_PROGRAM',
    name: 'Programa de referidos',
    listPrice: null,
    price: null,
    status: 'NO_LIST',
  },
]

function show() {
  const onCreated = vi.fn()
  const user = userEvent.setup()
  renderWithProviders(<PercentPromotionForm onCreated={onCreated} />)
  return { user, onCreated }
}

async function choose(user: ReturnType<typeof userEvent.setup>, combobox: string, option: string) {
  await user.click(screen.getByRole('button', { name: combobox }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre del descuento'), 'Octubre 20 %')
  await user.type(screen.getByLabelText('Porcentaje de descuento'), '20')
  await user.click(screen.getByRole('button', { name: /Vigencia · Ciudad de México/ }))
  await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
  // The month on the left also draws the first days of the next one: the right calendar's cell is the last.
  for (const day of [next, next.set({ day: 28 })])
    await user.click(
      screen
        .getAllByRole('button', { name: day.toFormat('d MMMM yyyy', { locale: 'es' }) })
        .at(-1)!,
    )
  await user.click(screen.getByRole('button', { name: 'Aplicar' }))
  await user.type(screen.getByLabelText('Cupo por función'), '10')
}

/** Answers the preview with `rows` and records every body the form sends. */
function previewAnswers(rows: unknown[]) {
  const bodies: unknown[] = []
  server.use(
    http.post(`${PERCENT}/preview`, async ({ request }) => {
      bodies.push(await request.json())
      return HttpResponse.json({
        success: true,
        data: {
          rows,
          creatable:
            rows.some((r) => (r as { status: string }).status === 'OK') &&
            rows.every((r) => (r as { status: string }).status !== 'BELOW_MINIMUM'),
        },
      })
    }),
  )
  return bodies
}

describe('PercentPromotionForm', () => {
  it('a window that already ended is refused on the field, before any preview', async () => {
    const bodies = previewAnswers(previewRows)
    const { user } = show()
    const previous = DateTime.now().setZone('America/Mexico_City').minus({ months: 1 })
    await user.type(screen.getByLabelText('Nombre del descuento'), 'Octubre 20 %')
    await user.type(screen.getByLabelText('Porcentaje de descuento'), '20')
    await user.click(screen.getByRole('button', { name: /Vigencia · Ciudad de México/ }))
    // The left calendar opens on last month.
    for (const day of [previous.set({ day: 1 }), previous.set({ day: 2 })])
      await user.click(
        screen.getAllByRole('button', { name: day.toFormat('d MMMM yyyy', { locale: 'es' }) })[0],
      )
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await user.type(screen.getByLabelText('Cupo por función'), '10')
    expect(
      screen.getByText('La vigencia ya terminó: elige una fecha final futura.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar' })).toBeDisabled()
    expect(bodies).toEqual([])
  })

  it('asks for the name, the % (1–90), what it applies to, the dates, how long it lasts and the capacity per function', async () => {
    const { user } = show()
    expect(screen.getByLabelText('Porcentaje de descuento')).toHaveAttribute('min', '1')
    expect(screen.getByLabelText('Porcentaje de descuento')).toHaveAttribute('max', '90')
    expect(screen.getByRole('button', { name: /Vigencia · Ciudad de México/ })).toBeInTheDocument()
    expect(screen.getByText(/hasta 10 contrataciones de cada una/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'A qué aplica' }))
    for (const option of ['Todas las funciones con precio', 'Categorías', 'Funciones'])
      expect(await screen.findByRole('option', { name: option })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Categorías' }))
    expect(screen.getByRole('button', { name: /Categorías/ })).toBeInTheDocument()

    await choose(user, 'A qué aplica', 'Funciones')
    expect(await screen.findByLabelText('Buscar en todas las funcionalidades')).toBeInTheDocument()

    expect(screen.queryByLabelText('Meses con descuento')).toBeNull()
    await choose(user, 'Cuánto dura el descuento', 'Por N meses')
    expect(screen.getByLabelText('Meses con descuento')).toHaveAttribute('min', '1')
    expect(screen.getByLabelText('Meses con descuento')).toHaveAttribute('max', '24')
  })

  it('«Revisar» previews each function: list price, discounted price, the omitted, the ones under $10 and what they require', async () => {
    const bodies = previewAnswers([
      ...previewRows,
      {
        ...row,
        featureCode: 'CUSTOMER_CAMPAIGNS',
        name: 'Campañas a clientes',
        listPrice: 12,
        price: 9.6,
        status: 'BELOW_MINIMUM',
      },
    ])
    const { user } = show()
    await fill(user)
    await choose(user, 'A qué aplica', 'Categorías')
    await user.click(screen.getByRole('button', { name: /Categorías/ }))
    await user.click(await screen.findByRole('checkbox', { name: 'Inventario' }))
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await choose(user, 'Cuánto dura el descuento', 'Por N meses')
    await user.type(screen.getByLabelText('Meses con descuento'), '3')
    await user.click(screen.getByRole('button', { name: 'Revisar' }))

    await waitFor(() =>
      expect(bodies).toEqual([
        {
          name: 'Octubre 20 %',
          percentOff: 20,
          target: { kind: 'CATEGORIES', categories: ['inventory'] },
          startsAt,
          endsAt,
          promotionCycles: 3,
          capacityPerFeature: 10,
        },
      ]),
    )
    const table = await screen.findByRole('table', { name: 'Vista previa del descuento' })
    const cfdi = within(table).getByText('Facturación CFDI').closest('tr') as HTMLElement
    expect(within(cfdi).getByText('$199.00')).toBeInTheDocument()
    expect(within(cfdi).getByText('$159.20')).toBeInTheDocument()
    expect(within(table).getByText('Requiere Inventario FIFO')).toBeInTheDocument()
    expect(within(table).getByText('Sin precio de lista activo (se omite)')).toBeInTheDocument()
    expect(within(table).getByText('Queda bajo $10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear descuento' })).toBeDisabled()
  })

  it('warns per function of another active promotion whose window meets this one, without blocking it (spec §4.4)', async () => {
    previewAnswers([
      {
        ...previewRows[0],
        overlaps: [{ campaignId: 'c9', name: 'Septiembre 20 % · Facturación CFDI', price: 159.2 }],
      },
      { ...previewRows[1], overlaps: [] },
    ])
    const { user } = show()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Revisar' }))
    const table = await screen.findByRole('table', { name: 'Vista previa del descuento' })
    const cfdi = within(table).getByText('Facturación CFDI').closest('tr') as HTMLElement
    expect(
      within(cfdi).getByText(
        'Ya hay otra promoción activa: Septiembre 20 % · Facturación CFDI $159.20',
      ),
    ).toBeInTheDocument()
    const reorder = within(table).getByText('Reorden automático').closest('tr') as HTMLElement
    expect(within(reorder).queryByText(/Ya hay otra promoción activa/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Crear descuento' })).toBeEnabled()
  })

  it('creates the reviewed group once nothing is under $10, and hands back its id', async () => {
    previewAnswers(previewRows)
    const created: unknown[] = []
    server.use(
      http.post(PERCENT, async ({ request }) => {
        created.push(await request.json())
        return HttpResponse.json(
          { success: true, data: { groupId: 'group-1', campaignIds: ['c1', 'c2'] } },
          { status: 201 },
        )
      }),
    )
    const { user, onCreated } = show()
    await fill(user)
    expect(screen.getByRole('button', { name: 'Crear descuento' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Revisar' }))
    await screen.findByRole('table', { name: 'Vista previa del descuento' })
    await user.click(screen.getByRole('button', { name: 'Crear descuento' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('group-1'))
    expect(created).toEqual([
      {
        name: 'Octubre 20 %',
        percentOff: 20,
        target: { kind: 'ALL_FEATURES' },
        startsAt,
        endsAt,
        promotionCycles: null,
        capacityPerFeature: 10,
      },
    ])
  })

  it('a list that changed since the preview previews again instead of creating a different group', async () => {
    const bodies = previewAnswers(previewRows)
    server.use(
      http.post(PERCENT, () =>
        HttpResponse.json(
          {
            message: 'El precio de lista de una función cambió; vuelve a la vista previa.',
            code: 'HYBRID_PROMOTION_CHANGED',
          },
          { status: 409 },
        ),
      ),
    )
    const { user, onCreated } = show()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Revisar' }))
    await screen.findByRole('table', { name: 'Vista previa del descuento' })
    await user.click(screen.getByRole('button', { name: 'Crear descuento' }))

    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(toast.error).toHaveBeenCalledWith(
      'Un precio de lista cambió desde la vista previa',
      expect.objectContaining({ description: expect.stringMatching(/revísala/) }),
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  describe('only «Crear descuento» creates the group', () => {
    // 30 configurable functions: the picker pages them 25 + 5.
    const catalog = Array.from({ length: 30 }, (_, i) => ({
      id: `F${i + 1}`,
      featureCode: `F${i + 1}`,
      name: `Función ${i + 1}`,
      offering: 'CONFIGURABLE',
    }))
    async function reviewPickedFunction() {
      previewAnswers(previewRows)
      const created: unknown[] = []
      server.use(
        http.get(
          'http://localhost:3000/api/v1/superadmin/hybrid-campaigns/catalog',
          ({ request }) => {
            const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
            return HttpResponse.json({
              success: true,
              data: {
                items: catalog.slice((page - 1) * 25, page * 25),
                total: 30,
                page,
                pageSize: 25,
              },
            })
          },
        ),
        http.post(PERCENT, async ({ request }) => {
          created.push(await request.json())
          return HttpResponse.json(
            { success: true, data: { groupId: 'group-1', campaignIds: ['c1'] } },
            { status: 201 },
          )
        }),
      )
      const { user, onCreated } = show()
      await fill(user)
      await choose(user, 'A qué aplica', 'Funciones')
      await user.click(await screen.findByRole('button', { name: /^Funciones/ }))
      await user.click(await screen.findByRole('checkbox', { name: 'Función 1' }))
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))
      await user.click(screen.getByRole('button', { name: 'Revisar' }))
      await screen.findByRole('table', { name: 'Vista previa del descuento' })
      expect(screen.getByRole('button', { name: 'Crear descuento' })).toBeEnabled()
      return { user, onCreated, created }
    }

    it('paging the function picker after «Revisar» does not create it', async () => {
      const { user, onCreated, created } = await reviewPickedFunction()
      await user.click(screen.getByRole('button', { name: 'Siguiente' }))
      expect(await screen.findByText(/página 2 de 2/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Anterior' }))
      expect(await screen.findByText(/página 1 de 2/)).toBeInTheDocument()
      expect(created).toEqual([])
      expect(onCreated).not.toHaveBeenCalled()
    })

    it('Enter in the picker search or in a field does not create it', async () => {
      const { user, onCreated, created } = await reviewPickedFunction()
      await user.type(screen.getByLabelText('Buscar en todas las funcionalidades'), 'Fun{Enter}')
      await user.type(screen.getByLabelText('Cupo por función'), '{Enter}')
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(created).toEqual([])
      expect(onCreated).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Crear descuento' }))
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith('group-1'))
      expect(created).toHaveLength(1)
    })
  })

  it('editing after «Revisar» asks to review again before creating', async () => {
    previewAnswers(previewRows)
    const { user } = show()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Revisar' }))
    await screen.findByRole('table', { name: 'Vista previa del descuento' })
    expect(screen.getByRole('button', { name: 'Crear descuento' })).toBeEnabled()
    await user.type(screen.getByLabelText('Nombre del descuento'), ' bis')
    expect(screen.getByRole('button', { name: 'Crear descuento' })).toBeDisabled()
  })
})
