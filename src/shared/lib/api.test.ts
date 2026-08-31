import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { api, esUn401DeSesion } from './api'

const baseURL = 'http://localhost:3000/api/v1'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('esUn401DeSesion', () => {
  it('un 401 de verify-apikey NO habla de la sesión — lo manda AngelPay', () => {
    expect(esUn401DeSesion('/superadmin/merchant-accounts/verify-apikey')).toBe(false)
  })

  it('cualquier otro 401 sí se trata como sesión muerta', () => {
    expect(esUn401DeSesion('/superadmin/merchant-accounts')).toBe(true)
    expect(esUn401DeSesion('/dashboard/auth/status')).toBe(true)
  })

  it('sin URL cierra sesión — no poder descartarlo es el lado seguro', () => {
    expect(esUn401DeSesion(undefined)).toBe(true)
    expect(esUn401DeSesion('')).toBe(true)
  })
})

describe('interceptor de 401', () => {
  /** Cuenta los `auth:unauthorized` que dispara una petición. */
  async function contarEventos(peticion: () => Promise<unknown>): Promise<number> {
    const spy = vi.fn()
    window.addEventListener('auth:unauthorized', spy)
    await peticion().catch(() => {})
    window.removeEventListener('auth:unauthorized', spy)
    return spy.mock.calls.length
  }

  it('una apiKey rechazada por AngelPay NO saca al operador de la consola', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/merchant-accounts/verify-apikey`, () =>
        HttpResponse.json({ error: 'apiKey inválida o de otro ambiente' }, { status: 401 }),
      ),
    )

    const n = await contarEventos(() =>
      api.post('/superadmin/merchant-accounts/verify-apikey', {
        apiKey: 'mala',
        environment: 'QA',
      }),
    )
    expect(n).toBe(0)
  })

  it('un 401 de verdad (sesión muerta) sí cierra la sesión', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    )

    const n = await contarEventos(() => api.get('/superadmin/merchant-accounts'))
    expect(n).toBe(1)
  })
})
