import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import type { PrivateDocumentPreviewData } from '@/shared/lib/venue-document-requests'
import { PrivateDocumentPreview } from './PrivateDocumentPreview'

const pdf = {
  url: 'https://storage.example.test/private/a.pdf?signature=one',
  mimeType: 'application/pdf',
  fileName: 'identidad.pdf',
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function previewProps(
  requestPreview: () => Promise<PrivateDocumentPreviewData> = vi.fn(async () => pdf),
) {
  return {
    documentKey: 'request/a',
    fileName: 'identidad.pdf',
    requestPreview,
    onDownload: vi.fn(),
  }
}
describe('PrivateDocumentPreview', () => {
  it('firma al click; PDF tiene fallback aun sin load/error y cerrar restaura foco', async () => {
    const user = userEvent.setup()
    const props = previewProps()
    renderWithProviders(<PrivateDocumentPreview {...props} />)
    const view = screen.getByRole('button', { name: 'Ver identidad.pdf' })
    expect(props.requestPreview).not.toHaveBeenCalled()
    await user.click(view)
    expect(await screen.findByTitle('Vista previa de identidad.pdf')).toHaveAttribute(
      'referrerPolicy',
      'no-referrer',
    )
    const external = screen.getByRole('link', { name: 'Abrir en otra pestaña' })
    expect(external).toHaveAttribute('href', pdf.url)
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('button', { name: 'Reintentar vista previa' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Descargar documento' }))
    expect(props.onDownload).toHaveBeenCalledTimes(1)
    // No iframe load event is fired: controls must be present without it.
    await user.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Vista previa de identidad.pdf')).not.toBeInTheDocument()
    await waitFor(() => expect(view).toHaveFocus())
  })
  it('imagen tiene alt, estado de carga y error/reintento con nueva firma', async () => {
    const user = userEvent.setup()
    const props = previewProps(
      vi.fn(async () => ({
        ...pdf,
        url: 'https://storage.example.test/photo.png',
        mimeType: 'image/png',
        fileName: 'foto.png',
      })),
    )
    renderWithProviders(<PrivateDocumentPreview {...props} />)
    await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
    const image = await screen.findByRole('img', { name: 'foto.png' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando imagen')
    expect(image).toHaveAttribute('referrerPolicy', 'no-referrer')
    fireEvent.error(image)
    expect(await screen.findByRole('alert')).toHaveTextContent(/mostrar la imagen/i)
    expect(screen.getByRole('button', { name: 'Descargar documento' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Reintentar vista previa' }))
    await waitFor(() => expect(props.requestPreview).toHaveBeenCalledTimes(2))
    fireEvent.load(await screen.findByRole('img', { name: 'foto.png' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Cargando imagen…')).not.toBeInTheDocument()
  })
  it('error al firmar es visible y reintentar solicita una firma nueva', async () => {
    const user = userEvent.setup()
    const requestPreview = vi
      .fn()
      .mockRejectedValueOnce(new Error('La liga no pudo prepararse.'))
      .mockResolvedValueOnce(pdf)
    renderWithProviders(<PrivateDocumentPreview {...previewProps(requestPreview)} />)
    await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La liga no pudo prepararse.')
    await user.click(screen.getByRole('button', { name: 'Reintentar vista previa' }))
    expect(await screen.findByTitle('Vista previa de identidad.pdf')).toBeInTheDocument()
    expect(requestPreview).toHaveBeenCalledTimes(2)
  })
  it.each(['success', 'error'])(
    'cerrar/reabrir descarta respuesta tardía %s de la apertura anterior',
    async (oldResult) => {
      const old = deferred<typeof pdf>()
      const fresh = deferred<typeof pdf>()
      const requestPreview = vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(fresh.promise)
      const user = userEvent.setup()
      renderWithProviders(<PrivateDocumentPreview {...previewProps(requestPreview)} />)
      await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
      expect(screen.getByRole('status')).toHaveTextContent('Preparando vista privada')
      await user.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
      await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
      await act(async () => {
        if (oldResult === 'success') old.resolve(pdf)
        else old.reject(new Error('Error viejo'))
      })
      expect(screen.queryByTitle('Vista previa de identidad.pdf')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await act(async () => {
        fresh.resolve({ ...pdf, url: 'https://storage.example.test/fresh.pdf' })
      })
      expect(await screen.findByTitle('Vista previa de identidad.pdf')).toHaveAttribute(
        'src',
        'https://storage.example.test/fresh.pdf',
      )
    },
  )
  it.each(['success', 'error'])(
    'reintentos solapados descartan respuesta vieja %s',
    async (oldResult) => {
      const old = deferred<typeof pdf>()
      const fresh = deferred<typeof pdf>()
      const requestPreview = vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(fresh.promise)
      const user = userEvent.setup()
      renderWithProviders(<PrivateDocumentPreview {...previewProps(requestPreview)} />)
      await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
      await user.click(screen.getByRole('button', { name: 'Reintentar vista previa' }))
      await act(async () => {
        fresh.resolve({ ...pdf, url: 'https://storage.example.test/fresh.pdf' })
      })
      await act(async () => {
        if (oldResult === 'success') old.resolve(pdf)
        else old.reject(new Error('Error viejo'))
      })
      expect(await screen.findByTitle('Vista previa de identidad.pdf')).toHaveAttribute(
        'src',
        'https://storage.example.test/fresh.pdf',
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    },
  )
  it('cambiar documento desmonta sesión y descarta respuesta pendiente del anterior', async () => {
    const old = deferred<typeof pdf>()
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(
      <PrivateDocumentPreview {...previewProps(vi.fn(() => old.promise))} />,
    )
    await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
    const newProps = {
      ...previewProps(),
      documentKey: 'venue/link/b',
      fileName: 'otro.pdf',
      requestPreview: vi.fn(async () => ({
        ...pdf,
        fileName: 'otro.pdf',
        url: 'https://storage.example.test/b.pdf',
      })),
    }
    rerender(<PrivateDocumentPreview {...newProps} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver otro.pdf' }))
    await act(async () => {
      old.resolve(pdf)
    })
    expect(await screen.findByTitle('Vista previa de otro.pdf')).toHaveAttribute(
      'src',
      'https://storage.example.test/b.pdf',
    )
    expect(screen.queryByTitle('Vista previa de identidad.pdf')).not.toBeInTheDocument()
  })
  it('Escape fuera del lector cierra y reabrir pide firma nueva; no persiste URL', async () => {
    const user = userEvent.setup()
    const props = previewProps()
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    renderWithProviders(<PrivateDocumentPreview {...props} />)
    await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
    await screen.findByTitle('Vista previa de identidad.pdf')
    screen.getByRole('button', { name: 'Cerrar vista previa' }).focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
    await screen.findByTitle('Vista previa de identidad.pdf')
    expect(props.requestPreview).toHaveBeenCalledTimes(2)
    expect(storage.mock.calls.some((call) => call.includes(pdf.url))).toBe(false)
    storage.mockRestore()
  })
  it('rechaza MIME no admitido antes de incrustar contenido', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <PrivateDocumentPreview
        {...previewProps(vi.fn(async () => ({ ...pdf, mimeType: 'text/html' })))}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Ver identidad.pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/formato/i)
    expect(screen.queryByTitle('Vista previa de identidad.pdf')).not.toBeInTheDocument()
  })
})
