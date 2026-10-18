import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { renderWithProviders } from '@/test/render'
import { DocumentRequestPicker } from './DocumentRequestPicker'
import type { DocumentRequest } from '@/shared/lib/venue-document-requests'

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView = () => {}

const base = 'http://localhost:3000/api/v1/superadmin/document-requests'
const request = {
  id: 'cjld2cjxh0000qzrmn831i7rn',
  businessName: 'Estudio Norte',
  contactName: 'Ana',
  email: 'ana@norte.mx',
  phone: '5512345678',
  provider: 'BLUMON',
  entityType: 'PERSONA_FISICA',
  submissionVersion: 3,
  status: 'SUBMITTED',
} as DocumentRequest
const server = setupServer(
  http.get(base, () => HttpResponse.json({ items: [request], total: 11, page: 1, pageSize: 10 })),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
function Picker() {
  const [value, setValue] = useState<DocumentRequest | null>(null)
  return <DocumentRequestPicker value={value} onChange={setValue} />
}
describe('DocumentRequestPicker', () => {
  it('selecciona versión y muestra negocio, contacto, proveedor y tipo; permite quitar', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Picker />)
    await user.click(screen.getByRole('button', { name: 'Expediente recibido' }))
    await user.click(await screen.findByRole('option', { name: /Estudio Norte/ }))
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
    expect(screen.getByText(/Blumon/)).toBeInTheDocument()
    expect(screen.getByText(/Persona física/)).toBeInTheDocument()
    expect(screen.getByText(/Versión 3/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar expediente' }))
    expect(screen.queryByText(/Versión 3/)).not.toBeInTheDocument()
  })
  it('busca y pagina en servidor sin filtrar otra vez por texto local', async () => {
    const calls: URL[] = []
    server.use(
      http.get(base, ({ request: req }) => {
        const url = new URL(req.url)
        calls.push(url)
        return HttpResponse.json({
          items: [request],
          total: 11,
          page: Number(url.searchParams.get('page')),
          pageSize: 10,
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Picker />)
    await user.click(screen.getByRole('button', { name: 'Expediente recibido' }))
    await user.type(screen.getByPlaceholderText('Buscar negocio, contacto o correo…'), 'secundario')
    await waitFor(() =>
      expect(calls.some((url) => url.searchParams.get('search') === 'secundario')).toBe(true),
    )
    expect(await screen.findByRole('option', { name: /Estudio Norte/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente página' }))
    await waitFor(() =>
      expect(calls.some((url) => url.searchParams.get('page') === '2')).toBe(true),
    )
    expect(screen.getByText(/11 expedientes/)).toBeInTheDocument()
  })
  it('no convierte error de red en lista vacía y permite reintentar', async () => {
    server.use(http.get(base, () => HttpResponse.error()))
    renderWithProviders(<Picker />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/i)
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument()
  })
})
