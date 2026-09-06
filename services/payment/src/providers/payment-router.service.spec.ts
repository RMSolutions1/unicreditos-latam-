import { PaymentRouterService } from './payment-router.service'
import { MercadoPagoAdapter } from './mercadopago.adapter'
import { AstroPayAdapter } from './astropay.adapter'
import { JsonLogger } from '../logging/json-logger.service'
import { DomainError } from '../common/errors/domain-error'

describe('PaymentRouterService', () => {
  let mercadoPago: MercadoPagoAdapter
  let astroPay: AstroPayAdapter
  let router: PaymentRouterService

  beforeEach(() => {
    delete process.env.ENABLE_ASTROPAY
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN
    delete process.env.ASTROPAY_CLIENT_ID
    delete process.env.ASTROPAY_CLIENT_SECRET
    mercadoPago = new MercadoPagoAdapter()
    astroPay = new AstroPayAdapter(new JsonLogger())
    router = new PaymentRouterService(mercadoPago, astroPay)
  })

  it('rechaza cualquier país que no sea AR', () => {
    expect(() => router.resolve('MX')).toThrow(DomainError)
  })

  it('sin preferencia y con Mercado Pago configurado, devuelve Mercado Pago', () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-token'
    expect(router.resolve('AR').name).toBe('mercadopago')
  })

  it('sin Mercado Pago configurado, falla explícito en vez de caer a AstroPay silenciosamente', () => {
    expect(() => router.resolve('AR')).toThrow(DomainError)
  })

  it('con preferencia astropay pero ENABLE_ASTROPAY=false, rechaza aunque haya credenciales', () => {
    process.env.ASTROPAY_CLIENT_ID = 'id'
    process.env.ASTROPAY_CLIENT_SECRET = 'secret'
    expect(() => router.resolve('AR', 'astropay')).toThrow(DomainError)
  })

  it('con ENABLE_ASTROPAY=true pero sin credenciales, rechaza', () => {
    process.env.ENABLE_ASTROPAY = 'true'
    expect(() => router.resolve('AR', 'astropay')).toThrow(DomainError)
  })

  it('con ENABLE_ASTROPAY=true y credenciales configuradas, devuelve AstroPay', () => {
    process.env.ENABLE_ASTROPAY = 'true'
    process.env.ASTROPAY_CLIENT_ID = 'id'
    process.env.ASTROPAY_CLIENT_SECRET = 'secret'
    expect(router.resolve('AR', 'astropay').name).toBe('astropay')
  })
})
