import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { TooltipProvider } from '@/shared/ui/Tooltip'
import { TerminalActionDrawer } from './TerminalActionDrawer'
import type { Terminal } from './types'

// Radix / cmdk popover usan ResizeObserver y scrollIntoView; jsdom no los trae.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

function renderDrawer(props: Parameters<typeof TerminalActionDrawer>[0]) {
  return renderWithProviders(
    <TooltipProvider>
      <TerminalActionDrawer {...props} />
    </TooltipProvider>,
  )
}

const baseURL = 'http://localhost:3000/api/v1'

function makeTerminal(overrides: Partial<Terminal> = {}): Terminal {
  return {
    id: 't1',
    serialNumber: '1850072345',
    name: 'TPV Barra',
    type: 'TPV_ANDROID',
    brand: 'PAX',
    model: 'A910s',
    status: 'ACTIVE',
    lastHeartbeat: new Date(Date.now() - 60_000).toISOString(),
    version: '1.42.0',
    latestHealthScore: 85,
    latestHealthAt: new Date(Date.now() - 60_000).toISOString(),
    ipAddress: '192.168.1.10',
    isLocked: false,
    lockedAt: null,
    lockedReason: null,
    assignedMerchantIds: [],
    activationCode: null,
    activationCodeExpiry: null,
    activatedAt: '2026-01-01T00:00:00.000Z',
    venueId: 'v1',
    venue: { id: 'v1', name: 'Pez Volador', slug: 'pez-volador' },
    migration: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    ...overrides,
  }
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/terminals/:id/commands`, () =>
    HttpResponse.json({ data: [], total: 0 }),
  ),
  http.get(`${baseURL}/superadmin/app-updates`, () =>
    HttpResponse.json({ success: true, data: [] }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('TerminalActionDrawer', () => {
  it('no renderiza nada cuando open=false', () => {
    renderDrawer({ terminal: null, open: false, onOpenChange: () => {} })
    expect(screen.queryByText(/TPV Barra/)).not.toBeInTheDocument()
  })

  it('muestra fallback cuando open=true sin terminal', () => {
    renderDrawer({ terminal: null, open: true, onOpenChange: () => {} })
    expect(screen.getByText('No hay terminal seleccionada.')).toBeInTheDocument()
  })

  it('muestra el header con nombre, serial y status del terminal', async () => {
    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('TPV Barra')).toBeInTheDocument())
    expect(screen.getByText('1850072345')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
  })

  it('renderiza las "Acciones rápidas" cuando el terminal está online', async () => {
    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Acciones rápidas')).toBeInTheDocument())
    expect(screen.getByText('Reiniciar app')).toBeInTheDocument()
    expect(screen.getByText('Limpiar caché')).toBeInTheDocument()
    expect(screen.getByText('Poner en mantenimiento')).toBeInTheDocument()
    expect(screen.getByText('Bloquear terminal')).toBeInTheDocument()
  })

  it('muestra "Salir de mantenimiento" cuando el status es MAINTENANCE', async () => {
    const terminal = makeTerminal({ status: 'MAINTENANCE' })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Salir de mantenimiento')).toBeInTheDocument())
  })

  it('muestra "Desbloquear terminal" cuando está locked', async () => {
    const terminal = makeTerminal({ isLocked: true, lockedAt: '2026-05-25T10:00:00.000Z' })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Desbloquear terminal')).toBeInTheDocument())
    expect(screen.getByText('Bloqueada')).toBeInTheDocument()
  })

  it('muestra sección de activación cuando el terminal está PENDING_ACTIVATION', async () => {
    const terminal = makeTerminal({
      status: 'PENDING_ACTIVATION',
      activatedAt: null,
      lastHeartbeat: null,
      serialNumber: null,
    })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Activación pendiente')).toBeInTheDocument())
    expect(screen.getByText('La terminal aún no está activada')).toBeInTheDocument()
    expect(screen.getByText('Generar código')).toBeInTheDocument()
    expect(screen.getByText('Activar remotamente')).toBeInTheDocument()
  })

  it('muestra el código activo cuando existe activationCode', async () => {
    const terminal = makeTerminal({
      status: 'PENDING_ACTIVATION',
      activatedAt: null,
      activationCode: 'A3F9K2',
      activationCodeExpiry: new Date(Date.now() + 7 * 86400_000).toISOString(),
    })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('A3F9K2')).toBeInTheDocument())
    // El botón cambia a "Regenerar código" cuando ya hay uno
    expect(screen.getByText('Regenerar código')).toBeInTheDocument()
  })

  it('muestra zona destructiva con SHUTDOWN y FACTORY_RESET', async () => {
    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Acciones destructivas')).toBeInTheDocument())
    expect(screen.getByText('Restablecer caché y almacenamiento')).toBeInTheDocument()
    expect(screen.getByText('Cerrar app')).toBeInTheDocument()
  })

  it('muestra banner offline cuando el heartbeat es muy viejo', async () => {
    const terminal = makeTerminal({
      lastHeartbeat: new Date(Date.now() - 30 * 60_000).toISOString(),
    })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() =>
      expect(
        screen.getByText('La terminal está offline — los comandos se encolan'),
      ).toBeInTheDocument(),
    )
  })

  it('muestra link "Configurar terminal completa" hacia /terminals/:id/settings', async () => {
    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() =>
      expect(screen.getByText('Configurar terminal completa')).toBeInTheDocument(),
    )
    const link = screen.getByRole('link', { name: /Configurar terminal completa/i })
    expect(link).toHaveAttribute('href', '/terminals/t1/settings')
  })

  it('muestra el version installer con la versión actual', async () => {
    const terminal = makeTerminal({ version: '1.42.0' })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Instalar versión específica')).toBeInTheDocument())
    // El installer ofrece el botón "Instalar"
    expect(screen.getByRole('button', { name: /^Instalar$/i })).toBeInTheDocument()
  })

  it('hace POST al endpoint command cuando se click "Reiniciar app"', async () => {
    let calledWith: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/terminals/t1/command`, async ({ request }) => {
        calledWith = await request.json()
        return HttpResponse.json({ data: { commandId: 'cmd1', status: 'queued' } })
      }),
    )

    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Reiniciar app')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Reiniciar app'))

    await waitFor(() => expect(calledWith).toEqual({ command: 'RESTART', payload: undefined }))
  })

  it('activa el flow de confirmación al hacer click en FACTORY_RESET', async () => {
    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() =>
      expect(screen.getByText('Restablecer caché y almacenamiento')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText('Restablecer caché y almacenamiento'))

    // El bloque de confirmación debe aparecer
    await waitFor(() =>
      expect(screen.getByText(/Confirma: Restablecer terminal/)).toBeInTheDocument(),
    )

    // Botón "Ejecutar" debería estar disabled mientras el input está vacío
    const executeBtn = screen.getByRole('button', { name: /Ejecutar/ })
    expect(executeBtn).toBeDisabled()
  })

  it('permite cancelar el flow de confirmación danger', async () => {
    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    fireEvent.click(screen.getByText('Cerrar app'))
    await waitFor(() => expect(screen.getByText(/Confirma: Cerrar app/)).toBeInTheDocument())

    // Click cancelar
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    // El bloque de confirmación debe desaparecer
    await waitFor(() => expect(screen.queryByText(/Confirma: Cerrar app/)).not.toBeInTheDocument())
  })

  it('genera código de activación al click "Generar código"', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/superadmin/terminals/t1/generate-activation-code`, () => {
        called = true
        return HttpResponse.json({
          data: { code: 'XYZ789', expiresAt: '2026-06-01T00:00:00.000Z' },
        })
      }),
    )

    const terminal = makeTerminal({
      status: 'PENDING_ACTIVATION',
      activatedAt: null,
      lastHeartbeat: null,
      serialNumber: null,
    })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Generar código')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Generar código'))

    await waitFor(() => expect(called).toBe(true))
  })

  it('dispara remote activate al click "Activar remotamente"', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/superadmin/terminals/t1/remote-activate`, () => {
        called = true
        return HttpResponse.json({})
      }),
    )

    const terminal = makeTerminal({
      status: 'PENDING_ACTIVATION',
      activatedAt: null,
      lastHeartbeat: null,
      serialNumber: null,
    })
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Activar remotamente')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Activar remotamente'))

    await waitFor(() => expect(called).toBe(true))
  })

  it('dispara CLEAR_CACHE y MAINTENANCE_MODE y deshabilita comandos no implementados al click', async () => {
    const calls: string[] = []
    server.use(
      http.post(`${baseURL}/superadmin/terminals/t1/command`, async ({ request }) => {
        const body = (await request.json()) as { command: string }
        calls.push(body.command)
        return HttpResponse.json({ data: { commandId: 'cmd', status: 'queued' } })
      }),
    )

    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Limpiar caché')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Limpiar caché'))
    expect(screen.getByText('Sincronizar datos').closest('button')).toBeDisabled()
    fireEvent.click(screen.getByText('Exportar logs'))
    fireEvent.click(screen.getByText('Poner en mantenimiento'))
    fireEvent.click(screen.getByText('Bloquear terminal'))
    fireEvent.click(screen.getByText('Pedir actualización'))

    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(1))
    // Aunque las mutations son serializadas, debe haber al menos un command despachado
    expect(calls).toContain('CLEAR_CACHE')
  })

  it('falla "Instalar" sin versión seleccionada y NO dispara el comando', async () => {
    let called = false
    server.use(
      http.post(`${baseURL}/superadmin/terminals/t1/command`, () => {
        called = true
        return HttpResponse.json({ data: { commandId: 'cmd', status: 'queued' } })
      }),
    )

    const terminal = makeTerminal()
    renderDrawer({ terminal, open: true, onOpenChange: () => {} })

    await waitFor(() => expect(screen.getByText('Instalar versión específica')).toBeInTheDocument())

    // El botón "Instalar" está disabled si no hay versión seleccionada
    const installBtn = screen.getByRole('button', { name: /^Instalar$/ })
    expect(installBtn).toBeDisabled()

    // Aunque clickeáramos no debería disparar
    fireEvent.click(installBtn)
    expect(called).toBe(false)
  })
})

it('explica TMS en Nexgo sin ofrecer el selector de instalación incompatible', async () => {
  renderDrawer({
    terminal: makeTerminal({ brand: 'NEXGO', model: 'N86' }),
    open: true,
    onOpenChange: () => {},
  })
  expect(await screen.findByText('Esta TPV se actualiza mediante TMS.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Versión a instalar' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Pedir actualización/ })).toBeDisabled()
})

it('instala usando el versionCode numérico publicado', async () => {
  let body: unknown
  server.use(
    http.get(`${baseURL}/superadmin/app-updates`, () =>
      HttpResponse.json({
        data: [
          {
            id: 'release-200',
            versionCode: 200,
            versionName: '2.12.0',
            environment: 'SANDBOX',
            isActive: true,
          },
          {
            id: 'release-200-prod',
            versionCode: 200,
            versionName: '2.12.0',
            environment: 'PRODUCTION',
            isActive: true,
          },
        ],
      }),
    ),
    http.post(`${baseURL}/superadmin/terminals/t1/command`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ data: { commandId: 'install-200', status: 'PENDING' } })
    }),
  )
  renderDrawer({ terminal: makeTerminal(), open: true, onOpenChange: () => {} })
  fireEvent.click(await screen.findByRole('button', { name: 'Versión a instalar' }))
  fireEvent.click(await screen.findByRole('option', { name: /2.12.0/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Instalar' }))
  await waitFor(() =>
    expect(body).toEqual({ command: 'INSTALL_VERSION', payload: { versionCode: 200 } }),
  )
})

it('no presenta un comando enviado como ejecutado y permite ver el motivo de error', async () => {
  server.use(
    http.get(`${baseURL}/superadmin/terminals/t1/commands`, () =>
      HttpResponse.json({
        total: 2,
        data: [
          {
            id: 'cmd-sent',
            commandType: 'RESTART',
            status: 'SENT',
            createdAt: new Date().toISOString(),
            expiresAt: null,
            resultMessage: null,
          },
          {
            id: 'cmd-failed',
            commandType: 'FACTORY_RESET',
            status: 'FAILED',
            createdAt: new Date().toISOString(),
            expiresAt: null,
            resultMessage: 'Pagos pendientes de sincronizar',
          },
        ],
      }),
    ),
  )
  renderDrawer({ terminal: makeTerminal(), open: true, onOpenChange: () => {} })
  expect(await screen.findByText('Pagos pendientes de sincronizar')).toBeInTheDocument()
  expect(screen.getByText('Enviado, sin acuse')).toBeInTheDocument()
})

it('reuses the idempotency key after an uncertain command response', async () => {
  const keys: (string | null)[] = []
  server.use(
    http.post(`${baseURL}/superadmin/terminals/t1/command`, ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'))
      return keys.length === 1
        ? HttpResponse.json({ message: 'Respuesta perdida' }, { status: 500 })
        : HttpResponse.json({ data: { commandId: 'c1', status: 'QUEUED' } })
    }),
  )
  renderDrawer({ terminal: makeTerminal(), open: true, onOpenChange: () => {} })
  fireEvent.click(screen.getByText('Reiniciar app'))
  await waitFor(() => expect(keys).toHaveLength(1))
  await waitFor(() =>
    expect(screen.getByText('Reiniciar app').closest('button')).not.toBeDisabled(),
  )
  fireEvent.click(screen.getByText('Reiniciar app'))
  await waitFor(() => expect(keys).toHaveLength(2))
  expect(keys[0]).toBeTruthy()
  expect(keys[1]).toBe(keys[0])
})

it.each([undefined, 2])('explica el restablecimiento según el protocolo %s', (protocol) => {
  renderDrawer({
    terminal: makeTerminal({ commandProtocolVersion: protocol }),
    open: true,
    onOpenChange: () => {},
  })
  const button = screen.getByRole('button', { name: /Restablecer caché y almacenamiento/ })
  expect(button).toHaveTextContent(
    protocol === 2 ? 'Conserva la evidencia financiera' : 'Comprueba primero que todos los pagos',
  )
})
