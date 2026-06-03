import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { Toaster } from 'sonner'
import { renderWithProviders } from '@/test/render'
import { StaffAccessStep } from './StaffAccessStep'
import type { AccessCandidate } from './api'

// Radix Popover / cmdk usan ResizeObserver y scrollIntoView; jsdom no los trae.
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

const baseURL = 'http://localhost:3000/api/v1'
const DEST = 'venue_dest'
const SOURCE = 'venue_source'

function makeCandidate(overrides: Partial<AccessCandidate> = {}): AccessCandidate {
  return {
    staffId: 'staff_1',
    name: 'Ana López',
    email: 'ana@example.com',
    inSourceVenue: true,
    currentRoleAtSource: 'CASHIER',
    alreadyAtDestination: false,
    currentRoleAtDestination: null,
    suggestedPin: '4821',
    rolesHeld: ['CASHIER'],
    ...overrides,
  }
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function mockCandidates(candidates: AccessCandidate[]) {
  server.use(
    http.get(`${baseURL}/superadmin/venues/${DEST}/staff-access/candidates`, () =>
      HttpResponse.json({ data: candidates, message: 'ok' }),
    ),
  )
}

describe('StaffAccessStep', () => {
  it('renderiza candidatos cargados desde el GET y permite agregarlos', async () => {
    mockCandidates([makeCandidate()])
    const user = userEvent.setup({ delay: null })

    renderWithProviders(
      <StaffAccessStep
        destVenueId={DEST}
        sourceVenueId={SOURCE}
        destVenueName="Sucursal Centro"
        onDone={() => {}}
        onSkip={() => {}}
      />,
    )

    // El picker carga; abrimos el combobox de agregar persona.
    const addTrigger = await screen.findByRole('button', { name: /buscar y agregar una persona/i })
    await user.click(addTrigger)

    // La persona del venue origen aparece como opción.
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())
    await user.click(screen.getByText('Ana López'))

    // Tras agregarla, aparece como fila con su correo y la frase de resumen.
    await waitFor(() => expect(screen.getByText('ana@example.com')).toBeInTheDocument())
  })

  it('pre-selecciona el rol del venue origen (Cajero) y el PIN sugerido', async () => {
    mockCandidates([makeCandidate()])
    const user = userEvent.setup({ delay: null })

    renderWithProviders(
      <StaffAccessStep
        destVenueId={DEST}
        sourceVenueId={SOURCE}
        onDone={() => {}}
        onSkip={() => {}}
      />,
    )

    const addTrigger = await screen.findByRole('button', { name: /buscar y agregar una persona/i })
    await user.click(addTrigger)
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())
    await user.click(screen.getByText('Ana López'))

    // El rol pre-seleccionado es el del origen → "Cajero".
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /rol de ana lópez/i })).toHaveTextContent('Cajero'),
    )
    // El PIN sugerido se pre-llena.
    const pinInput = screen.getByLabelText(/pin de ana lópez/i) as HTMLInputElement
    expect(pinInput.value).toBe('4821')
    // La frase plana de resumen.
    expect(
      screen.getByText('Le vas a dar acceso a Ana López como Cajero con PIN 4821.'),
    ).toBeInTheDocument()
  })

  it('postea el grant con { staffId, role, pin } y llama onDone', async () => {
    mockCandidates([makeCandidate()])
    let posted: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/venues/${DEST}/staff-access`, async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({
          data: [{ staffId: 'staff_1', role: 'CASHIER', granted: true }],
          message: 'ok',
        })
      }),
    )
    const onDone = vi.fn()
    const user = userEvent.setup({ delay: null })

    renderWithProviders(
      <StaffAccessStep
        destVenueId={DEST}
        sourceVenueId={SOURCE}
        onDone={onDone}
        onSkip={() => {}}
      />,
    )

    const addTrigger = await screen.findByRole('button', { name: /buscar y agregar una persona/i })
    await user.click(addTrigger)
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())
    await user.click(screen.getByText('Ana López'))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /dar acceso y continuar/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: /dar acceso y continuar/i }))

    await waitFor(() =>
      expect(posted).toEqual({ grants: [{ staffId: 'staff_1', role: 'CASHIER', pin: '4821' }] }),
    )
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('muestra el mensaje del server verbatim cuando el PIN colisiona (400)', async () => {
    mockCandidates([makeCandidate()])
    const serverMessage = 'Este PIN ya está en uso en esta sucursal'
    server.use(
      http.post(`${baseURL}/superadmin/venues/${DEST}/staff-access`, () =>
        HttpResponse.json({ message: serverMessage }, { status: 400 }),
      ),
    )
    const onDone = vi.fn()
    const user = userEvent.setup({ delay: null })

    renderWithProviders(
      <>
        <StaffAccessStep
          destVenueId={DEST}
          sourceVenueId={SOURCE}
          onDone={onDone}
          onSkip={() => {}}
        />
        <Toaster />
      </>,
    )

    const addTrigger = await screen.findByRole('button', { name: /buscar y agregar una persona/i })
    await user.click(addTrigger)
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument())
    await user.click(screen.getByText('Ana López'))

    await user.click(screen.getByRole('button', { name: /dar acceso y continuar/i }))

    // El mensaje en español del server se muestra verbatim (toast de sonner).
    await waitFor(() => expect(screen.getByText(serverMessage)).toBeInTheDocument())
    expect(onDone).not.toHaveBeenCalled()
  })

  it('llama onSkip al click en "Omitir" sin postear', async () => {
    mockCandidates([makeCandidate()])
    let posted = false
    server.use(
      http.post(`${baseURL}/superadmin/venues/${DEST}/staff-access`, () => {
        posted = true
        return HttpResponse.json({ data: [], message: 'ok' })
      }),
    )
    const onSkip = vi.fn()
    const user = userEvent.setup({ delay: null })

    renderWithProviders(
      <StaffAccessStep
        destVenueId={DEST}
        sourceVenueId={SOURCE}
        onDone={() => {}}
        onSkip={onSkip}
      />,
    )

    await screen.findByRole('button', { name: /buscar y agregar una persona/i })
    await user.click(screen.getByRole('button', { name: /^omitir$/i }))

    expect(onSkip).toHaveBeenCalled()
    expect(posted).toBe(false)
  })

  it('marca a quien ya tiene acceso con un badge "Ya tiene acceso"', async () => {
    mockCandidates([
      makeCandidate({
        staffId: 'staff_2',
        name: 'Beto Ruiz',
        email: 'beto@example.com',
        inSourceVenue: false,
        currentRoleAtSource: null,
        alreadyAtDestination: true,
        currentRoleAtDestination: 'WAITER',
        suggestedPin: null,
        rolesHeld: ['WAITER'],
      }),
    ])
    const user = userEvent.setup({ delay: null })

    renderWithProviders(<StaffAccessStep destVenueId={DEST} onDone={() => {}} onSkip={() => {}} />)

    const addTrigger = await screen.findByRole('button', { name: /buscar y agregar una persona/i })
    await user.click(addTrigger)
    await waitFor(() => expect(screen.getByText('Beto Ruiz')).toBeInTheDocument())
    await user.click(screen.getByText('Beto Ruiz'))

    await waitFor(() => expect(screen.getByText('Ya tiene acceso')).toBeInTheDocument())
  })
})
