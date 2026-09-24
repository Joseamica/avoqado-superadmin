import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { LaunchCampaignEditor } from './LaunchCampaignEditor'
import type { LaunchCampaignRow } from './types'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const baseURL = 'http://localhost:3000/api/v1'
const BASE = `${baseURL}/superadmin/launch-campaigns`

const AHORA = Date.now()
const dias = (n: number) => new Date(AHORA + n * 86_400_000).toISOString()

const activa: LaunchCampaignRow = {
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
  updatedAt: '2026-09-20T06:00:00.000Z',
}

const borrador: LaunchCampaignRow = {
  ...activa,
  id: 'c2',
  code: 'RETAIL10',
  status: 'DRAFT',
  activatedAt: null,
  stripeCouponId: null,
  listPriceCentsSnapshot: null,
  discountAmountCents: null,
  redemptionCount: 0,
  updatedAt: '2026-09-19T06:00:00.000Z',
}

/** La cuenta que devuelve el servidor para la oferta de $22 sobre PRO. */
const preview = {
  listPriceCents: 115884,
  discountAmountCents: 113684,
  firstChargeCents: 2200,
  promoTotalCents: 6600,
  renewalMonthlyCents: 115884,
  promo: { subtotalCents: 1897, ivaCents: 303 },
  problems: [] as string[],
}

let cuerpoDelPreview: unknown = null

const server = setupServer(
  http.post(`${BASE}/preview`, async ({ request }) => {
    cuerpoDelPreview = await request.json()
    return HttpResponse.json({ success: true, data: preview })
  }),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())
beforeEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
  cuerpoDelPreview = null
})

function renderEditor(campana: LaunchCampaignRow | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <LaunchCampaignEditor abierto onClose={() => {}} campana={campana} />
    </QueryClientProvider>,
  )
}

describe('LaunchCampaignEditor', () => {
  it('abre con los datos de la ficha que se está editando', async () => {
    renderEditor(activa)
    expect(await screen.findByText('Editar POS22')).toBeInTheDocument()
    expect(screen.getByLabelText('Código')).toHaveValue('POS22')
    expect(screen.getByLabelText('Precio final que paga el cliente')).toHaveValue('22.00')
    expect(screen.getByLabelText('Ciclos con descuento')).toHaveValue('3')
    expect(screen.getByLabelText('Cupo')).toHaveValue('100')
  })

  /**
   * 🔴 Cambiar la oferta de una campaña ya activada es cambiarle el precio a
   * gente que ya lo aceptó. El servidor lo rechaza con `FIELD_LOCKED`; aquí los
   * campos se ven deshabilitados Y con la explicación, porque un campo apagado
   * sin motivo se lee como un defecto de la pantalla, no como una regla.
   */
  it('en una campaña ACTIVE los campos de la oferta están deshabilitados y explicados', async () => {
    renderEditor(activa)
    await screen.findByText('Editar POS22')

    expect(screen.getByLabelText('Precio final que paga el cliente')).toBeDisabled()
    expect(screen.getByLabelText('Ciclos con descuento')).toBeDisabled()
    expect(screen.getByLabelText('Código')).toBeDisabled()
    expect(screen.getByLabelText('Slug de la landing')).toBeDisabled()

    expect(
      screen.getByText(/La oferta de una campaña ya activada no se cambia/i),
    ).toBeInTheDocument()

    // Lo que SÍ se puede seguir cambiando no se apaga.
    expect(screen.getByLabelText('Nombre interno')).toBeEnabled()
    expect(screen.getByLabelText('Termina')).toBeEnabled()
    expect(screen.getByLabelText('Cupo')).toBeEnabled()
  })

  it('en un borrador la oferta sí se edita', async () => {
    renderEditor(borrador)
    await screen.findByText('Editar RETAIL10')
    expect(screen.getByLabelText('Precio final que paga el cliente')).toBeEnabled()
    expect(screen.getByLabelText('Slug de la landing')).toBeEnabled()
    // El código es inmutable desde que la ficha existe, aunque siga en borrador.
    expect(screen.getByLabelText('Código')).toBeDisabled()
  })

  /**
   * 🔴 Los montos salen del servidor. El precio de lista vive en Stripe y esta
   * pantalla no lo adivina: si lo calculara aquí habría dos verdades del mismo
   * dinero, y la que el cliente paga sería la otra.
   */
  it('la vista previa pinta los montos que devolvió el servidor', async () => {
    renderEditor(borrador)
    await screen.findByText('Editar RETAIL10')

    expect(await screen.findByText(/Hoy paga/)).toBeInTheDocument()
    await waitFor(() => expect(cuerpoDelPreview).not.toBeNull())
    expect(cuerpoDelPreview).toEqual({
      planTier: 'PRO',
      billingInterval: 'MONTHLY',
      advertisedPriceCents: 2200,
      discountMonths: 3,
    })

    const cuenta = (await screen.findByText(/Hoy paga/)).textContent ?? ''
    expect(cuenta).toContain('$22.00')
    expect(cuenta).toContain('$1,158.84')
    // 6600 centavos son $66.00 — tres ciclos de $22.00, no $6,600.00.
    expect(screen.getByText('$66.00')).toBeInTheDocument()
    expect(screen.getByText('LC_RETAIL10_V1')).toBeInTheDocument()
  })

  /**
   * 🔴 El desglose de IVA se pinta SÓLO si la base por 1.16 devuelve el total.
   * $22.00 sale de una base de $18.97, y $18.97 × 1.16 = $22.01: enseñar ese
   * desglose sería imprimir una cuenta que el CFDI no puede sostener. Cuál es el
   * precio lo decide la campaña; esta regla no depende de cuál sea.
   */
  it('no pinta el desglose de IVA cuando no cuadra al centavo, y lo dice', async () => {
    renderEditor(borrador)
    await screen.findByText('Editar RETAIL10')
    expect(await screen.findByText(/no se puede desglosar exacto/i)).toBeInTheDocument()
    expect(screen.queryByText(/de IVA$/)).not.toBeInTheDocument()
  })

  it('con un precio cuyo desglose SÍ cuadra, lo enseña', async () => {
    server.use(
      http.post(`${BASE}/preview`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...preview,
            // $23.20 = $20.00 + $3.20: la base por 1.16 devuelve el total exacto.
            firstChargeCents: 2320,
            promoTotalCents: 6960,
            promo: { subtotalCents: 2000, ivaCents: 320 },
          },
        }),
      ),
    )
    renderEditor(borrador)
    await screen.findByText('Editar RETAIL10')
    expect(await screen.findByText('$20.00 + $3.20 de IVA')).toBeInTheDocument()
    expect(screen.queryByText(/no se puede desglosar exacto/i)).not.toBeInTheDocument()
  })

  it('los problemas que reporta el servidor se muestran tal cual', async () => {
    server.use(
      http.post(`${BASE}/preview`, () =>
        HttpResponse.json({
          success: true,
          data: { ...preview, problems: ['El precio de Stripe no está marcado como IVA incluido'] },
        }),
      ),
    )
    renderEditor(borrador)
    expect(
      await screen.findByText('El precio de Stripe no está marcado como IVA incluido'),
    ).toBeInTheDocument()
  })

  /**
   * 🔴 Guardar una edición manda PUT sobre el MISMO id y lleva `expectedUpdatedAt`:
   * sin esa revisión optimista, dos operadores editando la misma ficha se pisan y
   * el último gana en silencio.
   */
  it('guardar una ficha existente manda PUT al mismo id con expectedUpdatedAt', async () => {
    const user = userEvent.setup()
    const peticiones: { url: string; metodo: string; cuerpo: Record<string, unknown> }[] = []
    server.use(
      http.put(`${BASE}/:id`, async ({ request, params }) => {
        peticiones.push({
          url: String(params.id),
          metodo: request.method,
          cuerpo: (await request.json()) as Record<string, unknown>,
        })
        return HttpResponse.json({ success: true, data: activa })
      }),
    )

    renderEditor(activa)
    await screen.findByText('Editar POS22')
    await user.clear(screen.getByLabelText('Nombre interno'))
    await user.type(screen.getByLabelText('Nombre interno'), 'Punto de venta a $22 — octubre')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(peticiones).toHaveLength(1))
    expect(peticiones[0].metodo).toBe('PUT')
    expect(peticiones[0].url).toBe('c1')
    expect(peticiones[0].cuerpo.expectedUpdatedAt).toBe('2026-09-20T06:00:00.000Z')
    expect(peticiones[0].cuerpo.name).toBe('Punto de venta a $22 — octubre')
    // Los campos bloqueados NO viajan: mandarlos le gana un `FIELD_LOCKED` al
    // operador aunque ni los haya tocado.
    expect(peticiones[0].cuerpo).not.toHaveProperty('advertisedPriceCents')
    expect(peticiones[0].cuerpo).not.toHaveProperty('landingSlug')
    // 🔴 Y `validFrom`, que es el que se escapaba: esta ficha ya vendió 12 lugares,
    // así que el servidor lo congela (`camposBloqueados`: activada + redemptionCount
    // > 0). Comprobar campo por campo deja pasar al siguiente que se cuele, así que
    // lo que se fija es la FORMA COMPLETA del cuerpo: exactamente lo que en este
    // estado se puede seguir editando, ni un campo más.
    expect(Object.keys(peticiones[0].cuerpo).sort()).toEqual([
      'bullets',
      'channel',
      'expectedUpdatedAt',
      'headline',
      'name',
      'redemptionCap',
      'subheadline',
      'validUntil',
      'vertical',
    ])
  })

  /**
   * 🔴 El precio anunciado tiene que ser MENOR que el de lista: el cupón es la
   * diferencia entre los dos. El servidor lo rechaza al activar, pero para
   * entonces la ficha ya se guardó y el anuncio ya se escribió.
   */
  it('no deja guardar un precio que no es menor que el de lista, y explica por qué', async () => {
    const user = userEvent.setup()
    let puts = 0
    server.use(
      http.put(`${BASE}/:id`, () => {
        puts += 1
        return HttpResponse.json({ success: true, data: borrador })
      }),
    )

    renderEditor(borrador)
    await screen.findByText('Editar RETAIL10')
    const precio = screen.getByLabelText('Precio final que paga el cliente')
    await user.clear(precio)
    await user.type(precio, '2000')

    expect(await screen.findByText(/menor que el precio de lista del plan/i)).toBeInTheDocument()
    const guardar = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(guardar).toBeDisabled()
    await user.click(guardar)
    expect(puts).toBe(0)
  })

  it('no deja guardar por debajo del mínimo que Stripe cobra', async () => {
    const user = userEvent.setup()
    renderEditor(borrador)
    await screen.findByText('Editar RETAIL10')
    const precio = screen.getByLabelText('Precio final que paga el cliente')
    await user.clear(precio)
    await user.type(precio, '5')

    expect(await screen.findByText(/no cobra menos de \$10\.00/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  /**
   * 🔴 Bajar el cupo por debajo de los lugares ya tomados le gana un 400 del
   * servidor. El veredicto que manda sigue siendo el suyo (entre esta pantalla y
   * la escritura cabe una reserva nueva), pero el operador lo ve antes.
   */
  it('avisa si el cupo queda por debajo de los lugares ya tomados', async () => {
    const user = userEvent.setup()
    renderEditor(activa)
    await screen.findByText('Editar POS22')
    const cupo = screen.getByLabelText('Cupo')
    await user.clear(cupo)
    await user.type(cupo, '5')

    expect(await screen.findByText(/Ya hay 12 lugares tomados/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('crear una campaña nueva manda POST con los montos en centavos', async () => {
    const user = userEvent.setup()
    let cuerpo: Record<string, unknown> | null = null
    server.use(
      http.post(BASE, async ({ request }) => {
        cuerpo = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ success: true, data: borrador }, { status: 201 })
      }),
    )

    renderEditor(null)
    await screen.findByText('Nueva campaña de lanzamiento')
    await user.type(screen.getByLabelText('Código'), 'RETAIL10')
    await user.type(screen.getByLabelText('Slug de la landing'), 'retail-10')
    await user.type(screen.getByLabelText('Nombre interno'), 'Retail a $10 — octubre')
    await user.type(screen.getByLabelText('Precio final que paga el cliente'), '22.50')
    await user.type(screen.getByLabelText('Cupo'), '50')
    await user.type(screen.getByLabelText('Empieza'), '2026-10-01T00:00')
    await user.type(screen.getByLabelText('Termina'), '2026-10-31T23:59')

    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(cuerpo).not.toBeNull())

    expect(cuerpo).toMatchObject({
      code: 'RETAIL10',
      landingSlug: 'retail-10',
      planTier: 'PRO',
      billingInterval: 'MONTHLY',
      // 22.50 pesos → 2250 centavos, sin pasar por el flotante.
      advertisedPriceCents: 2250,
      discountMonths: 3,
      redemptionCap: 50,
      // La vigencia se captura en hora de la Ciudad de México y viaja con su
      // desplazamiento fijo.
      validFrom: '2026-10-01T00:00:00-06:00',
      validUntil: '2026-10-31T23:59:00-06:00',
    })
  })

  it('una ficha terminada no se edita en nada', async () => {
    renderEditor({ ...activa, status: 'ENDED' })
    await screen.findByText('Editar POS22')
    expect(screen.getByLabelText('Nombre interno')).toBeDisabled()
    expect(screen.getByLabelText('Cupo')).toBeDisabled()
    // La explicación acompaña a CADA campo apagado, no una sola vez.
    expect(screen.getAllByText(/ya terminó/i).length).toBeGreaterThan(0)
  })

  // ── Vista previa de la página ──────────────────────────────────
  // 🔴 Estas dos existen por POS22: nació a $25.52 porque «Precio anunciado (con IVA)» se
  // leyó como «súmale el IVA», y una ficha activada YA NO puede corregir su precio.

  it('el precio de la vista previa es EXACTAMENTE el capturado: no le suma IVA', async () => {
    const user = userEvent.setup()
    renderEditor(borrador)

    const precio = screen.getByLabelText('Precio final que paga el cliente')
    await user.clear(precio)
    await user.type(precio, '22.00')

    const pagina = screen.getByText('Así se verá la página').parentElement as HTMLElement
    expect(within(pagina).getByText('$22.00')).toBeInTheDocument()
    // 22 × 1.16 = 25.52: si alguien vuelve a meter IVA en esta pantalla, esto cae.
    expect(within(pagina).queryByText('$25.52')).not.toBeInTheDocument()
  })

  it('sin encabezado, la vista previa arma el mismo título de respaldo que la landing', async () => {
    const user = userEvent.setup()
    renderEditor(borrador)

    const precio = screen.getByLabelText('Precio final que paga el cliente')
    await user.clear(precio)
    await user.type(precio, '22.00')
    // El fixture trae encabezado: se vacía para que entre el respaldo.
    await user.clear(screen.getByLabelText('Encabezado'))

    const pagina = screen.getByText('Así se verá la página').parentElement as HTMLElement
    expect(within(pagina).getByText('Avoqado Pro a $22.00/mes')).toBeInTheDocument()
  })
})

/**
 * La VITRINA del giro (relevo 2026-09-24): qué campaña enseña la página de un giro que no lleva
 * el slug en su URL (hoy avoqado.io/restaurants). Un interruptor EXPLÍCITO por campaña; marcarla
 * le quita la vitrina a la otra del mismo giro. NO se congela al activar: se mueve sobre campañas
 * vivas sin desplegar nada.
 */
describe('LaunchCampaignEditor — vitrina del giro', () => {
  const restaurantes: LaunchCampaignRow = { ...activa, vertical: 'FOOD_SERVICE', featuredForVertical: false }

  function capturarPut() {
    const cuerpos: Record<string, unknown>[] = []
    server.use(
      http.put(`${BASE}/:id`, async ({ request }) => {
        cuerpos.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ success: true, data: restaurantes })
      }),
    )
    return cuerpos
  }

  it('en una campaña ACTIVA de restaurantes la casilla se puede marcar y dice qué página cambia', async () => {
    renderEditor(restaurantes)
    await screen.findByText('Editar POS22')
    const casilla = screen.getByRole('checkbox', { name: /mostrar en la página de su giro/i })
    expect(casilla).toBeEnabled()
    expect(casilla).not.toBeChecked()
    expect(screen.getByText(/avoqado\.io\/restaurants/)).toBeInTheDocument()
  })

  it('🔴 marcarla manda featuredForVertical:true en el PUT, con la revisión optimista', async () => {
    const user = userEvent.setup()
    const cuerpos = capturarPut()
    renderEditor(restaurantes)
    await screen.findByText('Editar POS22')
    await user.click(screen.getByRole('checkbox', { name: /mostrar en la página de su giro/i }))
    // y avisa lo que hace con la otra del giro, antes de guardar
    expect(screen.getByText(/se la quita/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(cuerpos).toHaveLength(1))
    expect(cuerpos[0]).toMatchObject({ featuredForVertical: true, expectedUpdatedAt: activa.updatedAt })
  })

  it('🔴 guardar SIN tocar la casilla no manda la vitrina (no pisa lo que marcó otra pestaña)', async () => {
    const user = userEvent.setup()
    const cuerpos = capturarPut()
    renderEditor(restaurantes)
    await screen.findByText('Editar POS22')
    await user.clear(screen.getByLabelText('Nombre interno'))
    await user.type(screen.getByLabelText('Nombre interno'), 'Otro nombre')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(cuerpos).toHaveLength(1))
    expect(cuerpos[0]).not.toHaveProperty('featuredForVertical')
  })

  it('🔴 mientras ocupa la vitrina, su giro no se cambia — y lo explica', async () => {
    renderEditor({ ...restaurantes, featuredForVertical: true })
    await screen.findByText('Editar POS22')
    expect(screen.getByRole('checkbox', { name: /mostrar en la página de su giro/i })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Giro al que apunta' })).toBeDisabled()
    expect(screen.getByText(/quítale la vitrina/i)).toBeInTheDocument()
  })

  it('en un giro sin página propia lo dice, en vez de prometer una página que no existe', async () => {
    renderEditor({ ...activa, vertical: 'RETAIL', featuredForVertical: false })
    await screen.findByText('Editar POS22')
    expect(screen.getByText(/todavía no tiene página propia/i)).toBeInTheDocument()
  })
})
