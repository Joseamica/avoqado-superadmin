import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { AnnouncementsPage } from './AnnouncementsPage'

const baseURL = 'http://localhost:3000/api/v1'

const anuncio = {
  id: 'a1',
  title: 'Ya está la terminal Sunmi D3',
  body: 'Dos pantallas.',
  priority: 'NORMAL',
  showAsBanner: true,
  status: 'DRAFT',
  audienceRoles: ['OWNER'],
  targetPlanTiers: [],
  targetCategories: [],
  targetVenueIds: [],
  deliveredCount: 0,
  deliveredAt: null,
  publishedAt: null,
  createdBy: 's1',
  createdByName: 'Jose',
  createdAt: '2026-08-27T10:00:00.000Z',
  updatedAt: '2026-08-27T10:00:00.000Z',
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/announcements`, () =>
    HttpResponse.json({ success: true, data: { announcements: [anuncio] } }),
  ),
  http.post(`${baseURL}/superadmin/announcements/preview-audience`, () =>
    HttpResponse.json({ success: true, data: { venues: 37, people: 42 } }),
  ),
)
// Un solo `listen` por archivo: dos servers escuchando a la vez duplican el handler
// lookup por request (ver el comentario de `src/test/setup.ts`).
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())
beforeEach(() => server.resetHandlers())

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AnnouncementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AnnouncementsPage', () => {
  // ===== CASOS NUEVOS =====
  it('lista los anuncios con su estado', async () => {
    renderPage()
    expect(await screen.findByText('Ya está la terminal Sunmi D3')).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('un borrador ofrece publicar y archivar', async () => {
    renderPage()
    await screen.findByText('Ya está la terminal Sunmi D3')
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archivar' })).toBeInTheDocument()
  })

  /**
   * El servidor tenía `PUT /:id` desde el primer día y el compositor no lo usaba: un
   * borrador con una errata no se podía corregir, había que hacer otro. Aquí se prueba
   * el camino entero — abrir con el contenido cargado y guardar.
   */
  it('un borrador se puede EDITAR, y el formulario abre con su contenido', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ya está la terminal Sunmi D3')
    await user.click(screen.getByRole('button', { name: 'Editar' }))

    expect(await screen.findByText('Editar anuncio')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Ya está la terminal Sunmi D3')
    expect(screen.getByLabelText('Texto del aviso')).toHaveValue('Dos pantallas.')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  /**
   * 🔴 Editar manda un PUT sobre el MISMO anuncio, no crea otro. Sin esta prueba, un
   * error de cableado dejaría borradores duplicados en la lista y nadie lo notaría
   * hasta tener seis versiones del mismo aviso.
   */
  it('guardar cambios manda PUT al mismo anuncio, no crea otro', async () => {
    const user = userEvent.setup()
    let metodo: string | null = null
    let idTocado: string | null = null
    server.use(
      http.put(`${baseURL}/superadmin/announcements/:id`, ({ params, request }) => {
        metodo = request.method
        idTocado = params.id as string
        return HttpResponse.json({ success: true, data: { announcement: { ...anuncio, title: 'Corregido' } } })
      }),
      http.post(`${baseURL}/superadmin/announcements`, () => {
        throw new Error('no debe crear uno nuevo al editar')
      }),
    )

    renderPage()
    await screen.findByText('Ya está la terminal Sunmi D3')
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByText('Editar anuncio')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(metodo).toBe('PUT')
      expect(idTocado).toBe('a1')
    })
  })

  /** Un anuncio ya repartido no se edita: el servidor lo rechaza, así que no se ofrece. */
  it('un anuncio PUBLICADO no ofrece Editar', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/announcements`, () =>
        HttpResponse.json({
          success: true,
          data: { announcements: [{ ...anuncio, status: 'PUBLISHED', publishedAt: '2026-08-27T11:00:00.000Z' }] },
        }),
      ),
    )
    renderPage()
    await screen.findByText('Ya está la terminal Sunmi D3')
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  // 🔴 El conteo en vivo: el numero que ve el superadmin ANTES de publicar sale de la
  // misma consulta que hara el reparto. Si no coincidiera, publicaria a ciegas.
  it('el editor enseña a cuántos negocios y personas les llega', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ya está la terminal Sunmi D3')
    await user.click(screen.getByRole('button', { name: 'Nuevo anuncio' }))

    await waitFor(
      () => {
        expect(screen.getByText(/37/)).toBeInTheDocument()
        expect(screen.getByText(/42 personas/)).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  // ===== REGRESION: no publicar al vacio =====
  it(
    'no deja publicar si el anuncio no le llegaria a nadie',
    async () => {
      server.use(
        http.post(`${baseURL}/superadmin/announcements/preview-audience`, () =>
          HttpResponse.json({ success: true, data: { venues: 0, people: 0 } }),
        ),
      )
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Ya está la terminal Sunmi D3')
      await user.click(screen.getByRole('button', { name: 'Nuevo anuncio' }))

      // por etiqueta, no por placeholder: los campos ya usan `Field` y tienen label
      await user.type(screen.getByLabelText('Título'), 'Hola')
      await user.type(screen.getByLabelText('Texto del aviso'), 'Aviso')

      await waitFor(() => expect(screen.getByText('Nadie lo recibiría')).toBeInTheDocument(), {
        timeout: 4000,
      })
      const publicar = screen.getAllByRole('button', { name: 'Publicar' }).at(-1)
      expect(publicar).toBeDisabled()
    },
    // el conteo pasa por un debounce de 350 ms y `user.type` escribe tecla por tecla
    15000,
  )
})
