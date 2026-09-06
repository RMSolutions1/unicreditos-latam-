import { Injectable } from '@nestjs/common'
import { DomainError } from '../common/errors/domain-error'
import { MercadoPagoAdapter } from './mercadopago.adapter'
import { AstroPayAdapter } from './astropay.adapter'
import type { CheckoutCapableProvider } from './payment-provider.interface'

export type ProviderName = 'mercadopago' | 'astropay'

/**
 * PaymentRouterService (master prompt §16): el único lugar que sabe qué proveedor usar por
 * país/moneda/preferencia. Decisión de negocio: AstroPay CONVIVE con Mercado Pago para `AR`, no
 * lo reemplaza -- el cliente elige el método al crear el PaymentIntent. Sin preferencia explícita
 * el default sigue siendo Mercado Pago (el único probado de punta a punta en sandbox hasta hoy,
 * ver docs/ROADMAP.md Fase 4).
 *
 * `ENABLE_ASTROPAY` es un kill-switch separado de tener credenciales configuradas: las
 * credenciales que existen hoy autentican contra producción de AstroPay y nunca se probó un pago
 * ni un webhook de punta a punta (endpoints de payments/certificates inferidos por convención,
 * algoritmo de firma RSA-SHA256 sin confirmar contra un callback real). Permite apagar AstroPay
 * al instante sin tocar credenciales ni hacer un deploy de rollback.
 */
@Injectable()
export class PaymentRouterService {
  constructor(
    private readonly mercadoPago: MercadoPagoAdapter,
    private readonly astroPay: AstroPayAdapter,
  ) {}

  resolve(country: string, preferred?: ProviderName): CheckoutCapableProvider {
    if (country !== 'AR') {
      throw new DomainError('PAYMENT_PROVIDER_NOT_SUPPORTED', `No hay un proveedor de pago habilitado para "${country}" todavía.`)
    }

    if (preferred === 'astropay') {
      if (!this.astroPayEnabled()) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'AstroPay no está habilitado.')
      if (!this.astroPay.isConfigured()) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'AstroPay no está configurado.')
      return this.astroPay
    }

    if (!this.mercadoPago.isConfigured()) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'Mercado Pago no está configurado.')
    return this.mercadoPago
  }

  private astroPayEnabled() {
    return (process.env.ENABLE_ASTROPAY ?? 'false').trim().toLowerCase() === 'true'
  }
}
