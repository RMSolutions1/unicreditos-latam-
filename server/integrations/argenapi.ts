const API_KEY = process.env.ARGENAPI_API_KEY ?? ''
const BASE_URL = (process.env.ARGENAPI_BASE_URL ?? 'https://www.argenapi.com/api/v1').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.ARGENAPI_TIMEOUT_MS ?? 10000)

export function isArgenApiConfigured() {
  return Boolean(API_KEY.trim())
}

function cleanCbu(input: string) {
  return (input || '').replace(/\D/g, '').slice(0, 22)
}

async function lookup(identifier: string, type: 'cbu' | 'alias') {
  if (!isArgenApiConfigured()) {
    return { ok: false, status: 'missing_key', message: 'ARGENAPI_API_KEY no configurada' }
  }
  const ctrl = AbortSignal.timeout(TIMEOUT_MS)
  const resp = await fetch(`${BASE_URL}/lookup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier, identifier_type: type }),
    signal: ctrl,
  })
  const json = (await resp.json().catch(() => null)) as Record<string, any> | null
  const payload = (json?.data && typeof json.data === 'object' ? json.data : json) as Record<string, any> | null
  const hasAccount = Boolean(payload && (payload.bank || payload.holders || payload.cbu || payload.cvu || payload.account || payload.titular))
  if (!resp.ok || !payload || !hasAccount) {
    return {
      ok: false,
      status: resp.status === 404 || resp.ok ? 'not_found' : 'api_error',
      message: String(json?.message || json?.error || json?.detail || (resp.ok ? 'CBU/alias no encontrado' : `HTTP ${resp.status}`)),
      httpStatus: resp.status,
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

export async function validateBankAccount(raw: string) {
  const digits = cleanCbu(raw)
  if (/^\d{22}$/.test(digits)) return lookup(digits, 'cbu')
  const alias = raw.trim().toLowerCase()
  if (alias.length >= 6 && alias.length <= 20 && !alias.includes('@')) return lookup(alias, 'alias')
  return { ok: false, status: 'invalid_format', message: 'Ingresá un CBU/CVU de 22 dígitos o un alias Coelsa' }
}
