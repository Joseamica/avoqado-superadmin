import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders, screen, waitFor, within } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { DocumentRequestsPage } from './DocumentRequestsPage'
import { DocumentRequestDetailPage } from './DocumentRequestDetailPage'

installGlobalServer()
const base = 'http://localhost:3000/api/v1/superadmin/document-requests'
const request = {
  id: 'c123456789012345678901234',
  provider: 'ANGELPAY',
  entityType: 'PERSONA_FISICA',
  businessName: 'Óptica Central',
  contactName: null,
  email: null,
  phone: null,
  status: 'DRAFT',
  expiresAt: '2026-10-31T12:00:00.000Z',
  submittedAt: null,
  createdAt: '2026-10-17T12:00:00.000Z',
}
beforeEach(() =>
  server.use(
    http.get(`${base}/:id/venue-links`, () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 10 }),
    ),
  ),
)

const uploadUrl = `http://localhost:5173/documentos/${request.id}#token=${'a'.repeat(64)}`

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
})

function renderPage(path = '/document-requests') {
  return renderWithProviders(
    <Routes>
      <Route path="/document-requests" element={<DocumentRequestsPage />} />
      <Route path="/document-requests/:id" element={<DocumentRequestDetailPage />} />
    </Routes>,
    { initialEntries: [path] },
  )
}

it('busca y pagina en servidor mostrando el total exacto sin filtrar sólo la página', async () => {
  const user = userEvent.setup()
  const calls: URL[] = []
  server.use(
    http.get(base, ({ request: req }) => {
      const url = new URL(req.url)
      calls.push(url)
      return HttpResponse.json({
        items: [
          {
            ...request,
            businessName:
              url.searchParams.get('page') === '2' ? 'Taller Norte' : request.businessName,
          },
        ],
        total: 26,
        page: Number(url.searchParams.get('page') || 1),
        pageSize: 25,
      })
    }),
  )
  renderPage()
  expect(await screen.findByText('Óptica Central')).toBeInTheDocument()
  expect(screen.getByText('26 solicitudes')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(await screen.findByText('Taller Norte')).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Buscar por negocio o contacto…' }), 'óptica')
  await waitFor(() => expect(calls.at(-1)?.searchParams.get('search')).toBe('óptica'))
  expect(calls.at(-1)?.searchParams.get('page')).toBe('1')
  expect(calls.at(-1)?.searchParams.get('pageSize')).toBe('25')
  expect(await screen.findByText('Óptica Central')).toBeInTheDocument()
})

it('crea un expediente sin venue, refresca lista y permite copiar la liga completa', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  let created = false
  server.use(
    http.get(base, () =>
      HttpResponse.json({
        items: created ? [request] : [],
        total: created ? 1 : 0,
        page: 1,
        pageSize: 25,
      }),
    ),
    http.post(base, async ({ request: req }) => {
      expect(await req.json()).toEqual({
        provider: 'BLUMON',
        entityType: 'PERSONA_MORAL',
        businessName: request.businessName,
      })
      created = true
      return HttpResponse.json({ request, uploadUrl }, { status: 201 })
    }),
  )
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Crear liga' }))
  const drawer = await screen.findByRole('dialog')
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Nombre del negocio' }),
    request.businessName,
  )
  await user.click(within(drawer).getByRole('button', { name: 'Procesador' }))
  await user.click(await screen.findByText('Blumon'))
  await user.click(within(drawer).getByRole('button', { name: 'Tipo de persona' }))
  await user.click(await screen.findByText('Persona moral'))
  await user.click(within(drawer).getByRole('button', { name: 'Generar liga' }))
  await user.click(await screen.findByRole('button', { name: 'Copiar liga' }))
  expect(write).toHaveBeenCalledWith(uploadUrl)
  const whatsapp = screen.getByRole('link', { name: 'Compartir por WhatsApp' })
  expect(new URL(whatsapp.getAttribute('href')!).searchParams.get('text')).toContain(uploadUrl)
  expect(whatsapp).toHaveAttribute('target', '_blank')
  await user.click(within(drawer).getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('Óptica Central')).toBeInTheDocument()
})

it('muestra contacto pendiente, descarga privada por id y no busca una liga recuperable', async () => {
  const user = userEvent.setup()
  server.use(
    http.get(`${base}/${request.id}`, () =>
      HttpResponse.json({
        request,
        documents: [
          {
            id: 'cfile123456789012345678901',
            key: 'csf',
            fileName: 'constancia.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
          },
        ],
      }),
    ),
    http.get(`${base}/${request.id}/documents/cfile123456789012345678901/download`, () =>
      HttpResponse.json({ url: 'https://storage.example.test/private-document' }),
    ),
  )
  const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  renderPage(`/document-requests/${request.id}`)
  expect(await screen.findByText('Contacto pendiente de envío')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copiar liga' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Descargar constancia.pdf' }))
  await waitFor(() => expect(downloadClick).toHaveBeenCalled())
  const anchor = downloadClick.mock.instances[0]
  if (!(anchor instanceof HTMLAnchorElement)) throw new Error('La descarga requiere un enlace HTML')
  expect(anchor.href).toBe('https://storage.example.test/private-document')
  expect(anchor.target).toBe('')
  expect(anchor.rel).toBe('noreferrer')
  downloadClick.mockRestore()
})

it('renueva y revoca con confirmación, conserva archivos y descarta liga revocada', async () => {
  const user = userEvent.setup()
  let current = { ...request, status: 'SUBMITTED' }
  server.use(
    http.get(`${base}/${request.id}`, () => HttpResponse.json({ request: current, documents: [] })),
    http.post(`${base}/${request.id}/renew`, () => {
      current = { ...current, status: 'DRAFT' }
      return HttpResponse.json({ request: current, uploadUrl })
    }),
    http.post(`${base}/${request.id}/revoke`, () => {
      current = { ...current, status: 'REVOKED' }
      return HttpResponse.json({ request: current })
    }),
  )
  renderPage(`/document-requests/${request.id}`)
  await user.click(await screen.findByRole('button', { name: 'Renovar liga' }))
  await user.click(screen.getByRole('button', { name: 'Confirmar renovación' }))
  expect(await screen.findByRole('button', { name: 'Copiar liga' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Revocar liga' }))
  await user.click(screen.getByRole('button', { name: 'Confirmar revocación' }))
  expect(await screen.findByText('Revocada')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copiar liga' })).not.toBeInTheDocument()
})

it('distingue errores del servidor y reintenta la lista', async () => {
  const user = userEvent.setup()
  let fail = true
  server.use(
    http.get(base, () =>
      fail
        ? HttpResponse.json({ message: 'No disponible' }, { status: 500 })
        : HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25 }),
    ),
  )
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent(/Error del servidor/i)
  fail = false
  await user.click(screen.getByRole('button', { name: /Reintentar/ }))
  expect(await screen.findByText('Aún no hay solicitudes')).toBeInTheDocument()
})

it('muestra contacto recibido y el estado de cada buzón aunque falle un aviso', async () => {
  server.use(
    http.get(`${base}/${request.id}`, () =>
      HttpResponse.json({
        request: {
          ...request,
          status: 'SUBMITTED',
          contactName: 'Ana López',
          email: 'ana@example.test',
          phone: '5512345678',
          submissionVersion: 1,
          notification: {
            onboarding: 'SENT',
            daniel: 'FAILED',
            attempts: 2,
            nextAttemptAt: '2026-10-18T12:00:00.000Z',
          },
        },
        documents: [],
      }),
    ),
  )
  renderPage(`/document-requests/${request.id}`)
  expect(await screen.findByText('ana@example.test')).toBeInTheDocument()
  const notification = screen.getByRole('region', { name: 'Avisos por correo' })
  expect(within(notification).getByText('onboarding@avoqado.io')).toBeInTheDocument()
  expect(within(notification).getByText('Enviado')).toBeInTheDocument()
  expect(within(notification).getByText('daniel@avoqado.io')).toBeInTheDocument()
  expect(within(notification).getByText('Falló')).toBeInTheDocument()
  expect(within(notification).getByText(/Próximo intento/)).toBeInTheDocument()
})

it('el ojito firma sólo al click y muestra PDF privado sin quitar Descargar', async () => {
  const user = userEvent.setup()
  const preview = vi.fn(() =>
    HttpResponse.json({
      url: 'https://storage.example.test/inline.pdf?signature=one',
      mimeType: 'application/pdf',
      fileName: 'constancia.pdf',
    }),
  )
  server.use(
    http.get(`${base}/${request.id}`, () =>
      HttpResponse.json({
        request,
        documents: [
          {
            id: 'cfile123456789012345678901',
            key: 'csf',
            fileName: 'constancia.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
          },
        ],
      }),
    ),
    http.get(`${base}/${request.id}/documents/cfile123456789012345678901/preview`, preview),
  )
  renderPage(`/document-requests/${request.id}`)
  const view = await screen.findByRole('button', { name: 'Ver constancia.pdf' })
  expect(preview).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Descargar constancia.pdf' })).toBeInTheDocument()
  await user.click(view)
  const iframe = await screen.findByTitle('Vista previa de constancia.pdf')
  expect(iframe).toHaveAttribute('src', 'https://storage.example.test/inline.pdf?signature=one')
  expect(iframe).toHaveAttribute('referrerPolicy', 'no-referrer')
  expect(screen.getByRole('link', { name: 'Abrir en otra pestaña' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  expect(screen.getByRole('button', { name: 'Descargar documento' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
  expect(screen.queryByTitle('Vista previa de constancia.pdf')).not.toBeInTheDocument()
  await waitFor(() => expect(view).toHaveFocus())
})
