import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { inspectApiError } from './api-error'

const refusal = (status: number, data: unknown) =>
  new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  })

describe('inspectApiError', () => {
  it('a price change waiting on another one (HYBRID_PRICE_BUSY) is named, with the server explanation', () => {
    const message =
      'Otra operación está cambiando el precio de este producto; reintenta en unos segundos.'
    expect(
      inspectApiError(refusal(409, { code: 'HYBRID_PRICE_BUSY', message }), 'guardar el precio'),
    ).toMatchObject({
      status: 409,
      title: 'Otro cambio de precio está en curso',
      description: message,
      serverMessage: message,
    })
  })

  it('any other 409 keeps the generic title', () => {
    expect(inspectApiError(refusal(409, { code: 'OTHER', message: 'x' }))).toMatchObject({
      title: 'Error HTTP 409',
    })
  })
})
