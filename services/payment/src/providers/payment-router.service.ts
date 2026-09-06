import { Injectable } from '@nestjs/common'
import { DomainError } from '../common/errors/domain-error'
import { MercadoPagoAdapter } from './mercadopago.adapter'
import type { PaymentProvider } from './payment-provider.interface'

/**
 * PaymentRouterService (master prompt §16): el único lugar que sabe qué proveedor usar por
 * país/moneda. Nuevos proveedores se agregan acá sin tocar el Credit Engine ni los controllers.
 * AstroPay queda listo para sumarse cuando exista ENABLE_ASTROPAY=true y credenciales reales —
 * no se inventa su integración sin documentación real (docs/ARCHITECTURE.md §9).
 */
@Injectable()
export class PaymentRouterService {
  constructor(private readonly mercadoPago: MercadoPagoAdapter) {}

  resolve(country: string): PaymentProvider {
    if (country === 'AR') {
      if (!this.mercadoPago.isConfigured()) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'Mercado Pago no está configurado.')
      return this.mercadoPago
    }
    throw new DomainError('PAYMENT_PROVIDER_NOT_SUPPORTED', `No hay un proveedor de pago habilitado para "${country}" todavía.`)
  }
}
