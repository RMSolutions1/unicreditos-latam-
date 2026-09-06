import { PaymentRouterService } from './payment-router.service'
import type { MercadoPagoAdapter } from './mercadopago.adapter'
import type { AstroPayAdapter } from './astropay.adapter'

function buildRouter(mpConfigured: boolean, astroConfigured: boolean) {
  const mercadoPago = { name: 'mercadopago', isConfigured: () => mpConfigured } as unknown as MercadoPagoAdapter
  const astroPay = { name: 'astropay', isConfigured: () => astroConfigured } as unknown as AstroPayAdapter
  return new PaymentRouterService(mercadoPago, astroPay)
}

describe('PaymentRouterService', () => {
  const originalEnv = process.env.ENABLE_ASTROPAY

  afterEach(() => {
    process.env.ENABLE_ASTROPAY = originalEnv
  })

  it('sin preferencia, resuelve a Mercado Pago (default)', () => {
    const router = buildRouter(true, true)
    expect(router.resolve('AR').name).toBe('mercadopago')
  })

  it('con preferencia explícita "mercadopago", resuelve a Mercado Pago', () => {
    const router = buildRouter(true, true)
    expect(router.resolve('AR', 'mercadopago').name).toBe('mercadopago')
  })

  it('con preferencia "astropay" y ENABLE_ASTROPAY=true, resuelve a AstroPay -- conviven', () => {
    process.env.ENABLE_ASTROPAY = 'true'
    const router = buildRouter(true, true)
    expect(router.resolve('AR', 'astropay').name).toBe('astropay')
  })

  it('con preferencia "astropay" pero ENABLE_ASTROPAY=false (default), rechaza aunque haya credenciales', () => {
    delete process.env.ENABLE_ASTROPAY
    const router = buildRouter(true, true)
    expect(() => router.resolve('AR', 'astropay')).toThrow('AstroPay no está habilitado.')
  })

  it('con preferencia "astropay", ENABLE_ASTROPAY=true pero sin credenciales, rechaza', () => {
    process.env.ENABLE_ASTROPAY = 'true'
    const router = buildRouter(true, false)
    expect(() => router.resolve('AR', 'astropay')).toThrow('AstroPay no está configurado.')
  })

  it('sin preferencia y Mercado Pago no configurado, rechaza (no hace fallback silencioso a AstroPay)', () => {
    process.env.ENABLE_ASTROPAY = 'true'
    const router = buildRouter(false, true)
    expect(() => router.resolve('AR')).toThrow('Mercado Pago no está configurado.')
  })

  it('país no soportado, rechaza sin importar preferencia', () => {
    const router = buildRouter(true, true)
    expect(() => router.resolve('BR')).toThrow('No hay un proveedor de pago habilitado para "BR" todavía.')
  })
})
