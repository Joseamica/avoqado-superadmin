import { afterAll, afterEach, beforeAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

// Registra el ciclo de vida del server global (listen/reset/close) en el test
// file que la llame. `setup.ts` NO hace listen global a propósito: dos servers
// MSW escuchando a la vez (el global + el `setupServer()` propio del file)
// hacen que cada request se evalúe dos veces contra los handlers; en Linux esa
// doble evaluación pierde la race y llena el log de "TypeError: Body is
// unusable" (el ruido que veíamos en CI). Cada test file usa O el server
// global (llamando esto en top-level) O uno propio — nunca ambos.
export function installGlobalServer() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}
