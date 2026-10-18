import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { VenueDocumentsSection } from './VenueDocumentsSection'
const base = 'http://localhost:3000/api/v1/superadmin/document-requests'
const link = {
  id: 'cjld2cjxh0000qzrmn831i7rn',
  businessName: 'Tienda Centro',
  requestId: 'cjld2cyuq0000t3rmniod1foy',
  submissionVersion: 1,
  linkedAt: '2026-10-18T12:00:00Z',
  provider: 'BLUMON',
  entityType: 'PERSONA_FISICA',
}
const venueId = 'cjld2d4tc0000syrm4u4c2x0r'
const server = setupServer(
  http.get(`${base}/venues/${venueId}`, () =>
    HttpResponse.json({ items: [link], total: 11, page: 1, pageSize: 10 }),
  ),
  http.get(`${base}/venues/${venueId}/links/${link.id}`, () =>
    HttpResponse.json({
      link,
      request: {
        businessName: 'Tienda Centro',
        contactName: 'Ana anterior',
        email: 'anterior@tienda.mx',
        phone: '5512345678',
        submittedAt: '2026-10-17T12:00:00Z',
      },
      documents: [
        {
          id: 'doc-anterior',
          key: 'ine',
          fileName: 'ine-version-1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
      ],
    }),
  ),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => server.close())
describe('VenueDocumentsSection', () => {
  it('muestra versión histórica y pide descarga privada sólo al hacer click', async () => {
    const download = vi.fn(() =>
      HttpResponse.json({ url: 'https://private.example/signed?expires=123' }),
    )
    server.use(
      http.get(
        `${base}/venues/${venueId}/links/${link.id}/documents/doc-anterior/download`,
        download,
      ),
    )
    let downloadedUrl = ''
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedUrl = this.href
    })
    renderWithProviders(<VenueDocumentsSection venueId={venueId} />)
    const user = userEvent.setup()
    expect(await screen.findByText('Versión 1')).toBeInTheDocument()
    expect(screen.getByText(/11 expedientes/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Ver expediente Tienda Centro versión 1/ }))
    expect(await screen.findByText('Ana anterior')).toBeInTheDocument()
    expect(screen.getByText('ine-version-1.pdf')).toBeInTheDocument()
    expect(download).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Descargar ine-version-1.pdf' }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(downloadedUrl).toBe('https://private.example/signed?expires=123')
  })
  it('página siguiente pide otra página al servidor', async () => {
    const pages: string[] = []
    server.use(
      http.get(`${base}/venues/${venueId}`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')!
        pages.push(page)
        return HttpResponse.json({ items: [link], total: 11, page: Number(page), pageSize: 10 })
      }),
    )
    renderWithProviders(<VenueDocumentsSection venueId={venueId} />)
    const user = userEvent.setup()
    await screen.findByText(/11 expedientes/)
    await user.click(screen.getByRole('button', { name: 'Siguiente página' }))
    await waitFor(() => expect(pages).toContain('2'))
  })
  it('403 se muestra como acceso denegado, nunca como vacío', async () => {
    server.use(
      http.get(`${base}/venues/${venueId}`, () =>
        HttpResponse.json({ message: 'Acceso denegado' }, { status: 403 }),
      ),
    )
    renderWithProviders(<VenueDocumentsSection venueId={venueId} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado')
    expect(screen.queryByText(/No hay expedientes anexados/)).not.toBeInTheDocument()
  })
})

it('ojito usa venue/vínculo/documento histórico y cerrar conserva drawer y foco', async () => {
  const preview = vi.fn(() =>
    HttpResponse.json({
      url: 'https://storage.example.test/history.png?signature=one',
      mimeType: 'image/png',
      fileName: 'ine-version-1.png',
    }),
  )
  server.use(
    http.get(`${base}/venues/${venueId}/links/${link.id}/documents/doc-anterior/preview`, preview),
  )
  renderWithProviders(<VenueDocumentsSection venueId={venueId} />)
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: /Ver expediente Tienda Centro versión 1/ }),
  )
  const view = await screen.findByRole('button', { name: 'Ver ine-version-1.pdf' })
  expect(preview).not.toHaveBeenCalled()
  await user.click(view)
  expect(await screen.findByRole('img', { name: 'ine-version-1.png' })).toHaveAttribute(
    'src',
    'https://storage.example.test/history.png?signature=one',
  )
  await user.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
  expect(screen.getByRole('dialog', { name: 'Expediente de afiliación' })).toBeInTheDocument()
  expect(screen.getByText('Ana anterior')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Descargar ine-version-1.pdf' })).toBeInTheDocument()
  await waitFor(() => expect(view).toHaveFocus())
})
