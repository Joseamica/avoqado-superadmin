import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { MerchantEditDrawer } from './MerchantEditDrawer'
import type { MerchantAccount, ProviderCostStructure } from './types'

const baseURL = 'http://localhost:3000/api/v1'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const blumon: MerchantAccount = {
  id: 'm1',
  provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
  externalMerchantId: '9814275',
  alias: null,
  displayName: 'Cuenta Principal',
  active: true,
  displayOrder: 0,
  clabeNumber: null,
  bankName: null,
  accountHolder: null,
  hasCredentials: true,
  blumonSerialNumber: '2841548417',
  blumonPosId: '376',
  blumonEnvironment: 'PRODUCTION',
  blumonMerchantId: null,
  angelpayAffiliation: null,
  angelpayMerchantName: null,
  aggregatorId: null,
  venues: [],
  terminals: [],
  counts: { costStructures: 0, venueConfigs: 0, terminals: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const angelpay: MerchantAccount = {
  ...blumon,
  id: 'm2',
  provider: { id: 'p2', code: 'ANGELPAY', name: 'AngelPay', type: 'PAYMENT_PROCESSOR' },
  blumonSerialNumber: null,
  blumonPosId: null,
  blumonEnvironment: null,
  angelpayAffiliation: '9814275',
  angelpayMerchantName: 'Amaena',
}

const cost: ProviderCostStructure = {
  id: 'c1',
  merchantAccountId: 'm1',
  debitRate: 0.025,
  creditRate: 0.03,
  amexRate: 0.035,
  internationalRate: 0.04,
  includesTax: false,
  taxRate: 0.16,
  fixedCostPerTransaction: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  active: true,
}

function renderDrawer(merchant: MerchantAccount, c: ProviderCostStructure | null = null) {
  return renderWithProviders(
    <MerchantEditDrawer
      open
      onOpenChange={() => {}}
      merchant={merchant}
      cost={c}
      settlements={[]}
    />,
  )
}

describe('MerchantEditDrawer — campos según el proveedor', () => {
  it('en una cuenta Blumon muestra sus campos y NO los de AngelPay', async () => {
    renderDrawer(blumon)

    await waitFor(() => expect(screen.getByText('Datos Blumon')).toBeInTheDocument())
    expect(screen.getByLabelText('Serial de la terminal')).toHaveValue('2841548417')
    expect(screen.getByLabelText('posId (Momentum)')).toHaveValue('376')
    expect(screen.queryByText('Datos AngelPay')).not.toBeInTheDocument()
  })

  it('en una cuenta AngelPay muestra afiliación y NO el serial de Blumon', async () => {
    renderDrawer(angelpay)

    await waitFor(() => expect(screen.getByText('Datos AngelPay')).toBeInTheDocument())
    expect(screen.getByLabelText('Afiliación')).toHaveValue('9814275')
    expect(screen.queryByLabelText('Serial de la terminal')).not.toBeInTheDocument()
    // AngelPay no usa merchantId de credenciales — sólo apiKey.
    expect(screen.queryByLabelText('merchantId')).not.toBeInTheDocument()
  })

  it('siempre ofrece ID de comercio, banco, tasas y liquidación', async () => {
    renderDrawer(blumon, cost)

    await waitFor(() => expect(screen.getByLabelText('ID de comercio')).toBeInTheDocument())
    expect(screen.getByLabelText('CLABE (18 dígitos)')).toBeInTheDocument()
    // Las tasas se siembran CRUDAS (0.025 → "2.5"), no efectivas (2.9).
    expect(screen.getByLabelText('Débito (%)')).toHaveValue('2.5')
    expect(screen.getByLabelText('Días AMEX')).toHaveValue('3')
  })
})

describe('MerchantEditDrawer — guardado', () => {
  it('manda sólo el campo que cambió', async () => {
    let body: Record<string, unknown> | null = null
    server.use(
      http.put(`${baseURL}/superadmin/merchant-accounts/m1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { ...blumon, _count: {} } })
      }),
    )

    renderDrawer(blumon)
    await waitFor(() => expect(screen.getByLabelText('posId (Momentum)')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('posId (Momentum)'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(body).not.toBeNull())
    expect(body).toEqual({ blumonPosId: '999' })
  })

  it('un CLABE inválido muestra el error y no dispara ninguna petición', async () => {
    let called = false
    server.use(
      http.put(`${baseURL}/superadmin/merchant-accounts/m1`, () => {
        called = true
        return HttpResponse.json({ data: blumon })
      }),
    )

    renderDrawer(blumon)
    await waitFor(() => expect(screen.getByLabelText('CLABE (18 dígitos)')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('CLABE (18 dígitos)'), { target: { value: '0121' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/18 dígitos/))
    expect(called).toBe(false)
  })
})
