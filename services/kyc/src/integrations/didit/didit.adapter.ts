import { Injectable } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { DomainError } from '../../common/errors/domain-error'

const DIDIT_API = 'https://verification.didit.me'

export type DiditSessionInput = {
  vendorData: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  dni?: string
}

/**
 * Adapter de Didit (docs/API.md, master prompt §27). Nunca guarda imágenes biométricas —
 * solo el resultado normalizado mínimo (ver docs/SECURITY.md §4).
 */
@Injectable()
export class DiditAdapter {
  isConfigured() {
    return Boolean(process.env.DIDIT_API_KEY?.trim() && process.env.DIDIT_WORKFLOW_ID?.trim())
  }

  private apiKey() {
    const key = process.env.DIDIT_API_KEY?.trim()
    if (!key) throw new DomainError('KYC_NOT_CONFIGURED', 'Didit no está configurado.')
    return key
  }

  private async fetchJson<T extends Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${DIDIT_API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'x-api-key': this.apiKey(),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    const json = (await response.json().catch(() => ({}))) as T & { detail?: string }
    if (!response.ok) throw new DomainError('KYC_PROVIDER_UNAVAILABLE', json.detail || `Didit respondió ${response.status}`)
    return json
  }

  async createSession(input: DiditSessionInput) {
    if (!this.isConfigured()) throw new DomainError('KYC_NOT_CONFIGURED', 'Didit no está configurado.')
    const workflowId = process.env.DIDIT_WORKFLOW_ID!.trim()
    const site = (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')

    const session = await this.fetchJson<{ session_id?: string; url?: string; verification_url?: string }>('/v3/session/', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId,
        callback: `${site}/cuenta?kyc=didit`,
        vendor_data: input.vendorData,
        language: 'es',
        contact_details: { email: input.email, phone: input.phone },
        expected_details: { first_name: input.firstName, last_name: input.lastName, identification_number: input.dni },
      }),
    })

    const sessionId = session.session_id
    const url = session.url || session.verification_url
    if (!sessionId || !url) throw new DomainError('KYC_PROVIDER_UNAVAILABLE', 'Didit no devolvió una sesión válida.')
    return { sessionId, url }
  }

  mapStatus(status: string): 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' {
    if (status === 'Approved') return 'APPROVED'
    if (status === 'Declined') return 'REJECTED'
    if (['In Review', 'Resubmitted', 'In Progress', 'Awaiting User'].includes(status)) return 'IN_PROGRESS'
    return 'PENDING'
  }

  /**
   * Fail-closed (docs/SECURITY.md §2, hallazgo #3 de la auditoría del prototipo): si falta el
   * secret o la firma, el webhook se rechaza. Nunca se procesa "porque total nadie lo va a probar".
   */
  validateWebhook(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim()
    if (!secret || !signature) return false
    try {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
      const a = Buffer.from(expected)
      const b = Buffer.from(signature)
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  }
}
