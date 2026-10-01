import { http, HttpResponse } from 'msw'

const baseURL = 'http://localhost:3000/api/v1'

const superadminUser = {
  id: 'usr_superadmin',
  firstName: 'José',
  lastName: 'Amieva',
  email: 'jose@avoqado.io',
  photoUrl: null,
  venues: [
    {
      id: 'venue_dummy',
      name: 'Avoqado HQ',
      slug: 'avoqado-hq',
      logo: null,
      role: 'SUPERADMIN',
      timezone: 'America/Mexico_City',
    },
  ],
}

const pricingRow = {
  featureCode: null,
  planTier: null,
  minimumTier: 'PRO',
  editable: false,
  notEditableReason: null,
  campaignId: null,
  revision: null,
  status: null,
  price: null,
  pendingPrice: null,
  activeGroups: [] as { id: string; name: string; revision: number }[],
}

/** «Precios» board (`GET /superadmin/hybrid-pricing`): both plans, an editable function, a system one and a pending price. */
export const pricingBoard = [
  {
    ...pricingRow,
    productKey: 'PLAN:PRO',
    planTier: 'PRO',
    name: 'Pro',
    category: 'plan',
    notEditableReason: 'PLAN_PHASE_2',
    campaignId: 'list-pro',
    revision: 2,
    status: 'ACTIVE',
    price: 699,
  },
  {
    ...pricingRow,
    productKey: 'PLAN:PREMIUM',
    planTier: 'PREMIUM',
    name: 'Premium',
    category: 'plan',
    minimumTier: 'PREMIUM',
    notEditableReason: 'PLAN_PHASE_2',
  },
  {
    ...pricingRow,
    productKey: 'FEATURE:CFDI',
    featureCode: 'CFDI',
    name: 'Facturación CFDI',
    category: 'money',
    minimumTier: 'PREMIUM',
    editable: true,
    campaignId: 'list-cfdi',
    revision: 3,
    status: 'ACTIVE',
    price: 199,
  },
  {
    ...pricingRow,
    productKey: 'FEATURE:BASE_POS',
    name: 'Cobra con tarjeta (TPV)',
    category: 'sell',
    minimumTier: 'FREE',
    notEditableReason: 'SYSTEM',
  },
  {
    ...pricingRow,
    productKey: 'FEATURE:INVENTORY_TRACKING',
    featureCode: 'INVENTORY_TRACKING',
    name: 'Inventario FIFO',
    category: 'inventory',
    minimumTier: 'PREMIUM',
    editable: true,
    campaignId: 'list-inventory',
    revision: 1,
    pendingPrice: 249,
  },
]

export const pricingGaps = [
  {
    productKey: 'FEATURE:CFDI',
    venues: 3,
    monthlyGap: '300.00',
    aboveListVenues: 1,
    bundleVenues: 2,
  },
]

export const handlers = [
  http.get(`${baseURL}/dashboard/auth/status`, () =>
    HttpResponse.json({ authenticated: false, user: null }),
  ),

  http.post(`${baseURL}/dashboard/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (body?.email === 'jose@avoqado.io' && body?.password === 'correcto123') {
      return HttpResponse.json({ message: 'ok', staff: superadminUser })
    }
    return HttpResponse.json({ message: 'Credenciales inválidas' }, { status: 401 })
  }),

  http.post(`${baseURL}/dashboard/auth/logout`, () => HttpResponse.json({ message: 'ok' })),

  http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
    HttpResponse.json({ success: true, data: [], count: 0 }),
  ),
  http.get(`${baseURL}/superadmin/payment-providers`, () => HttpResponse.json({ data: [] })),

  http.get(`${baseURL}/superadmin/hybrid-pricing`, () =>
    HttpResponse.json({ success: true, data: pricingBoard }),
  ),
  http.get(`${baseURL}/superadmin/hybrid-pricing/gaps`, () =>
    HttpResponse.json({ success: true, data: pricingGaps }),
  ),
  http.get(`${baseURL}/superadmin/hybrid-pricing/gaps/:productKey`, () =>
    HttpResponse.json({ success: true, data: { items: [], total: 0 } }),
  ),
  // «Descuentos %» and «Campañas» of /hybrid-campaigns: empty pages until a test answers them.
  http.get(`${baseURL}/superadmin/hybrid-pricing/percent`, () =>
    HttpResponse.json({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 },
    }),
  ),
  http.get(`${baseURL}/superadmin/hybrid-campaigns`, () =>
    HttpResponse.json({ success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }),
  ),
  // The configurable functions the «Funciones» picker offers.
  http.get(`${baseURL}/superadmin/hybrid-campaigns/catalog`, () =>
    HttpResponse.json({
      success: true,
      data: {
        items: [
          { id: 'CFDI', featureCode: 'CFDI', name: 'Facturación CFDI', offering: 'CONFIGURABLE' },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
      },
    }),
  ),
]
