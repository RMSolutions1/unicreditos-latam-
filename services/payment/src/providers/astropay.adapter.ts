import { Injectable } from '@nestjs/common'
import { createVerify } from 'node:crypto'
import { DomainError } from '../common/errors/domain-error'
import { JsonLogger } from '../logging/json-logger.service'
import type { CheckoutResult, CreateCheckoutInput, ProviderPaymentStatus } from './payment-provider.interface'

type AstroPayCertificate = { serial_number: string; certificate: string }

/**
 * AstroPay Checkout (Offsite) -- docs reales: https://developers-wallet.astropay.com/docs/accept-astropay
 * No implementa PaymentProvider: su verificación de webhook es async (necesita traer certificados
 * por HTTP) y firma el BODY completo, no solo un id como Mercado Pago -- no entra en esa interfaz
 * síncrona sin forzarla. PaymentsService la usa directo, igual que ya hace con MercadoPagoAdapter
 * para sus métodos específicos de webhook.
 */
@Injectable()
export class AstroPayAdapter {
  readonly name = 'astropay'
  private cachedToken: { accessToken: string; expiresAt: number } | null = null

  constructor(private readonly logger: JsonLogger) {}

  private clientId() {
    return process.env.ASTROPAY_CLIENT_ID?.trim() ?? ''
  }

  private clientSecret() {
    return process.env.ASTROPAY_CLIENT_SECRET?.trim() ?? ''
  }

  /**
   * Confirmado en vivo contra sandbox real (docs/ROADMAP.md Fase 4, 2026-09-06): un único host
   * sirve auth, certificados Y pagos -- NO hay split sandbox/producción por subdominio como decía
   * la tabla "Environments" de la doc (`partners-api-sandbox.astropay.com` devuelve 401 con
   * credenciales de sandbox válidas; `api.astropay.com`/`api-sandbox.astropay.com` no responden o
   * son bloqueados por un WAF). Lo que sí diferencia sandbox de producción es el propio App
   * ID/Secret Key -- cada set de credenciales ya apunta a su ambiente en el backend de AstroPay.
   */
  private baseUrl() {
    return process.env.ASTROPAY_BASE_URL?.trim() || 'https://partners-api.astropay.com'
  }

  isConfigured() {
    return Boolean(this.clientId() && this.clientSecret())
  }

  private siteBase() {
    return (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '')
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.cachedToken && this.cachedToken.expiresAt - 60_000 > now) return this.cachedToken.accessToken

    const clientId = this.clientId()
    const clientSecret = this.clientSecret()
    if (!clientId || !clientSecret) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'AstroPay no está configurado.')

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    let response: Response
    try {
      response = await fetch(`${this.baseUrl()}/v1/partners/oauth/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      })
    } catch (error) {
      throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'AstroPay no respondió.')
    }
    if (!response.ok) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', `AstroPay rechazó la autenticación (${response.status}).`)

    const data = (await response.json()) as { access_token?: string; expires_in?: number | string }
    if (!data.access_token) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'AstroPay no devolvió un access_token.')

    const expiresInMs = Number(data.expires_in ?? 3600) * 1000
    this.cachedToken = { accessToken: data.access_token, expiresAt: now + expiresInMs }
    return data.access_token
  }

  /**
   * Corregido contra la referencia autoritativa real ("Platform → Payments", no la guía prosa de
   * "Accept AstroPay → Checkout" que se leyó primero y que no lista `method` como campo -- las dos
   * páginas de AstroPay describen el mismo endpoint de forma inconsistente entre sí). El 400
   * `{"method":"is required"}` que devolvió sandbox confirma que esta es la que manda.
   * `order.id` es la referencia documentada (no `merchant_payment_id` a nivel raíz); el callback
   * de todas formas devuelve `merchant_payment_id` -- se asume que AstroPay lo completa desde
   * `order.id`, pendiente de confirmar contra un callback real.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const token = await this.getAccessToken()
    const body: Record<string, unknown> = {
      method: 'CHECKOUT',
      amount: Number(input.amount),
      currency: 'ARS',
      country: 'AR',
      order: { id: input.externalReference },
      redirect_success_url: `${this.siteBase()}/cuenta?astropay_status=success`,
      redirect_error_url: `${this.siteBase()}/cuenta?astropay_status=error`,
    }
    const notificationUrl = process.env.ASTROPAY_NOTIFICATION_URL?.trim()
    if (notificationUrl?.startsWith('https://')) body.callback_notification = notificationUrl
    if (input.payerEmail) body.user = { email: input.payerEmail }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl()}/v1/payments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'AstroPay no respondió.')
    }
    if (!response.ok) {
      // El detalle crudo de AstroPay queda solo en el log del servidor -- nunca en la respuesta al
      // cliente (hallazgo de la auditoría de Fase 4: filtraba el body de error del proveedor).
      const detail = await response.text().catch(() => '')
      this.logger.error(`AstroPay rechazó la creación del pago (${response.status}): ${detail}`, undefined, 'AstroPayAdapter')
      throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', `AstroPay rechazó la creación del pago (${response.status}).`)
    }

    const data = (await response.json()) as { redirect_url?: string; payment_external_id?: string }
    if (!data.redirect_url) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'AstroPay no devolvió un checkout válido.')
    return { initPoint: data.redirect_url, providerReference: data.payment_external_id ?? input.externalReference }
  }

  /**
   * `GET /v1/payments/{paymentId}?method=CHECKOUT` -- documentado en la misma página autoritativa
   * "Platform → Payments" que reveló el campo `method` de createCheckout. No se usa en el flujo de
   * webhook (el callback de AstroPay ya trae el estado completo) pero queda real para reconciliación
   * manual, igual que MercadoPagoAdapter.getPayment.
   */
  async getPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const token = await this.getAccessToken()
    let response: Response
    try {
      response = await fetch(`${this.baseUrl()}/v1/payments/${encodeURIComponent(providerPaymentId)}?method=CHECKOUT`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (error) {
      throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'AstroPay no respondió.')
    }
    if (!response.ok) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', `AstroPay rechazó la consulta de pago (${response.status}).`)

    const data = (await response.json()) as { payment_id?: string; status?: string; merchant_payment_id?: string }
    return {
      providerPaymentId: data.payment_id ?? providerPaymentId,
      status: String(data.status ?? 'unknown').toLowerCase(),
      externalReference: data.merchant_payment_id ?? null,
    }
  }

  private async getCertificates(): Promise<AstroPayCertificate[]> {
    const token = await this.getAccessToken()
    let response: Response
    try {
      response = await fetch(`${this.baseUrl()}/v1/certificates`, { headers: { Authorization: `Bearer ${token}` } })
    } catch {
      return []
    }
    if (!response.ok) return []
    const data = (await response.json()) as { certificates?: AstroPayCertificate[] }
    return data.certificates ?? []
  }

  /**
   * Fail-closed (mismo criterio que Mercado Pago, docs/SECURITY.md §2): sin firma, sin certificado
   * que matchee, o sin poder verificar, el webhook se rechaza siempre.
   *
   * Requiere el BODY CRUDO (bytes exactos), no el objeto re-serializado -- AstroPay firma
   * "requestId:timestamp:body" tal cual lo envió. El algoritmo (RSA-SHA256) es una inferencia
   * razonable de "RSA-based signature" -- los docs no lo nombran explícito -- y queda por
   * confirmar contra un callback real de sandbox antes de confiar en esto en producción.
   */
  async verifyCallbackSignature(headers: Record<string, string | undefined>, rawBody: string): Promise<boolean> {
    const signatureB64 = headers['partner-signature']
    const requestId = headers['partner-request-id']
    const timestamp = headers['partner-request-time']
    const serialNumber = headers['partner-certificate-serial-number']
    if (!signatureB64 || !requestId || !timestamp || !serialNumber) return false

    const certificates = await this.getCertificates()
    const cert = certificates.find((c) => c.serial_number === serialNumber)
    if (!cert) return false

    const signedString = `${requestId}:${timestamp}:${rawBody}`
    try {
      const verifier = createVerify('RSA-SHA256')
      verifier.update(signedString)
      verifier.end()
      return verifier.verify(cert.certificate, signatureB64, 'base64')
    } catch {
      return false
    }
  }
}
