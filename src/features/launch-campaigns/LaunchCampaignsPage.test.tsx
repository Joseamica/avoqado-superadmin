import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { toast } from 'sonner'
import { LaunchCampaignsPage } from './LaunchCampaignsPage'
import type { LaunchCampaignRow } from './types'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const baseURL = 'http://localhost:3000/api/v1'
const BASE = `${baseURL}/superadmin/launch-campaigns`

/**
 * Las fechas de las fixtures son RELATIVAS al reloj real.
 *
 * 🔴 Con fechas fijas habría que congelar el reloj, y `vi.useFakeTimers()` pelea
 * con `userEvent` (que espera entre eventos) y con los temporizadores de MSW: el
 * resultado son pruebas que fallan por el arnés y no por el código. Lo que se
 * está probando aquí es que el estado depende del reloj, y eso se ejercita igual
 * de bien —y sin arnés frágil— colocando la vigencia alrededor de "ahora".
 */
const AHORA = Date.now()
const dias = (n: number) => new Date(AHORA + n * 86_400_000).toISOString()
const minutos = (n: number) => new Date(AHORA + n * 60_000).toISOString()

const campana: LaunchCampaignRow = {
  id: 'c1',
  code: 'POS22',
  name: 'Punto de venta a $22',
  landingSlug: 'pos-22',
  vertical: 'ALL',
  channel: 'GOOGLE_ADS',
  planTier: 'PRO',
  billingInterval: 'MONTHLY',
  advertisedPriceCents: 2200,
  discountMonths: 3,
  currency: 'MXN',
  offerVersion: 1,
  listPriceCentsSnapshot: 115884,
  discountAmountCents: 113684,
  stripePriceId: 'price_1',
  // Una ficha ACTIVE siempre congeló su cupón al activarse: con el cupón en null
  // el estado correcto es "Sin publicar", no "Activa" (hay prueba de eso).
  stripeCouponId: 'LC_POS22_V1',
  validFrom: dias(-10),
  validUntil: dias(30),
  redemptionCap: 100,
  redemptionCount: 12,
  headline: 'Tu punto de venta a $22 al mes',
  subheadline: null,
  bullets: [],
  status: 'ACTIVE',
  statusReason: null,
  activatedAt: dias(-10),
  createdById: 's1',
  updatedById: 's1',
  createdAt: dias(-12),
  updatedAt: dias(-10),
}

const preview = {
  listPriceCents: 115884,
  discountAmountCents: 113684,
  firstChargeCents: 2200,
  promoTotalCents: 6600,
  renewalMonthlyCents: 115884,
  promo: { subtotalCents: 1897, ivaCents: 303 },
  problems: [],
}

const server = setupServer(
  http.get(BASE, () =>
    HttpResponse.json({
      success: true,
      data: [campana],
      meta: { total: 1, page: 1, pageSize: 100 },
    }),
  ),
  http.post(`${BASE}/preview`, () => HttpResponse.json({ success: true, data: preview })),
)
// Un solo `listen` por archivo: dos servers escuchando a la vez duplican el
// handler lookup por request (ver el comentario de `src/test/setup.ts`).
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())
beforeEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LaunchCampaignsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LaunchCampaignsPage', () => {
  /**
   * 🔴 `DataTable` no tiene estado de carga: con `data=[]` pinta su vacío. Sin
   * esqueleto, la pantalla le afirma al operador "todavía no hay campañas"
   * mientras la lista está viajando — y con eso alguien crea una duplicada.
   */
  it('mientras carga muestra un esqueleto, NUNCA el vacío', async () => {
    server.use(
      http.get(BASE, async () => {
        await delay(60)
        return HttpResponse.json({
          success: true,
          data: [campana],
          meta: { total: 1, page: 1, pageSize: 100 },
        })
      }),
    )
    renderPage()
    expect(screen.getByRole('status', { name: 'Cargando campañas' })).toBeInTheDocument()
    expect(screen.queryByText('Todavía no hay campañas')).not.toBeInTheDocument()
    expect(await screen.findByText('POS22')).toBeInTheDocument()
  })

  it('lista la campaña con su oferta, su cupo y el badge del estado', async () => {
    renderPage()
    expect(await screen.findByText('POS22')).toBeInTheDocument()
    expect(screen.getByText('Punto de venta a $22')).toBeInTheDocument()
    expect(screen.getByText('$22.00 × 3 meses')).toBeInTheDocument()
    expect(screen.getByText('12 / 100')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
  })

  /**
   * 🔴 El badge no repite `status`: una ficha guardada como ACTIVE cuya vigencia
   * ya pasó NO se está ofreciendo, y decir "Activa" ahí deja al operador creyendo
   * que su anuncio vende. El estado que se pinta es el mismo que contesta el
   * endpoint público de la landing.
   */
  it('una ficha ACTIVE ya vencida se lee "Vencida", no "Activa"', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...campana, validUntil: dias(-1) }],
          meta: { total: 1, page: 1, pageSize: 100 },
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText('Vencida')).toBeInTheDocument()
    expect(screen.queryByText('Activa')).not.toBeInTheDocument()
  })

  it('una ficha ACTIVE sin lugares libres se lee "Llena"', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...campana, redemptionCount: 100 }],
          meta: { total: 1, page: 1, pageSize: 100 },
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText('Llena')).toBeInTheDocument()
    expect(screen.getByText('sin lugares')).toBeInTheDocument()
  })

  /**
   * 🔴 Activar crea un cupón en Stripe que va a cobrarle a gente real. La
   * confirmación tiene que decir QUÉ se va a crear y QUÉ se va a cobrar: un
   * "¿estás seguro?" pelón no informa de nada.
   */
  it('activar pide confirmación y enseña el id del cupón y el cobro exacto', async () => {
    const user = userEvent.setup()
    let activaciones = 0
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              ...campana,
              status: 'DRAFT',
              activatedAt: null,
              listPriceCentsSnapshot: null,
              // Un borrador todavía no tiene cupón: el id del diálogo se DERIVA
              // (`LC_<code>_V<version>`), que es lo que el servidor va a crear.
              stripeCouponId: null,
            },
          ],
          meta: { total: 1, page: 1, pageSize: 100 },
        }),
      ),
      http.post(`${BASE}/c1/activate`, () => {
        activaciones += 1
        return HttpResponse.json({
          success: true,
          data: { ...campana, status: 'ACTIVE', stripeCouponId: 'LC_POS22_V1' },
        })
      }),
    )
    renderPage()
    await screen.findByText('POS22')

    await user.click(screen.getByRole('button', { name: 'Acciones para POS22' }))
    await user.click(await screen.findByText('Activar'))

    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText('LC_POS22_V1')).toBeInTheDocument()
    expect(within(dialogo).getByText('$22.00')).toBeInTheDocument()
    expect(within(dialogo).getByText('3 meses')).toBeInTheDocument()
    // No se mandó nada por el solo hecho de abrir el diálogo.
    expect(activaciones).toBe(0)

    await user.click(within(dialogo).getByRole('button', { name: 'Activar campaña' }))
    await waitFor(() => expect(activaciones).toBe(1))
  })

  /**
   * El motivo queda en la bitácora y es lo único que explica, semanas después,
   * por qué la campaña dejó de vender. Sin él no se manda nada.
   */
  it('pausar sin motivo no se envía', async () => {
    const user = userEvent.setup()
    let pausas = 0
    server.use(
      http.post(`${BASE}/c1/pause`, () => {
        pausas += 1
        return HttpResponse.json({ success: true, data: { ...campana, status: 'PAUSED' } })
      }),
    )
    renderPage()
    await screen.findByText('POS22')

    await user.click(screen.getByRole('button', { name: 'Acciones para POS22' }))
    await user.click(await screen.findByText('Pausar'))

    const dialogo = await screen.findByRole('alertdialog')
    const confirmar = within(dialogo).getByRole('button', { name: 'Pausar campaña' })
    expect(confirmar).toBeDisabled()

    await user.click(confirmar)
    expect(pausas).toBe(0)

    await user.type(
      within(dialogo).getByLabelText('¿Por qué la pausas?'),
      'Se acabó el presupuesto',
    )
    expect(within(dialogo).getByRole('button', { name: 'Pausar campaña' })).toBeEnabled()
    await user.click(within(dialogo).getByRole('button', { name: 'Pausar campaña' }))
    await waitFor(() => expect(pausas).toBe(1))
  })

  it('terminar avisa de que es irreversible y también exige motivo', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('POS22')

    await user.click(screen.getByRole('button', { name: 'Acciones para POS22' }))
    await user.click(await screen.findByText('Terminar'))

    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText('Esto no se puede deshacer.')).toBeInTheDocument()
    expect(within(dialogo).getByText(/otra ficha con otro código/i)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Terminar campaña' })).toBeDisabled()
  })

  /**
   * 🔴 Un 409 `STALE` significa que otro operador guardó mientras éste editaba.
   * El mensaje del servidor dice QUÉ hacer; tragárselo dejaría a alguien creyendo
   * que guardó cuando no guardó.
   */
  it('un 409 del servidor se muestra con el mensaje del servidor, no con una frase genérica', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${BASE}/c1/pause`, () =>
        HttpResponse.json(
          {
            message: 'La campaña cambió mientras la editabas. Vuelve a cargarla.',
            code: 'LAUNCH_CAMPAIGN_STALE',
          },
          { status: 409 },
        ),
      ),
    )
    renderPage()
    await screen.findByText('POS22')

    await user.click(screen.getByRole('button', { name: 'Acciones para POS22' }))
    await user.click(await screen.findByText('Pausar'))
    const dialogo = await screen.findByRole('alertdialog')
    await user.type(within(dialogo).getByLabelText('¿Por qué la pausas?'), 'Motivo cualquiera')
    await user.click(within(dialogo).getByRole('button', { name: 'Pausar campaña' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    const [titulo, opciones] = vi.mocked(toast.error).mock.calls[0]
    expect(titulo).toBeTruthy()
    expect((opciones as { description?: string })?.description).toBe(
      'La campaña cambió mientras la editabas. Vuelve a cargarla.',
    )
  })

  it('una campaña terminada no ofrece editar', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...campana, status: 'ENDED' }],
          meta: { total: 1, page: 1, pageSize: 100 },
        }),
      ),
    )
    renderPage()
    await screen.findByText('Terminada')
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('si la lista falla, se explica y se puede reintentar', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ message: 'boom' }, { status: 500 })))
    renderPage()
    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })
})

describe('LaunchCampaignDetail (desde la lista)', () => {
  function redencion(i: number, reservedAt: string) {
    return {
      id: `r${i}`,
      status: 'RESERVED' as const,
      organization: { id: `o${i}`, name: `Negocio ${i}` },
      venue: null,
      advertisedPriceCents: 2200,
      discountMonths: 3,
      listPriceCents: 115884,
      offerVersion: 1,
      acquisitionSource: 'LANDING',
      utmSource: 'google',
      utmCampaign: 'pos22',
      reservedAt,
      appliedAt: null,
      releasedAt: null,
    }
  }

  /**
   * 🔴 «Cargar más» pide la página SIGUIENTE al servidor. Traerlas todas de un
   * jalón no es opción: una campaña llena son miles de filas.
   */
  it('las redenciones se piden paginadas y «Cargar más» pide la página 2', async () => {
    const user = userEvent.setup()
    const paginasPedidas: string[] = []
    server.use(
      http.get(`${BASE}/c1`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...campana,
            metrics: { claimed: 20, reserved: 2, applied: 10, released: 3, cap: 100, count: 12 },
            availability: { available: true },
          },
        }),
      ),
      http.get(`${BASE}/c1/redemptions`, ({ request }) => {
        const url = new URL(request.url)
        const page = url.searchParams.get('page') ?? '1'
        const status = url.searchParams.get('status')
        if (status === 'RESERVED') {
          return HttpResponse.json({
            success: true,
            data: [],
            meta: { total: 0, page: 1, pageSize: 100 },
          })
        }
        paginasPedidas.push(page)
        return HttpResponse.json({
          success: true,
          data: [redencion(Number(page), minutos(-5))],
          meta: { total: 2, page: Number(page), pageSize: 1 },
        })
      }),
    )

    renderPage()
    await user.click(await screen.findByText('POS22'))

    expect(await screen.findByText('Negocio 1')).toBeInTheDocument()
    expect(paginasPedidas).toEqual(['1'])

    await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    await waitFor(() => expect(paginasPedidas).toEqual(['1', '2']))
    expect(await screen.findByText('Negocio 2')).toBeInTheDocument()
  })

  /**
   * 🔴 La alerta de lugares estancados es lo ÚNICO que hace visible que el cupo
   * se está consumiendo con reservas muertas: el barrido que las liberaría no
   * existe en fase 1. Sin ella, la campaña se ve "llena" y nadie sabe por qué.
   */
  it('avisa de los lugares apartados hace más de 30 minutos', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${BASE}/c1`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...campana,
            metrics: { claimed: 20, reserved: 2, applied: 10, released: 3, cap: 100, count: 12 },
            availability: { available: true },
          },
        }),
      ),
      http.get(`${BASE}/c1/redemptions`, ({ request }) => {
        const url = new URL(request.url)
        const reservadas = url.searchParams.get('status') === 'RESERVED'
        const filas = reservadas
          ? [
              redencion(1, minutos(-120)), // 2 h
              redencion(2, minutos(-60)), // 1 h
              redencion(3, minutos(-2)), // en curso
            ]
          : []
        return HttpResponse.json({
          success: true,
          data: filas,
          meta: { total: filas.length, page: 1, pageSize: 100 },
        })
      }),
    )

    renderPage()
    await user.click(await screen.findByText('POS22'))

    expect(await screen.findByText('2 lugares apartados hace más de 30 min')).toBeInTheDocument()
  })

  /**
   * 🔴 El número que manda es el del SERVIDOR, no el que esta pantalla pueda
   * recontar.
   *
   * El servidor cuenta los apartados rancios con un `count` sobre TODAS las filas
   * (`staleReserved`, `launchCampaign.service.ts`). La pantalla sólo tiene la
   * primera página de apartados —100 filas, ordenadas por `reservedAt` DESC, o
   * sea las MÁS NUEVAS—, así que en una campaña con más de 100 apartados los
   * rancios quedan en la página 2 y el recuento local da 0. Y 0 no pinta una
   * alerta más chica: no pinta NINGUNA. La campaña se ve llena, el anuncio se
   * sigue pagando y el motivo es justo el que esta alerta existe para enseñar.
   */
  it('usa el conteo de apartados rancios del servidor aunque la página cargada no traiga ninguno', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${BASE}/c1`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...campana,
            metrics: {
              claimed: 20,
              reserved: 140,
              applied: 10,
              released: 3,
              cap: 200,
              count: 150,
              staleReserved: 5,
              staleReservedMinutes: 30,
            },
            availability: { available: true },
          },
        }),
      ),
      http.get(`${BASE}/c1/redemptions`, ({ request }) => {
        const url = new URL(request.url)
        const reservadas = url.searchParams.get('status') === 'RESERVED'
        // La página que llega son las 100 más NUEVAS: ninguna pasa de 30 min.
        const filas = reservadas ? [redencion(1, minutos(-2)), redencion(2, minutos(-1))] : []
        return HttpResponse.json({
          success: true,
          data: filas,
          meta: { total: 140, page: 1, pageSize: 100 },
        })
      }),
    )

    renderPage()
    await user.click(await screen.findByText('POS22'))

    expect(await screen.findByText('5 lugares apartados hace más de 30 min')).toBeInTheDocument()
    // Y sin "Al menos": el servidor los contó TODOS, no es una cota inferior.
    expect(screen.queryByText(/Al menos/)).not.toBeInTheDocument()
  })
})

/**
 * La vitrina, VISIBLE en la lista (relevo 2026-09-24): su único riesgo es que nadie marque ninguna y
 * /restaurants se quede sin precio — y eso sólo se ve si está a la vista. La línea de arriba lee el
 * MISMO endpoint público que la landing, así que dice lo que la página enseña de verdad.
 */
describe('LaunchCampaignsPage — vitrina', () => {
  const VITRINA = 'http://localhost:3000/api/v1/public/launch-offers/featured/FOOD_SERVICE'

  it('marca en la lista la campaña que ocupa la vitrina de su giro', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...campana, vertical: 'FOOD_SERVICE', featuredForVertical: true }],
          meta: { total: 1, page: 1, pageSize: 100 },
        }),
      ),
      http.get(VITRINA, () =>
        HttpResponse.json({ success: true, data: { code: campana.code, available: true, firstChargeCents: 2200 } }),
      ),
    )
    renderPage()
    expect(await screen.findByText('Vitrina')).toBeInTheDocument()
    expect(await screen.findByText(/avoqado\.io\/restaurants muestra/i)).toHaveTextContent(campana.code)
  })

  it('🔴 sin campaña en la vitrina lo AVISA: la página de restaurantes está sin precio', async () => {
    server.use(http.get(VITRINA, () => HttpResponse.json({ code: 'LAUNCH_OFFER_NOT_FOUND' }, { status: 404 })))
    renderPage()
    expect(await screen.findByText(/sin precio/i)).toBeInTheDocument()
  })

  it('🔴 marcada pero pausada tampoco vende, y también lo dice', async () => {
    server.use(
      http.get(VITRINA, () =>
        HttpResponse.json({ success: true, data: { code: 'REST22', available: false, unavailableReason: 'PAUSED' } }),
      ),
    )
    renderPage()
    expect(await screen.findByText(/sin precio/i)).toHaveTextContent('REST22')
  })
})
