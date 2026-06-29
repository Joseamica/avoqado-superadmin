import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  cancelInvoice,
  downloadInvoiceArtifact,
  fetchEmisor,
  fetchInvoice,
  fetchInvoices,
  fetchTaxProfileById,
  fetchTaxProfileForCustomer,
  issueInvoice,
  provisionEmisor,
  registerPayment,
  searchCustomers,
  sendInvoiceEmail,
  uploadConstancia,
  uploadEmisorCsd,
  upsertEmisor,
  upsertTaxProfile,
} from './api'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchEmisor', () => {
  it('devuelve el emisor configurado', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: { id: 'e1', rfc: 'AVO010101AAA' } }),
      ),
    )
    const r = await fetchEmisor()
    expect(r?.id).toBe('e1')
  })

  it('devuelve null cuando aún no hay emisor', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: null }),
      ),
    )
    expect(await fetchEmisor()).toBeNull()
  })
})

describe('upsertEmisor', () => {
  it('hace PUT con el payload y devuelve el emisor', async () => {
    let body: unknown = null
    server.use(
      http.put(`${baseURL}/superadmin/billing/emisor`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { id: 'e1', rfc: 'AVO010101AAA' } })
      }),
    )
    const r = await upsertEmisor({
      rfc: 'AVO010101AAA',
      legalName: 'Avoqado',
      regimenFiscal: '601',
      lugarExpedicion: '06000',
    })
    expect(body).toMatchObject({ rfc: 'AVO010101AAA', legalName: 'Avoqado' })
    expect(r.id).toBe('e1')
  })
})

describe('provisionEmisor', () => {
  it('postea un body vacío por default', async () => {
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/emisor/provision`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { id: 'e1' } })
      }),
    )
    const r = await provisionEmisor()
    expect(body).toEqual({})
    expect(r.id).toBe('e1')
  })

  it('reenvía providerOrgId/liveKey cuando se vinculan manualmente', async () => {
    let body: Record<string, unknown> | null = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/emisor/provision`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ success: true, data: { id: 'e1' } })
      }),
    )
    await provisionEmisor({ providerOrgId: 'org_1', liveKey: 'sk_live_x' })
    expect(body).toEqual({ providerOrgId: 'org_1', liveKey: 'sk_live_x' })
  })
})

describe('uploadEmisorCsd', () => {
  it('manda los base64 del cer/key + password', async () => {
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/emisor/csd`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { id: 'e1', csdStatus: 'ACTIVE' } })
      }),
    )
    const r = await uploadEmisorCsd({ cerBase64: 'cer', keyBase64: 'key', csdPassword: '1234' })
    expect(body).toEqual({ cerBase64: 'cer', keyBase64: 'key', csdPassword: '1234' })
    expect(r.csdStatus).toBe('ACTIVE')
  })
})

describe('searchCustomers', () => {
  it('reenvía type+q como query y devuelve las filas', async () => {
    let url: URL | null = null
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: [{ type: 'VENUE', id: 'v1', name: 'Pez Volador', hasProfile: true }],
        })
      }),
    )
    const r = await searchCustomers('VENUE', 'pez')
    expect(url!.searchParams.get('type')).toBe('VENUE')
    expect(url!.searchParams.get('q')).toBe('pez')
    expect(r).toHaveLength(1)
  })

  it('devuelve [] cuando data no es un array', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({ success: true }),
      ),
    )
    expect(await searchCustomers(undefined, 'algo')).toEqual([])
  })
})

describe('fetchTaxProfileForCustomer', () => {
  it('arma la ruta con type/id y devuelve el perfil', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v1/tax-profile`, () =>
        HttpResponse.json({ success: true, data: { id: 'tp1', rfc: 'XAXX010101000' } }),
      ),
    )
    const r = await fetchTaxProfileForCustomer('VENUE', 'v1')
    expect(r?.id).toBe('tp1')
  })
})

describe('fetchTaxProfileById', () => {
  it('devuelve el perfil fiscal por id', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/tax-profiles/tp1`, () =>
        HttpResponse.json({ success: true, data: { id: 'tp1' } }),
      ),
    )
    expect((await fetchTaxProfileById('tp1'))?.id).toBe('tp1')
  })
})

describe('upsertTaxProfile', () => {
  it('hace PUT con los datos fiscales del receptor', async () => {
    let body: unknown = null
    server.use(
      http.put(`${baseURL}/superadmin/billing/tax-profiles`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { id: 'tp1' } })
      }),
    )
    const r = await upsertTaxProfile({
      customerType: 'VENUE',
      venueId: 'v1',
      rfc: 'XAXX010101000',
      razonSocial: 'Cliente Demo',
      regimenFiscal: '601',
      codigoPostal: '06000',
    })
    expect(body).toMatchObject({ customerType: 'VENUE', rfc: 'XAXX010101000' })
    expect(r.id).toBe('tp1')
  })
})

describe('uploadConstancia', () => {
  it('postea fileBase64 + contentType a la ruta del perfil', async () => {
    let body: unknown = null
    server.use(
      http.post(
        `${baseURL}/superadmin/billing/tax-profiles/tp1/constancia`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            success: true,
            data: { id: 'tp1', constanciaUrl: 'https://files/x.pdf' },
          })
        },
      ),
    )
    const r = await uploadConstancia('tp1', 'BASE64DATA', 'application/pdf')
    expect(body).toEqual({ fileBase64: 'BASE64DATA', contentType: 'application/pdf' })
    expect(r.constanciaUrl).toBe('https://files/x.pdf')
  })
})

describe('issueInvoice', () => {
  it('postea el payload y devuelve el CFDI timbrado', async () => {
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { id: 'c1', uuid: 'UUID-1', status: 'STAMPED' },
        })
      }),
    )
    const r = await issueInvoice({
      billingTaxProfileId: 'tp1',
      lines: [
        {
          description: 'Mensualidad',
          satProductKey: '43232611',
          satUnitKey: 'E48',
          quantity: 1,
          unitPriceCents: 159900,
        },
      ],
      formaPago: '03',
      metodoPago: 'PUE',
    })
    expect(body).toMatchObject({ billingTaxProfileId: 'tp1', metodoPago: 'PUE' })
    expect(r.uuid).toBe('UUID-1')
  })

  it('propaga el error cuando el PAC rechaza (500)', async () => {
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices`, () =>
        HttpResponse.json({ message: 'PAC error' }, { status: 500 }),
      ),
    )
    await expect(
      issueInvoice({ billingTaxProfileId: 'tp1', lines: [], formaPago: '03', metodoPago: 'PUE' }),
    ).rejects.toThrow()
  })
})

describe('fetchInvoices', () => {
  it('devuelve rows + total y aplica pageSize 100 por default', async () => {
    let url: URL | null = null
    server.use(
      http.get(`${baseURL}/superadmin/billing/invoices`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: [{ id: 'c1' }],
          meta: { total: 1, page: 1, pageSize: 100 },
        })
      }),
    )
    const r = await fetchInvoices()
    expect(url!.searchParams.get('pageSize')).toBe('100')
    expect(r.rows).toHaveLength(1)
    expect(r.total).toBe(1)
  })

  it('respeta filtros + pageSize custom y total 0 cuando no hay meta/data', async () => {
    let url: URL | null = null
    server.use(
      http.get(`${baseURL}/superadmin/billing/invoices`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ success: true, data: 'nope' })
      }),
    )
    const r = await fetchInvoices({ status: 'STAMPED', type: 'INGRESO', pageSize: 25 })
    expect(url!.searchParams.get('status')).toBe('STAMPED')
    expect(url!.searchParams.get('pageSize')).toBe('25')
    expect(r.rows).toEqual([])
    expect(r.total).toBe(0)
  })
})

describe('fetchInvoice', () => {
  it('devuelve el CFDI con sus complementos de pago', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/invoices/c1`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'c1', payments: [{ id: 'rep1', type: 'PAGO' }] },
        }),
      ),
    )
    const r = await fetchInvoice('c1')
    expect(r.id).toBe('c1')
    expect(r.payments?.[0].id).toBe('rep1')
  })
})

describe('registerPayment', () => {
  it('postea fecha + forma + monto del abono (parcialidad)', async () => {
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/payments`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { id: 'rep1', type: 'PAGO' } })
      }),
    )
    const r = await registerPayment('c1', {
      paymentDate: '2026-06-20',
      formaPago: '03',
      amountCents: 50000,
    })
    expect(body).toEqual({ paymentDate: '2026-06-20', formaPago: '03', amountCents: 50000 })
    expect(r.id).toBe('rep1')
  })
})

describe('sendInvoiceEmail', () => {
  it('manda el email custom cuando se especifica', async () => {
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/email`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { id: 'c1', emailSentAt: '2026-06-20T00:00:00.000Z' },
        })
      }),
    )
    const r = await sendInvoiceEmail('c1', 'cliente@demo.com')
    expect(body).toEqual({ email: 'cliente@demo.com' })
    expect(r.emailSentAt).toBeTruthy()
  })

  it('manda un body vacío cuando se omite el email (usa el del receptor)', async () => {
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/email`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { id: 'c1' } })
      }),
    )
    await sendInvoiceEmail('c1')
    expect(body).toEqual({})
  })
})

describe('cancelInvoice', () => {
  it('postea motivo + substituteUuid y devuelve el CFDI', async () => {
    let body: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/billing/invoices/c1/cancel`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { id: 'c1', status: 'CANCEL_REQUESTED' },
        })
      }),
    )
    const r = await cancelInvoice('c1', '01', 'UUID-SUSTITUTO')
    expect(body).toEqual({ motivo: '01', substituteUuid: 'UUID-SUSTITUTO' })
    expect(r.status).toBe('CANCEL_REQUESTED')
  })
})

describe('downloadInvoiceArtifact', () => {
  it('descarga el blob y dispara la descarga del navegador', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    const urlStatics = URL as unknown as {
      createObjectURL: (b: Blob) => string
      revokeObjectURL: (u: string) => void
    }
    urlStatics.createObjectURL = createObjectURL
    urlStatics.revokeObjectURL = revokeObjectURL
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    server.use(
      http.get(`${baseURL}/superadmin/billing/invoices/c1/pdf`, () =>
        HttpResponse.json({ ok: true }),
      ),
    )

    await expect(downloadInvoiceArtifact('c1', 'pdf')).resolves.toBeUndefined()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')

    clickSpy.mockRestore()
  })
})
