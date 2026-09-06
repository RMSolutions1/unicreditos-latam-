import { generateKeyPairSync, createSign } from 'node:crypto'
import { AstroPayAdapter } from './astropay.adapter'
import { JsonLogger } from '../logging/json-logger.service'

/**
 * Prueba real de la lógica de verificación (no un mock del comportamiento de AstroPay): se genera
 * un par de claves RSA propio, se firma la cadena tal como la firmaría AstroPay, y se verifica que
 * AstroPayAdapter.verifyCallbackSignature acepte una firma válida y rechace cualquier alteración
 * (header faltante, certificado que no matchea, o body/firma manipulados) -- fail-closed real.
 */
describe('AstroPayAdapter.verifyCallbackSignature', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const serialNumber = 'test-serial-001'
  const rawBody = JSON.stringify({ payment_external_id: 'PAY-1', merchant_payment_id: 'UNI-PAY-1', payment_status: 'COMPLETED' })
  const requestId = 'req-123'
  const timestamp = '2026-09-06T12:00:00Z'

  function sign(signedString: string) {
    return createSign('RSA-SHA256').update(signedString).sign(privateKey, 'base64')
  }

  function headersFor(overrides: Partial<Record<string, string>> = {}) {
    return {
      'partner-signature': sign(`${requestId}:${timestamp}:${rawBody}`),
      'partner-request-id': requestId,
      'partner-request-time': timestamp,
      'partner-certificate-serial-number': serialNumber,
      ...overrides,
    }
  }

  let adapter: AstroPayAdapter
  let fetchMock: jest.Mock

  beforeEach(() => {
    process.env.ASTROPAY_CLIENT_ID = 'test-client'
    process.env.ASTROPAY_CLIENT_SECRET = 'test-secret'
    process.env.ASTROPAY_BASE_URL = 'https://astropay.test'
    adapter = new AstroPayAdapter(new JsonLogger())

    fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as Response
      }
      if (url.includes('/v1/certificates')) {
        return { ok: true, json: async () => ({ certificates: [{ serial_number: serialNumber, certificate: publicKey }] }) } as Response
      }
      throw new Error(`unexpected fetch to ${url}`)
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('acepta una firma válida', async () => {
    const valid = await adapter.verifyCallbackSignature(headersFor(), rawBody)
    expect(valid).toBe(true)
  })

  it('rechaza si falta cualquiera de los headers de firma', async () => {
    const headers = headersFor()
    for (const key of Object.keys(headers)) {
      const partial = { ...headers, [key]: undefined }
      expect(await adapter.verifyCallbackSignature(partial, rawBody)).toBe(false)
    }
  })

  it('rechaza si el serial number no matchea ningún certificado', async () => {
    const valid = await adapter.verifyCallbackSignature(headersFor({ 'partner-certificate-serial-number': 'otro-serial' }), rawBody)
    expect(valid).toBe(false)
  })

  it('rechaza si el body fue alterado después de firmarlo', async () => {
    const tamperedBody = JSON.stringify({ payment_external_id: 'PAY-1', merchant_payment_id: 'UNI-PAY-1', payment_status: 'REJECTED' })
    const valid = await adapter.verifyCallbackSignature(headersFor(), tamperedBody)
    expect(valid).toBe(false)
  })

  it('rechaza si la firma en sí fue alterada', async () => {
    const valid = await adapter.verifyCallbackSignature(headersFor({ 'partner-signature': 'AAAA' }), rawBody)
    expect(valid).toBe(false)
  })
})
