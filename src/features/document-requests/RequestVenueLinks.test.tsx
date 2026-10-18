import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { renderWithProviders } from '@/test/render'
import { RequestVenueLinks } from './RequestVenueLinks'
import type { DocumentRequest } from './api'

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView = () => {}
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const base = 'http://localhost:3000/api/v1/superadmin/document-requests'
const request = {
  id: 'cjld2cjxh0000qzrmn831i7rn',
  businessName: 'Clínica Norte',
  submissionVersion: 4,
  status: 'SUBMITTED',
} as DocumentRequest
const venue = {
  id: 'cjld2cyuq0000t3rmniod1foy',
  name: 'Sucursal Norte',
  slug: 'norte',
  organizationId: 'cjld2d4tc0000syrm4u4c2x0r',
  organizationName: 'Grupo Salud',
  entityType: 'PERSONA_FISICA',
}
const server = setupServer(
  http.get(`${base}/${request.id}/venue-links`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 10 }),
  ),
  http.get(`${base}/venue-options`, () =>
    HttpResponse.json({ items: [venue], total: 11, page: 1, pageSize: 10 }),
  ),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())
describe('RequestVenueLinks', () => {
  it('abre alta con el expediente enviado y oculta acciones en borrador', () => {
    const { unmount } = renderWithProviders(<RequestVenueLinks request={request} />)
    expect(screen.getByRole('link', { name: 'Crear venue' })).toHaveAttribute(
      'href',
      `/venues/new?documentRequest=${request.id}`,
    )
    unmount()
    renderWithProviders(<RequestVenueLinks request={{ ...request, status: 'DRAFT' }} />)
    expect(screen.queryByRole('link', { name: 'Crear venue' })).not.toBeInTheDocument()
  })
  it('exige confirmación con nombre y organización y publica versión exacta', async () => {
    const post = vi.fn(async ({ request: req }: { request: Request }) => {
      expect(await req.json()).toEqual({ venueId: venue.id, submissionVersion: 4, confirmed: true })
      return HttpResponse.json({ created: true, link: { id: 'link' } })
    })
    server.use(http.post(`${base}/${request.id}/venue-links`, post))
    renderWithProviders(<RequestVenueLinks request={request} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Vincular a venue existente' }))
    expect(screen.getByRole('button', { name: 'Confirmar vínculo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Venue existente' }))
    await user.click(await screen.findByRole('option', { name: /Sucursal Norte Grupo Salud/ }))
    expect(
      screen.getByText(/Clínica Norte · Versión 4 → Sucursal Norte · Grupo Salud/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar vínculo' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar vínculo' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Expediente vinculado'))
  })
  it.each(['version', 'organization', 'network'])(
    'conserva selección ante conflicto/red: %s',
    async (status) => {
      server.use(
        http.post(`${base}/${request.id}/venue-links`, () =>
          status === 'network'
            ? HttpResponse.error()
            : HttpResponse.json(
                {
                  message:
                    status === 'version'
                      ? 'El expediente cambió de versión'
                      : 'El expediente pertenece a otra organización',
                },
                { status: 409 },
              ),
        ),
      )
      renderWithProviders(<RequestVenueLinks request={request} />)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Vincular a venue existente' }))
      await user.click(screen.getByRole('button', { name: 'Venue existente' }))
      await user.click(await screen.findByRole('option', { name: /Sucursal Norte/ }))
      await user.click(screen.getByRole('checkbox'))
      await user.click(screen.getByRole('button', { name: 'Confirmar vínculo' }))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(toast.success).not.toHaveBeenCalled()
      expect(screen.getByRole('checkbox')).toBeChecked()
      expect(screen.getByRole('button', { name: 'Confirmar vínculo' })).toBeEnabled()
    },
  )
  it('busca y pagina venues remotamente', async () => {
    const urls: URL[] = []
    server.use(
      http.get(`${base}/venue-options`, ({ request: req }) => {
        urls.push(new URL(req.url))
        return HttpResponse.json({
          items: [venue],
          total: 11,
          page: Number(new URL(req.url).searchParams.get('page')),
          pageSize: 10,
        })
      }),
    )
    renderWithProviders(<RequestVenueLinks request={request} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Vincular a venue existente' }))
    await user.click(screen.getByRole('button', { name: 'Venue existente' }))
    await user.type(screen.getByPlaceholderText('Buscar venue u organización…'), 'Grupo')
    await waitFor(() =>
      expect(urls.some((url) => url.searchParams.get('search') === 'Grupo')).toBe(true),
    )
    await user.click(
      within(screen.getByRole('navigation', { name: 'Paginación de venues' })).getByRole('button', {
        name: 'Siguiente página',
      }),
    )
    await waitFor(() => expect(urls.some((url) => url.searchParams.get('page') === '2')).toBe(true))
  })
})
