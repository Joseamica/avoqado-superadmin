import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Lock timezone for deterministic date tests — el helper `datetime.ts`
// usa America/Mexico_City como default; los tests pinean también esa zona.
process.env.TZ = 'America/Mexico_City'

// OJO: aquí NO se hace `server.listen()` global. Cada test file que necesite
// MSW arranca su propio `setupServer()` o llama `installGlobalServer()` de
// `src/test/mocks/server.ts`. Dos servers escuchando a la vez duplican el
// handler lookup por request (ruido "Body is unusable" en CI Linux).
afterEach(() => {
  cleanup()
})
