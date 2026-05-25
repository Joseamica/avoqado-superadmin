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
]
