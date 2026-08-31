import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { MerchantEditDrawer } from './MerchantEditDrawer'
import type { MerchantAccount, ProviderCostStructure } from './types'

const baseURL = 'http://localhost:3000/api/v1'
/**
 * 🔴 Handler por DEFAULT del PIN. `onUnhandledRequest: 'bypass'` (la convención del
 * repo, para que el `/auth/status` del AuthProvider no truene) manda al SERVIDOR REAL
 * todo lo que no esté mockeado: sin esto, una prueba que revele el PIN pega contra
 * `localhost:3000` de verdad y ensucia el log del backend con 401.
 */
const server = setupServer(
  http.get(`${baseURL}/superadmin/angelpay-accounts/:id/pin`, () =>
    HttpResponse.json({ data: { pin: '000000' } }),
  ),
)

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
  angelpayUserAccount: null,
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
  angelpayUserAccount: {
    id: 'ap1',
    email: 'ops@amaena.mx',
    status: 'PENDING_PIN',
    environment: 'QA',
    venueId: 'v1',
  },
}

const angelpayActiva: MerchantAccount = {
  ...angelpay,
  angelpayUserAccount: { ...angelpay.angelpayUserAccount!, status: 'ACTIVE' },
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

describe('MerchantEditDrawer — cuenta AngelPay (correo y PIN)', () => {
  it('muestra el correo de la cuenta y NO pide el PIN al abrir', async () => {
    let pinCalls = 0
    server.use(
      http.get(`${baseURL}/superadmin/angelpay-accounts/ap1/pin`, () => {
        pinCalls++
        return HttpResponse.json({ data: { pin: '123456' } })
      }),
    )

    renderDrawer(angelpay)
    await waitFor(() => expect(screen.getByLabelText('Correo de la cuenta')).toBeInTheDocument())

    expect(screen.getByLabelText('Correo de la cuenta')).toHaveValue('ops@amaena.mx')
    // Leer el PIN queda en la bitácora: abrir el editor no puede dispararlo.
    expect(pinCalls).toBe(0)
    expect(screen.getByLabelText('PIN actual')).toHaveValue('••••••')
  })

  it('revela el PIN sólo al tocar «Ver»', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/angelpay-accounts/ap1/pin`, () =>
        HttpResponse.json({ data: { pin: '123456' } }),
      ),
    )

    renderDrawer(angelpay)
    await waitFor(() => expect(screen.getByRole('button', { name: /Ver/ })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Ver/ }))

    await waitFor(() => expect(screen.getByLabelText('PIN actual')).toHaveValue('123456'))
  })

  it('en una cuenta ya ACTIVE el correo queda de sólo lectura', async () => {
    renderDrawer(angelpayActiva)
    await waitFor(() => expect(screen.getByLabelText('Correo de la cuenta')).toBeInTheDocument())

    // El estado y el ambiente se leen en español, no como enum crudo.
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getByLabelText('Ambiente')).toHaveValue('QA')
    expect(screen.getByLabelText('Correo de la cuenta')).toBeDisabled()
    // El PIN sí se puede rotar aunque el correo esté congelado.
    expect(screen.getByLabelText('Nuevo PIN (6 dígitos)')).not.toBeDisabled()
  })

  it('un PIN nuevo de 4 dígitos no dispara ninguna petición', async () => {
    let called = false
    server.use(
      http.patch(`${baseURL}/superadmin/angelpay-accounts/ap1/pin`, () => {
        called = true
        return HttpResponse.json({ data: {} })
      }),
    )

    renderDrawer(angelpay)
    await waitFor(() => expect(screen.getByLabelText('Nuevo PIN (6 dígitos)')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Nuevo PIN (6 dígitos)'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/6 dígitos/))
    expect(called).toBe(false)
  })

  it('en una cuenta Blumon no aparece la sección del login de AngelPay', async () => {
    renderDrawer(blumon)
    await waitFor(() => expect(screen.getByText('Datos Blumon')).toBeInTheDocument())

    expect(screen.queryByLabelText('Correo de la cuenta')).not.toBeInTheDocument()
  })
})
