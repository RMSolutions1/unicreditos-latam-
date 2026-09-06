/**
 * Interfaz común de proveedor de pago (master prompt §93 "Provider Adapter Pattern").
 * PaymentRouterService decide QUÉ adapter usar; el Credit Engine nunca conoce a Mercado Pago
 * ni a ningún otro proveedor directamente (master prompt §14).
 */
export type CreateCheckoutInput = {
  amount: number
  externalReference: string
  description: string
  payerEmail?: string
  payerFirstName?: string
  payerLastName?: string
  payerDni?: string
}

export type CheckoutResult = {
  initPoint: string
  providerReference: string // preferenceId en Mercado Pago
}

export type ProviderPaymentStatus = {
  providerPaymentId: string
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded' | string
  externalReference: string | null
}

export interface PaymentProvider {
  readonly name: string
  isConfigured(): boolean
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>
  getPayment(providerPaymentId: string): Promise<ProviderPaymentStatus>
  validateWebhookSignature(headers: Record<string, string | undefined>, rawPaymentId: string): boolean
}
