import https from 'node:https'
import { URL } from 'node:url'

const BCRA_BASE = 'https://api.bcra.gob.ar'
const HEADERS = {
  'Accept-Language': 'es-AR',
  Accept: 'application/json',
  'User-Agent': 'UNICREDITOS/1.0 (+https://unicreditos.com)',
}

export function normalizeCuit(value: string) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidCuit(value: string) {
  const cuit = normalizeCuit(value)
  if (!/^\d{11}$/.test(cuit)) return false
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cuit[i], 10) * factors[i]
  const mod = sum % 11
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return parseInt(cuit[10], 10) === expected
}

function request(url: string, insecure: boolean): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request(
      {
        protocol: 'https:',
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        headers: HEADERS,
        timeout: 18000,
        rejectUnauthorized: !insecure,
        servername: u.hostname,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
      },
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
    req.on('error', reject)
    req.end()
  })
}

async function bcraGet(path: string) {
  const url = `${BCRA_BASE}${path}`
  try {
    const first = await request(url, false)
    if (first.status >= 200 && first.status < 500) {
      return { status: first.status, json: first.body ? JSON.parse(first.body) : null }
    }
  } catch {
    /* TLS del BCRA a veces falla: reintento sin verificación de cadena */
  }
  const retry = await request(url, true)
  return { status: retry.status, json: retry.body ? JSON.parse(retry.body) : null }
}

export async function getCotizaciones() {
  const res = await bcraGet('/estadisticascambiarias/v1.0/Cotizaciones')
  if (res.status < 200 || res.status >= 300) return []
  const results = res.json?.results ?? res.json
  const fecha = results?.fecha ?? null
  const detalle = results?.detalle ?? (Array.isArray(results) ? results : [])
  if (!Array.isArray(detalle)) return []
  return detalle.map((d: Record<string, unknown>) => ({
    moneda: String(d.codigoMoneda ?? d.moneda ?? d.descripcion ?? 'N/A'),
    descripcion: d.descripcion != null ? String(d.descripcion) : null,
    tipoCotizacion: d.tipoCotizacion != null ? Number(d.tipoCotizacion) : d.valor != null ? Number(d.valor) : null,
    fecha,
  }))
}

export async function getDeudas(cuitRaw: string) {
  const cuit = normalizeCuit(cuitRaw)
  if (!cuit) return { unavailable: true, worstSituation: null, totalDebt: 0, entitiesCount: 0, entidades: [] as unknown[] }
  for (const path of [`/centraldedeudores/v1.0/Deudas/${cuit}`, `/CentralDeDeudores/v1.0/Deudas/${cuit}`]) {
    const res = await bcraGet(path)
    if (res.status === 404) return { unavailable: false, worstSituation: null, totalDebt: 0, entitiesCount: 0, entidades: [] }
    if (res.status >= 200 && res.status < 300) {
      const results = res.json?.results ?? res.json
      const periodos = Array.isArray(results?.periodos) ? results.periodos : []
      const latest = periodos[0] ?? results
      const entidades = Array.isArray(latest?.entidades) ? latest.entidades : []
      const situations = entidades.map((e: { situacion?: number }) => Number(e.situacion || 0)).filter(Boolean)
      return {
        unavailable: false,
        identificacion: results?.identificacion ?? cuit,
        worstSituation: situations.length ? Math.max(...situations) : null,
        totalDebt: Number(latest?.monto ?? latest?.total ?? 0) || 0,
        entitiesCount: entidades.length,
        entidades,
      }
    }
  }
  return { unavailable: true, worstSituation: null, totalDebt: 0, entitiesCount: 0, entidades: [] }
}
