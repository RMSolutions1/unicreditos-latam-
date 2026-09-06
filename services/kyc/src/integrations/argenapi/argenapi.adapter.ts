import { Injectable } from '@nestjs/common'
import { DomainError } from '../../common/errors/domain-error'

type LookupResult = {
  ok: boolean
  status: 'success' | 'not_found' | 'api_error' | 'missing_key' | 'invalid_format'
  message?: string
  data?: { cbu?: string; cvu?: string; alias?: string; entidad?: string; titular?: string; cuit?: string; activa?: boolean }
}

function cleanCbu(input: string) {
  return (input || '').replace(/\D/g, '').slice(0, 22)
}

/**
 * Adapter de ArgenAPI (docs/API.md, master prompt §30). En el prototipo este endpoint no
 * requería autenticación (hallazgo #4 de la auditoría) — acá el controller exige JWT.
 */
@Injectable()
export class ArgenApiAdapter {
  private baseUrl() {
    return (process.env.ARGENAPI_BASE_URL ?? 'https://www.argenapi.com/api/v1').replace(/\/$/, '')
  }

  isConfigured() {
    return Boolean(process.env.ARGENAPI_API_KEY?.trim())
  }

  async validate(raw: string): Promise<LookupResult> {
    const digits = cleanCbu(raw)
    if (/^\d{22}$/.test(digits)) return this.lookup(digits, 'cbu')
    const alias = raw.trim().toLowerCase()
    if (alias.length >= 6 && alias.length <= 20 && !alias.includes('@')) return this.lookup(alias, 'alias')
    return { ok: false, status: 'invalid_format', message: 'Ingresá un CBU/CVU de 22 dígitos o un alias Coelsa.' }
  }

  private async lookup(identifier: string, type: 'cbu' | 'alias'): Promise<LookupResult> {
    if (!this.isConfigured()) return { ok: false, status: 'missing_key', message: 'ARGENAPI_API_KEY no configurada.' }

    const apiKey = process.env.ARGENAPI_API_KEY!.trim()
    const timeoutMs = Number(process.env.ARGENAPI_TIMEOUT_MS ?? 10000)
    let response: Response
    try {
      response = await fetch(`${this.baseUrl()}/lookup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, identifier_type: type }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new DomainError('BANK_PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'ArgenAPI no disponible.')
    }

    const json = (await response.json().catch(() => null)) as Record<string, any> | null
    const payload = (json?.data && typeof json.data === 'object' ? json.data : json) as Record<string, any> | null
    const hasAccount = Boolean(payload && (payload.bank || payload.holders || payload.cbu || payload.cvu || payload.account || payload.titular))

    if (!response.ok || !payload || !hasAccount) {
      return {
        ok: false,
        status: response.status === 404 || response.ok ? 'not_found' : 'api_error',
        message: String(json?.message || json?.error || json?.detail || (response.ok ? 'CBU/alias no encontrado.' : `HTTP ${response.status}`)),
      }
    }

    const holder = Array.isArray(payload.holders) ? payload.holders[0] : null
    const bank = payload.bank ?? {}
    const account = payload.account ?? {}
    const number = String(account.number || payload.cbu || payload.cvu || '')
    const scheme = String(account.scheme || '').toUpperCase()

    return {
      ok: true,
      status: 'success',
      data: {
        cbu: scheme === 'CVU' ? undefined : cleanCbu(number || payload.cbu || ''),
        cvu: scheme === 'CVU' ? cleanCbu(number || payload.cvu || '') : payload.cvu,
        alias: payload.alias,
        entidad: bank.name || payload.entidad || payload.banco || '',
        titular: holder?.full_name || payload.titular || '',
        cuit: holder?.tax_id || payload.cuit || payload.cuil || '',
        activa: payload.active !== false && payload.activa !== false,
      },
    }
  }
}
