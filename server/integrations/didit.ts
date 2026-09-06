import { createHmac, timingSafeEqual } from 'node:crypto'

const DIDIT_API = 'https://verification.didit.me'

export function isDiditConfigured() {
  return Boolean(process.env.DIDIT_API_KEY?.trim())
}

function apiKey() {
  const key = process.env.DIDIT_API_KEY?.trim()
  if (!key) throw new Error('Falta DIDIT_API_KEY')
  return key
}

async function diditFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DIDIT_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey(),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const json = (await res.json().catch(() => ({}))) as T & { detail?: string }
  if (!res.ok) throw new Error(json.detail || `Didit ${res.status}`)
  return json
}

export async function createDiditSession(input: {
  vendorData: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  dni?: string
}) {
  const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim()
  if (!workflowId) throw new Error('Falta DIDIT_WORKFLOW_ID')
  const site = (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
  const session = await diditFetch<{ session_id?: string; url?: string; verification_url?: string }>('/v3/session/', {
    method: 'POST',
    body: JSON.stringify({
      workflow_id: workflowId,
      callback: `${site}/cuenta?kyc=didit`,
      vendor_data: input.vendorData,
      language: 'es',
      contact_details: { email: input.email, phone: input.phone },
      expected_details: {
        first_name: input.firstName,
        last_name: input.lastName,
        identification_number: input.dni,
      },
    }),
  })
  const sessionId = session.session_id
  const url = session.url || session.verification_url
  if (!sessionId || !url) throw new Error('Didit no devolvió la sesión')
  return { sessionId, url, workflowId }
}

export function mapDiditStatus(status: string) {
  if (status === 'Approved') return 'approved' as const
  if (status === 'Declined') return 'rejected' as const
  if (['In Review', 'Resubmitted', 'In Progress', 'Awaiting User'].includes(status)) return 'reviewing' as const
  return 'pending' as const
}

export function validateDiditWebhook(rawBody: string, signature: string | undefined) {
  const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim()
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const diditStatus = {
  configured: isDiditConfigured(),
  workflow: Boolean(process.env.DIDIT_WORKFLOW_ID?.trim()),
  webhook: Boolean(process.env.DIDIT_WEBHOOK_SECRET?.trim()),
}
