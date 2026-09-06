import { Injectable } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import { DomainError } from '../common/errors/domain-error'
import type { CheckoutResult, CreateCheckoutInput, PaymentProvider, ProviderPaymentStatus } from './payment-provider.interface'

@Injectable()
export class MercadoPagoAdapter implements PaymentProvider {
  readonly name = 'mercadopago'

  private accessToken() {
    return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? ''
  }

  isConfigured() {
    return Boolean(this.accessToken())
  }

  private clients() {
    const accessToken = this.accessToken()
    if (!accessToken) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'Mercado Pago no está configurado.')
    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } })
    return { preference: new Preference(client), payment: new Payment(client) }
  }

  private siteBase() {
    return (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '')
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const { preference } = this.clients()
    const success = `${this.siteBase()}/cuenta?mp_status=success`
    const notify = (process.env.MERCADO_PAGO_NOTIFICATION_URL || '').trim()

    const body: Record<string, unknown> = {
      items: [{ id: input.externalReference, title: input.description, quantity: 1, unit_price: Number(input.amount), currency_id: 'ARS' }],
      external_reference: input.externalReference,
      back_urls: { success, failure: `${this.siteBase()}/cuenta?mp_status=failure`, pending: `${this.siteBase()}/cuenta?mp_status=pending` },
      statement_descriptor: 'UNICRED PAGO CUOTA',
      metadata: { platform: 'unicreditos' },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    }
    if (notify.startsWith('https://')) body.notification_url = notify
    if (success.startsWith('https://')) body.auto_return = 'approved'
    if (input.payerEmail) {
      body.payer = {
        email: input.payerEmail,
        first_name: input.payerFirstName,
        last_name: input.payerLastName,
        identification: input.payerDni ? { type: 'DNI', number: input.payerDni } : undefined,
      }
    }

    let pref
    try {
      pref = await preference.create({ body: body as never })
    } catch (error) {
      throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'Mercado Pago no respondió.')
    }

    const useSandbox = this.accessToken().startsWith('TEST-')
    const initPoint = (useSandbox && pref.sandbox_init_point ? pref.sandbox_init_point : null) ?? pref.init_point
    if (!pref.id || !initPoint) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'Mercado Pago no devolvió un checkout válido.')
    return { initPoint, providerReference: pref.id }
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const { payment } = this.clients()
    let result
    try {
      result = await payment.get({ id: providerPaymentId })
    } catch (error) {
      throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'Mercado Pago no respondió.')
    }
    return {
      providerPaymentId: String(result.id ?? providerPaymentId),
      status: String(result.status ?? 'unknown'),
      externalReference: (result.external_reference as string | undefined) ?? null,
    }
  }

  /**
   * Fail-closed (docs/SECURITY.md §2, hallazgo #3 de la auditoría del prototipo): sin secret o
   * sin firma, el webhook se rechaza siempre.
   */
  validateWebhookSignature(headers: Record<string, string | undefined>, dataId: string): boolean {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()
    const xSignature = headers['x-signature']
    const requestId = headers['x-request-id'] ?? ''
    if (!secret || !xSignature || !dataId) return false

    const parts = new Map<string, string>()
    xSignature.split(',').forEach((part) => {
      const [k, v] = part.split('=', 2)
      if (k && v !== undefined) parts.set(k.trim(), v)
    })
    const ts = parts.get('ts')
    const v1 = parts.get('v1')
    if (!ts || !v1) return false

    const expected = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts}`).digest('hex')
    try {
      const a = Buffer.from(expected)
      const b = Buffer.from(v1)
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  }
}
