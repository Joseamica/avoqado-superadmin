import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

// Lock timezone for deterministic date tests — el helper `datetime.ts`
// usa America/Mexico_City como default; los tests pinean también esa zona.
process.env.TZ = 'America/Mexico_City'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
