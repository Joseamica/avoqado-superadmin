import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { renderHook, waitFor } from '@testing-library/react'
import { AllProviders } from '@/test/render'
import {
  useCustomerSearch,
  useEmisor,
  useEmisorActions,
  useInvoice,
  useInvoiceActions,
  useInvoices,
  useTaxProfileActions,
} from './use-billing'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Queries ──────────────────────────────────────────────────────────────────

describe('useEmisor', () => {
  it('fetches el emisor', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: { id: 'e1', rfc: 'AVO010101AAA' } }),
      ),
    )
    const { result } = renderHook(() => useEmisor(), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.id).toBe('e1')
  })
})

describe('useInvoices', () => {
  it('fetches la lista paginada con filtros', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/invoices`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 'c1' }],
          meta: { total: 1, page: 1, pageSize: 100 },
        }),
      ),
    )
    const { result } = renderHook(() => useInvoices({ status: 'STAMPED' }), {
      wrapper: AllProviders,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.rows).toHaveLength(1)
    expect(result.current.data?.total).toBe(1)
  })
})

describe('useInvoice', () => {
  it('queda disabled cuando el id es null', () => {
    const { result } = renderHook(() => useInvoice(null), { wrapper: AllProviders })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches el detalle cuando hay id', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/invoices/c1`, () =>
        HttpResponse.json({ success: true, data: { id: 'c1' } }),
      ),
    )
    const { result } = renderHook(() => useInvoice('c1'), { wrapper: AllProviders })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.id).toBe('c1')
  })
})

describe('useCustomerSearch', () => {
  it('queda disabled hasta tener 2+ caracteres', () => {
    const { result } = renderHook(() => useCustomerSearch('VENUE', 'a'), { wrapper: AllProviders })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('busca cuando el término tiene 2+ caracteres', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [{ type: 'VENUE', id: 'v1', name: 'Pez Volador', hasProfile: false }],
        }),
      ),
    )
    const { result } = renderHook(() => useCustomerSearch('VENUE', 'pez'), {
      wrapper: AllProviders,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 })
    expect(result.current.data?.[0].id).toBe('v1')
  })
})

// ── Mutations: emisor ─────────────────────────────────────────────────────────

describe('useEmisorActions', () => {
  it('save: guarda el emisor', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: { id: 'e1' } }),
      ),
    )
    const { result } = renderHook(() => useEmisorActions(), { wrapper: AllProviders })
    await expect(
      result.current.save.mutateAsync({
        rfc: 'AVO010101AAA',
        legalName: 'Avoqado',
        regimenFiscal: '601',
        lugarExpedicion: '06000',
      }),
    ).resolves.toMatchObject({ id: 'e1' })
  })

  it('save: onError cuando el server falla', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useEmisorActions(), { wrapper: AllProviders })
    await expect(
      result.current.save.mutateAsync({
        rfc: 'X',
        legalName: 'A',
        regimenFiscal: '601',
        lugarExpedicion: '06000',
      }),
    ).rejects.toThrow()
  })

  it('provision: provisiona en Facturapi', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/emisor/provision`, () =>
        HttpResponse.json({ success: true, data: { id: 'e1' } }),
      ),
    )
    const { result } = renderHook(() => useEmisorActions(), { wrapper: AllProviders })
    await expect(result.current.provision.mutateAsync({})).resolves.toMatchObject({ id: 'e1' })
  })

  it('provision: onError', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/emisor/provision`, () =>
        HttpResponse.json({ message: 'no' }, { status: 422 }),
      ),
    )
    const { result } = renderHook(() => useEmisorActions(), { wrapper: AllProviders })
    await expect(result.current.provision.mutateAsync({})).rejects.toThrow()
  })

  it('uploadCsd: sube el CSD', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/emisor/csd`, () =>
        HttpResponse.json({ success: true, data: { id: 'e1', csdStatus: 'ACTIVE' } }),
      ),
    )
    const { result } = renderHook(() => useEmisorActions(), { wrapper: AllProviders })
    await expect(
      result.current.uploadCsd.mutateAsync({ cerBase64: 'c', keyBase64: 'k', csdPassword: '1' }),
    ).resolves.toMatchObject({ csdStatus: 'ACTIVE' })
  })

  it('uploadCsd: onError', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/emisor/csd`, () =>
        HttpResponse.json({ message: 'bad pass' }, { status: 400 }),
      ),
    )
    const { result } = renderHook(() => useEmisorActions(), { wrapper: AllProviders })
    await expect(
      result.current.uploadCsd.mutateAsync({ cerBase64: 'c', keyBase64: 'k', csdPassword: 'x' }),
    ).rejects.toThrow()
  })
})

// ── Mutations: receptores ─────────────────────────────────────────────────────

describe('useTaxProfileActions', () => {
  it('save: guarda los datos fiscales', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/billing/tax-profiles`, () =>
        HttpResponse.json({ success: true, data: { id: 'tp1' } }),
      ),
    )
    const { result } = renderHook(() => useTaxProfileActions(), { wrapper: AllProviders })
    await expect(
      result.current.save.mutateAsync({
        customerType: 'VENUE',
        venueId: 'v1',
        rfc: 'XAXX010101000',
        razonSocial: 'Demo',
        regimenFiscal: '601',
        codigoPostal: '06000',
      }),
    ).resolves.toMatchObject({ id: 'tp1' })
  })

  it('save: onError', async () => {
    server.use(
      http.put(`${baseURL}/superadmin/billing/tax-profiles`, () =>
        HttpResponse.json({ message: 'rfc inválido' }, { status: 422 }),
      ),
    )
    const { result } = renderHook(() => useTaxProfileActions(), { wrapper: AllProviders })
    await expect(
      result.current.save.mutateAsync({
        customerType: 'STANDALONE',
        rfc: 'X',
        razonSocial: 'Demo',
        regimenFiscal: '601',
        codigoPostal: '06000',
      }),
    ).rejects.toThrow()
  })

  it('attach: sube la constancia', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/tax-profiles/tp1/constancia`, () =>
        HttpResponse.json({ success: true, data: { id: 'tp1', constanciaUrl: 'https://f/x.pdf' } }),
      ),
    )
    const { result } = renderHook(() => useTaxProfileActions(), { wrapper: AllProviders })
    await expect(
      result.current.attach.mutateAsync({
        profileId: 'tp1',
        fileBase64: 'B',
        contentType: 'application/pdf',
      }),
    ).resolves.toMatchObject({ constanciaUrl: 'https://f/x.pdf' })
  })

  it('attach: onError', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/tax-profiles/tp1/constancia`, () =>
        HttpResponse.json({ message: 'no' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useTaxProfileActions(), { wrapper: AllProviders })
    await expect(
      result.current.attach.mutateAsync({ profileId: 'tp1', fileBase64: 'B' }),
    ).rejects.toThrow()
  })
})

// ── Mutations: facturas ───────────────────────────────────────────────────────

describe('useInvoiceActions', () => {
  it('issue: timbra y resuelve con el uuid', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices`, () =>
        HttpResponse.json({ success: true, data: { id: 'c1', uuid: 'UUID-1' } }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(
      result.current.issue.mutateAsync({
        billingTaxProfileId: 'tp1',
        lines: [],
        formaPago: '03',
        metodoPago: 'PUE',
      }),
    ).resolves.toMatchObject({ uuid: 'UUID-1' })
  })

  it('issue: timbra sin uuid (rama del toast sin folio)', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices`, () =>
        HttpResponse.json({ success: true, data: { id: 'c1', uuid: null } }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(
      result.current.issue.mutateAsync({
        billingTaxProfileId: 'tp1',
        lines: [],
        formaPago: '03',
        metodoPago: 'PUE',
      }),
    ).resolves.toMatchObject({ id: 'c1' })
  })

  it('issue: onError', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices`, () =>
        HttpResponse.json({ message: 'PAC' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(
      result.current.issue.mutateAsync({
        billingTaxProfileId: 'tp1',
        lines: [],
        formaPago: '03',
        metodoPago: 'PUE',
      }),
    ).rejects.toThrow()
  })

  it('cancel: cancela el CFDI', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/cancel`, () =>
        HttpResponse.json({ success: true, data: { id: 'c1', status: 'CANCEL_REQUESTED' } }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(
      result.current.cancel.mutateAsync({ id: 'c1', motivo: '02' }),
    ).resolves.toMatchObject({ status: 'CANCEL_REQUESTED' })
  })

  it('cancel: onError', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/cancel`, () =>
        HttpResponse.json({ message: 'no' }, { status: 409 }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(result.current.cancel.mutateAsync({ id: 'c1', motivo: '02' })).rejects.toThrow()
  })

  it('registerPayment: registra el abono y resuelve', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/payments`, () =>
        HttpResponse.json({ success: true, data: { id: 'rep1' } }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(
      result.current.registerPayment.mutateAsync({
        id: 'c1',
        paymentDate: '2026-06-20',
        formaPago: '03',
        amountCents: 50000,
      }),
    ).resolves.toMatchObject({ id: 'rep1' })
  })

  it('registerPayment: onError', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/payments`, () =>
        HttpResponse.json({ message: 'no' }, { status: 422 }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(
      result.current.registerPayment.mutateAsync({
        id: 'c1',
        paymentDate: '2026-06-20',
        formaPago: '03',
      }),
    ).rejects.toThrow()
  })

  it('sendEmail: reenvía el CFDI por correo', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/email`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'c1', emailSentAt: '2026-06-20T00:00:00.000Z' },
        }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(
      result.current.sendEmail.mutateAsync({ id: 'c1', email: 'x@y.com' }),
    ).resolves.toMatchObject({ id: 'c1' })
  })

  it('sendEmail: onError', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/email`, () =>
        HttpResponse.json({ message: 'no' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useInvoiceActions(), { wrapper: AllProviders })
    await expect(result.current.sendEmail.mutateAsync({ id: 'c1' })).rejects.toThrow()
  })
})
