import { Injectable } from '@nestjs/common'
import { createVerify } from 'node:crypto'
import { DomainError } from '../common/errors/domain-error'
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

  private clientId() {
    return process.env.ASTROPAY_CLIENT_ID?.trim() ?? ''
  }

  private clientSecret() {
    return process.env.ASTROPAY_CLIENT_SECRET?.trim() ?? ''
  }

  private isSandbox() {
    return (process.env.ASTROPAY_ENV ?? 'sandbox').trim().toLowerCase() !== 'production'
  }

  /** Hosts documentados solo para el endpoint de auth; el resto se infiere por convención y se
   * confirma la primera vez que se pruebe contra sandbox real (docs/ROADMAP.md Fase 4). */
  private authBaseUrl() {
    return process.env.ASTROPAY_AUTH_BASE_URL?.trim() || (this.isSandbox() ? 'https://partners-api-sandbox.astropay.com' : 'https://partners-api.astropay.com')
  }

  private apiBaseUrl() {
    return process.env.ASTROPAY_API_BASE_URL?.trim() || (this.isSandbox() ? 'https://api-sandbox.astropay.com' : 'https://api.astropay.com')
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
      response = await fetch(`${this.authBaseUrl()}/v1/partners/oauth/token`, {
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

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const token = await this.getAccessToken()
    const body: Record<string, unknown> = {
      amount: Number(input.amount),
      currency: 'ARS',
      country: 'AR',
      merchant_payment_id: input.externalReference,
      redirect_success_url: `${this.siteBase()}/cuenta?astropay_status=success`,
      redirect_error_url: `${this.siteBase()}/cuenta?astropay_status=error`,
    }
    if (input.payerEmail) body.user = { email: input.payerEmail, merchant_user_id: input.externalReference }

    let response: Response
    try {
      response = await fetch(`${this.apiBaseUrl()}/v1/payments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'AstroPay no respondió.')
    }
    if (!response.ok) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', `AstroPay rechazó la creación del pago (${response.status}).`)

    const data = (await response.json()) as { redirect_url?: string; payment_external_id?: string }
    if (!data.redirect_url) throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'AstroPay no devolvió un checkout válido.')
    return { initPoint: data.redirect_url, providerReference: data.payment_external_id ?? input.externalReference }
  }

  /**
   * No hay endpoint documentado de "consultar pago por id" para Checkout (a diferencia de
   * Mercado Pago) -- el estado final llega completo en el callback. Falla explícito en vez de
   * inventar una ruta que no está en la documentación real.
   */
  async getPayment(_providerPaymentId: string): Promise<ProviderPaymentStatus> {
    throw new DomainError('PAYMENT_PROVIDER_UNAVAILABLE', 'AstroPay no expone una consulta de pago por ID; el estado llega completo por webhook.')
  }

  private async getCertificates(): Promise<AstroPayCertificate[]> {
    const token = await this.getAccessToken()
    let response: Response
    try {
      response = await fetch(`${this.apiBaseUrl()}/v1/certificates`, { headers: { Authorization: `Bearer ${token}` } })
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
