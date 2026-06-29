import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EmisorSetupPage } from './EmisorSetupPage'

const baseURL = 'http://localhost:3000/api/v1'

const configuredEmisor = {
  id: 'e1',
  rfc: 'AVO010101AAA',
  legalName: 'Avoqado SA de CV',
  regimenFiscal: '601',
  lugarExpedicion: '06000',
  provider: 'facturapi',
  providerOrgId: 'org_1',
  csdStatus: 'ACTIVE',
  csdExpiresAt: '2027-01-01T00:00:00.000Z',
  csdLastCheckedAt: null,
  serie: 'A',
  defaultUsoCfdi: 'G03',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('EmisorSetupPage', () => {
  it('hidrata el formulario, refleja el estado del CSD y dispara guardar/provisionar', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: configuredEmisor }),
      ),
      http.put(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: configuredEmisor }),
      ),
      http.post(`${baseURL}/superadmin/billing/emisor/provision`, () =>
        HttpResponse.json({ success: true, data: configuredEmisor }),
      ),
    )

    renderWithProviders(<EmisorSetupPage />)

    // El useEffect hidrata el RFC desde el emisor cargado.
    await waitFor(() => expect(screen.getByLabelText('RFC')).toHaveValue('AVO010101AAA'), {
      timeout: 4000,
    })

    // El estado refleja CSD activo + provisionado.
    expect(screen.getByText('CSD activo')).toBeInTheDocument()
    expect(screen.getByText('Provisionado en Facturapi')).toBeInTheDocument()

    // Datos fiscales válidos tras hidratar → handleSaveLegal.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))
    // Provisionar (rama automática) → handleProvision.
    fireEvent.click(screen.getByRole('button', { name: 'Provisionar en Facturapi' }))

    // Toggle manual revela los campos de org id / live key.
    fireEvent.click(screen.getByRole('checkbox'))
    expect(await screen.findByLabelText('Provider org id')).toBeInTheDocument()
  })
})
