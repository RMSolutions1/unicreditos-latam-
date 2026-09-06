import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? ''
const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? ''
const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY || process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || ''

export function isMercadoPagoConfigured() {
  return Boolean(accessToken.trim())
}

export function mercadoPagoPublicKey() {
  return publicKey || null
}

function clients() {
  if (!accessToken) return null
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } })
  return { preference: new Preference(client), payment: new Payment(client) }
}

function siteBase() {
  return (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
}

export async function createCheckout(input: {
  amount: number
  userId: string
  description: string
  externalReference?: string
  email?: string
  firstName?: string
  lastName?: string
  dni?: string
  channel?: 'all' | 'ticket' | 'account_money'
}) {
  const c = clients()
  if (!c) throw new Error('Mercado Pago no está configurado')
  const externalReference = input.externalReference ?? `UNI-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6)}`
  const success = `${siteBase()}/cuenta?mp_status=success`
  const body: Record<string, unknown> = {
    items: [
      {
        id: externalReference,
        title: input.description,
        quantity: 1,
        unit_price: Number(input.amount),
        currency_id: 'ARS',
      },
    ],
    external_reference: externalReference,
    back_urls: { success, failure: `${siteBase()}/cuenta?mp_status=failure`, pending: `${siteBase()}/cuenta?mp_status=pending` },
    statement_descriptor: 'UNICRED PAGO CUOTA',
    metadata: { user_id: input.userId, platform: 'unicreditos-web', channel: input.channel || 'all' },
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    binary_mode: input.channel !== 'ticket' && input.channel !== 'all',
  }
  const notify = (process.env.MERCADO_PAGO_NOTIFICATION_URL || '').trim()
  if (notify.startsWith('https://')) body.notification_url = notify
  if (success.startsWith('https://')) body.auto_return = 'approved'
  if (input.email) {
    body.payer = {
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      identification: input.dni ? { type: 'DNI', number: input.dni } : undefined,
    }
  }
  const pref = await c.preference.create({ body: body as never })
  const useSandbox = accessToken.startsWith('TEST-')
  const initPoint = (useSandbox && pref.sandbox_init_point ? pref.sandbox_init_point : null) ?? pref.init_point
  if (!pref.id || !initPoint) throw new Error('Mercado Pago no devolvió el checkout')
  return { preferenceId: pref.id, initPoint, sandboxInitPoint: pref.sandbox_init_point, externalReference }
}

export async function getPayment(id: string) {
  const c = clients()
  if (!c) throw new Error('Mercado Pago no está configurado')
  return c.payment.get({ id })
}

export function validateWebhookSignature(headers: { 'x-signature'?: string; 'x-request-id'?: string }, body: { data?: { id?: string }; id?: string }) {
  if (!webhookSecret) return false
  const xSig = headers['x-signature']
  if (!xSig) return false
  const parts = new Map<string, string>()
  xSig.split(',').forEach((part) => {
    const [k, v] = part.split('=', 2)
    if (k && v !== undefined) parts.set(k.trim(), v)
  })
  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  const dataId = body?.data?.id ?? body?.id
  const requestId = headers['x-request-id'] ?? ''
  if (!ts || !v1 || !dataId) return false
  const expected = createHmac('sha256', webhookSecret).update(`id:${dataId};request-id:${requestId};ts:${ts}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const mpStatus = {
  configured: isMercadoPagoConfigured(),
  test: accessToken.startsWith('TEST-'),
  webhook: Boolean(webhookSecret),
  publicKey: Boolean(publicKey),
}
