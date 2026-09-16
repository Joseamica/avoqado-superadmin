import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { MerchantDetailPage } from './MerchantDetailPage'

const baseURL = 'http://localhost:3000/api/v1'

// Raw shape as the backend returns it — api.ts maps _count → counts
const rawMerchant = {
  id: 'm1',
  provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
  externalMerchantId: '9814275',
  alias: null,
  displayName: 'Cuenta Principal',
  active: true,
  displayOrder: 0,
  clabeNumber: '0001',
  bankName: 'BBVA',
  accountHolder: 'José A.',
  hasCredentials: true,
  blumonSerialNumber: '2841548417',
  blumonPosId: '376',
  blumonEnvironment: 'SANDBOX',
  blumonMerchantId: null,
  angelpayAffiliation: null,
  angelpayMerchantName: null,
  angelpayUserAccount: null,
  aggregatorId: null,
  venues: [],
  terminals: [],
  _count: { costStructures: 1, venueConfigs: 0, terminals: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/merchant-accounts/m1`, () =>
    HttpResponse.json({ data: rawMerchant }),
  ),
  http.get(`${baseURL}/superadmin/cost-structures/active/m1`, () =>
    HttpResponse.json({
      data: {
        id: 'c1',
        debitRate: '0.015',
        creditRate: '0.025',
        amexRate: '0.035',
        internationalRate: '0.04',
        includesTax: true,
        taxRate: '0.16',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        active: true,
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, () =>
    HttpResponse.json({ data: null }),
  ),
  http.get(`${baseURL}/superadmin/settlement-configurations`, () =>
    HttpResponse.json({ data: [] }),
  ),
  http.get(`${baseURL}/superadmin/venue-pricing/configs-by-merchant/m1`, () =>
    HttpResponse.json({ data: [] }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MerchantDetailPage', () => {
  it('muestra cabecera, readiness y economía', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/merchants/:id" element={<MerchantDetailPage />} />
      </Routes>,
      { initialEntries: ['/merchants/m1'] },
    )

    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())

    // Identity card — "Credenciales" appears in ReadinessStrip chip AND in the dl field
    expect(screen.getAllByText('Credenciales').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('BBVA')).toBeInTheDocument()

    // MoneyFlow renders with cost data
    expect(screen.getByText('Flujo de dinero')).toBeInTheDocument()
  })

  it('lista terminales con badge heredada/asignada y pide confirmación al quitar una heredada', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts/m1`, () =>
        HttpResponse.json({
          data: {
            ...rawMerchant,
            terminals: [{ id: 't1', serialNumber: 'AVQD-1', inherited: true }],
            _count: { ...rawMerchant._count, terminals: 1 },
          },
        }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/merchants/:id" element={<MerchantDetailPage />} />
      </Routes>,
      { initialEntries: ['/merchants/m1'] },
    )

    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
    expect(screen.getByText('AVQD-1')).toBeInTheDocument()
    expect(screen.getByText('heredada')).toBeInTheDocument()

    // Quitar una heredada NO pega al API directo — abre confirmación primero
    await user.click(screen.getByRole('button', { name: 'Quitar terminal' }))
    expect(await screen.findByText('Quitar terminal heredada')).toBeInTheDocument()
  })

  it('el Asistente prellena el reparto que calculó (100%), no el guardado (50%)', async () => {
    server.use(
      // El merchant YA tiene un reparto 50% guardado — el bug era que el drawer se quedaba con ESE.
      http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, () =>
        HttpResponse.json({
          data: {
            id: 'rs1',
            aggregatorPrice: null,
            aggregatorPriceIncludesTax: false,
            avoqadoShareOfProviderMargin: '0.5',
            avoqadoShareOfAggregatorMargin: null,
            taxRate: '0.16',
            active: true,
          },
        }),
      ),
      // Un venue asignado para que el Asistente tenga destino.
      http.get(`${baseURL}/superadmin/venue-pricing/configs-by-merchant/m1`, () =>
        HttpResponse.json({
          data: [{ venue: { id: 'v1', name: 'Berthe', slug: 'berthe' }, secondaryAccountId: 'm1' }],
        }),
      ),
      http.get(`${baseURL}/superadmin/venue-pricing/structures/active/v1/SECONDARY`, () =>
        HttpResponse.json({ data: null }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/merchants/:id" element={<MerchantDetailPage />} />
      </Routes>,
      { initialEntries: ['/merchants/m1'] },
    )
    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Asistente' }))
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // paso 1 → 2
    await user.click(screen.getByRole('button', { name: /Costo \+ comisión/i }))
    await user.type(screen.getByLabelText(/Tu comisión/i), '3.5') // cost-plus, SIN socio → 100%
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // paso 2 → 3
    await user.click(screen.getByRole('button', { name: /Prellenar y revisar/i }))

    const shareInput = (await screen.findByLabelText(
      /Avoqado del margen proveedor/i,
    )) as HTMLInputElement
    expect(shareInput.value).toBe('100')
  })

  describe('Editar economía con la economía cargando DESPUÉS que la cuenta', () => {
    // Dato real de AMAENA T (prod, 2026-09-14): costo SIN IVA (0.67 %), precio al agregador
    // 0.70 % sin IVA, 50 % del margen proveedor y 0 % del margen agregador. La página se
    // pinta en cuanto llega el merchant; costo y revenue-share son queries aparte y llegan
    // después — el bug era que el drawer (montado desde el primer render) se quedaba con
    // la foto vacía: ceros, IVA marcado, 50/70.
    const ECO_DELAY_MS = 60
    function economiaTardia() {
      server.use(
        http.get(`${baseURL}/superadmin/cost-structures/active/m1`, async () => {
          await delay(ECO_DELAY_MS)
          return HttpResponse.json({
            data: {
              id: 'c1',
              debitRate: '0.0067',
              creditRate: '0.0067',
              amexRate: '0.028',
              internationalRate: '0.0325',
              includesTax: false,
              taxRate: '0.16',
              effectiveFrom: '2026-01-01T00:00:00.000Z',
              active: true,
            },
          })
        }),
        http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, async () => {
          await delay(ECO_DELAY_MS)
          return HttpResponse.json({
            data: {
              id: 'rs1',
              aggregatorPrice: {
                DEBIT: '0.007',
                CREDIT: '0.007',
                AMEX: '0.028',
                INTERNATIONAL: '0.0325',
              },
              aggregatorPriceIncludesTax: false,
              avoqadoShareOfProviderMargin: '0.5',
              // Decimal de Prisma: llega como string y el 0 es un 0 legítimo.
              avoqadoShareOfAggregatorMargin: '0.0000',
              taxRate: '0.16',
              active: true,
            },
          })
        }),
      )
    }

    const botonEditarEconomia = () =>
      within(document.getElementById('section-cost')!).getByRole('button', { name: 'Editar' })

    it('abre el formulario con lo GUARDADO (0.67, 0.70, 0 %, sin IVA), no con el borrador vacío', async () => {
      economiaTardia()
      const user = userEvent.setup()
      renderWithProviders(
        <Routes>
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
        </Routes>,
        { initialEntries: ['/merchants/m1'] },
      )
      await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
      // La página de fondo ya muestra la economía real (tramo proveedor→agregador).
      expect(await screen.findByText('Precio a agregador (Avoqado cobra)')).toBeInTheDocument()

      await user.click(botonEditarEconomia())
      expect(await screen.findByText('Editar economía')).toBeInTheDocument()

      const input = (id: string) => document.getElementById(id) as HTMLInputElement
      expect(input('cost-DEBIT').value).toBe('0.67')
      expect(screen.getByLabelText('Las tasas ya incluyen IVA')).not.toBeChecked()
      expect(screen.getByLabelText(/Vía agregador/)).toBeChecked()
      expect(input('agg-DEBIT').value).toBe('0.7')
      expect(screen.getByLabelText(/El precio al agregador ya incluye IVA/)).not.toBeChecked()
      expect(input('shp').value).toBe('50')
      // 0 % se pinta como campo vacío con placeholder "0" (PercentInput); nunca "70".
      expect(input('sha').value).toBe('')
      expect(input('sha').placeholder).toBe('0')
    })

    it('el botón Editar de Economía espera a que cargue la economía (no abre un formulario vacío)', async () => {
      economiaTardia()
      renderWithProviders(
        <Routes>
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
        </Routes>,
        { initialEntries: ['/merchants/m1'] },
      )
      await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
      // Merchant listo, economía todavía en vuelo → no se puede abrir el editor.
      expect(botonEditarEconomia()).toBeDisabled()
      expect(await screen.findByText('Precio a agregador (Avoqado cobra)')).toBeInTheDocument()
      await waitFor(() => expect(botonEditarEconomia()).toBeEnabled())
    })
  })

  describe('Asistente de pricing con el costo cargando DESPUÉS que la cuenta', () => {
    // Hermano del defecto de «Editar economía»: el Asistente se montaba desde el primer render
    // (con `cost = null`) y sembraba su paso 1 en ese momento → la PRIMERA apertura tras cargar
    // la página arrancaba con ceros e «IVA incluido» marcado aunque la página de fondo ya
    // mostrara el costo real. `reset()` sólo corría al cerrar, así que la segunda apertura sí
    // salía bien — por eso costaba verlo.
    const COSTO_DELAY_MS = 60
    function costoTardio() {
      server.use(
        http.get(`${baseURL}/superadmin/cost-structures/active/m1`, async () => {
          await delay(COSTO_DELAY_MS)
          return HttpResponse.json({
            data: {
              id: 'c1',
              debitRate: '0.0067',
              creditRate: '0.0067',
              amexRate: '0.028',
              internationalRate: '0.0325',
              includesTax: false,
              taxRate: '0.16',
              effectiveFrom: '2026-01-01T00:00:00.000Z',
              active: true,
            },
          })
        }),
      )
    }

    const botonAsistente = () => screen.getByRole('button', { name: 'Asistente' })

    it('el paso 1 arranca con el costo GUARDADO (0.67 %, sin IVA), no con ceros', async () => {
      costoTardio()
      const user = userEvent.setup()
      renderWithProviders(
        <Routes>
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
        </Routes>,
        { initialEntries: ['/merchants/m1'] },
      )
      await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
      // La página de fondo ya pinta la economía (sólo existe con el costo cargado).
      expect(await screen.findByText('Flujo de dinero')).toBeInTheDocument()
      await waitFor(() => expect(botonAsistente()).toBeEnabled())

      await user.click(botonAsistente())
      expect(await screen.findByText('Asistente de pricing')).toBeInTheDocument()

      const input = (id: string) => document.getElementById(id) as HTMLInputElement
      expect(input('wiz-cost-DEBIT').value).toBe('0.67')
      expect(input('wiz-cost-AMEX').value).toBe('2.8')
      expect(screen.getByLabelText('Estas tasas ya incluyen IVA')).not.toBeChecked()
    })

    it('el botón Asistente espera a que cargue la economía (no abre un paso 1 en ceros)', async () => {
      costoTardio()
      renderWithProviders(
        <Routes>
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
        </Routes>,
        { initialEntries: ['/merchants/m1'] },
      )
      await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
      // Merchant listo, costo todavía en vuelo → no se puede abrir el Asistente.
      expect(botonAsistente()).toBeDisabled()
      expect(await screen.findByText('Flujo de dinero')).toBeInTheDocument()
      await waitFor(() => expect(botonAsistente()).toBeEnabled())
    })
  })

  describe('Editar liquidación con la liquidación cargando DESPUÉS que la cuenta', () => {
    // Hermano del defecto de «Editar economía»: el drawer de Liquidación se montaba desde el
    // primer render (con `settlements = []`) y se quedaba con los defaults (D+1/1/3/3 hábiles,
    // corte 23:00) aunque la página ya listara los días reales — guardar desde ahí pisaba la
    // configuración de cuándo se le deposita al negocio. Valores distintos de los defaults en
    // todo, para que la prueba no pase por coincidencia.
    const LIQ_DELAY_MS = 60
    function liquidacionTardia() {
      server.use(
        http.get(`${baseURL}/superadmin/settlement-configurations`, async () => {
          await delay(LIQ_DELAY_MS)
          return HttpResponse.json({
            data: (
              [
                ['DEBIT', 2],
                ['CREDIT', 3],
                ['AMEX', 5],
                ['INTERNATIONAL', 7],
              ] as const
            ).map(([cardType, settlementDays], i) => ({
              id: `sg${i + 1}`,
              cardType,
              settlementDays,
              settlementDayType: 'CALENDAR_DAYS',
              cutoffTime: '22:30',
              cutoffTimezone: 'America/Mexico_City',
              effectiveFrom: '2026-01-01T00:00:00.000Z',
              effectiveTo: null,
            })),
          })
        }),
      )
    }

    const botonEditarLiquidacion = () =>
      within(document.getElementById('section-settlement')!).getByRole('button', {
        name: 'Editar',
      })

    it('abre el formulario con lo GUARDADO (2/3/5/7 naturales, corte 22:30), no con los defaults', async () => {
      liquidacionTardia()
      const user = userEvent.setup()
      renderWithProviders(
        <Routes>
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
        </Routes>,
        { initialEntries: ['/merchants/m1'] },
      )
      await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
      // La página de fondo ya lista los días reales.
      expect(await screen.findByText(/D\+5 naturales/)).toBeInTheDocument()

      await user.click(botonEditarLiquidacion())
      expect(await screen.findByText('Editar liquidación')).toBeInTheDocument()

      const dias = (card: string) =>
        (screen.getByLabelText(`Días ${card}`) as HTMLInputElement).value
      expect(dias('Débito')).toBe('2')
      expect(dias('Crédito')).toBe('3')
      expect(dias('AMEX')).toBe('5')
      expect(dias('Internacional')).toBe('7')
      expect(screen.getByRole('button', { name: 'Tipo de días Débito' })).toHaveTextContent(
        'Naturales',
      )
      expect((screen.getByLabelText('Corte') as HTMLInputElement).value).toBe('22:30')
    })

    it('el botón Editar de Liquidación espera a que cargue la liquidación', async () => {
      liquidacionTardia()
      renderWithProviders(
        <Routes>
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
        </Routes>,
        { initialEntries: ['/merchants/m1'] },
      )
      await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
      expect(botonEditarLiquidacion()).toBeDisabled()
      expect(await screen.findByText(/D\+5 naturales/)).toBeInTheDocument()
      await waitFor(() => expect(botonEditarLiquidacion()).toBeEnabled())
    })
  })
})
