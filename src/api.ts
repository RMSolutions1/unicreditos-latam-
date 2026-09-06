import type { AccountData, Quote, SessionUser } from './types'

const TOKEN_KEY = 'unicreditos_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token?: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, token)
}

const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:3001' : ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const text = await response.text()
  const data = text.startsWith('<') ? {} : JSON.parse(text || '{}')
  if (!response.ok || text.startsWith('<')) throw new Error(data.message || 'No se pudo completar la operación')
  return data as T
}

export const api = {
  health: () => request<{ status: string; mode: string; resources?: Record<string, { configured?: boolean }> }>('/api/health'),
  demo: () => request<{ email: string; password: string; hint: string }>('/api/demo'),
  products: () => request<Array<{ id: string; name: string; maxAmount: number; minAmount: number; minTerm: number; maxTerm: number; monthlyRate: number; summary: string; detail: string; kind: string; tnaLabel: string; teaLabel: string; cftLabel: string }>>('/api/products'),
  simulate: (input: { amount: number; months: number; productId: string }) => request<Quote>('/api/simulate', { method: 'POST', body: JSON.stringify(input) }),
  login: (email: string, password: string) => request<{ token: string; user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (input: { name: string; email: string; password: string }) => request<{ token: string; user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  forgot: (email: string) => request<{ ok: boolean; message: string }>('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  account: () => request<AccountData>('/api/account'),
  apply: (input: Record<string, string | number>) => request<{ token: string; user: SessionUser; application: { publicId: string; status: string; monthlyPayment: number; tna: number; tea: number; cft: number; score: number; amount: number; months: number } }>('/api/applications', { method: 'POST', body: JSON.stringify(input) }),
  pay: (method = 'mercadopago', count = 1) => request<{ message: string; account: AccountData; checkout?: { initPoint: string } }>('/api/account/pay', { method: 'POST', body: JSON.stringify({ method, count }) }),
  prepay: (method = 'homebanking') => request<{ message: string; account: AccountData; checkout?: { initPoint: string } }>('/api/account/prepay', { method: 'POST', body: JSON.stringify({ method }) }),
  readNotices: () => request<AccountData>('/api/account/notices/read', { method: 'POST' }),
  validateCbu: (cbu: string) => request<{ ok: boolean; message?: string; data?: { titular?: string; entidad?: string; cuit?: string } }>('/api/cbu/validate', { method: 'POST', body: JSON.stringify({ cbu }) }),
  startKyc: () => request<{ url: string; account: AccountData }>('/api/kyc/start', { method: 'POST' }),
  bcraFx: () => request<{ ok: boolean; fx: { moneda: string; tipoCotizacion: number | null; descripcion: string | null }[] }>('/api/bcra/fx'),
  bcraDeudores: (cuit?: string) => request<{ ok: boolean; worstSituation: number | null; totalDebt: number; entitiesCount: number; unavailable?: boolean }>('/api/bcra/deudores', { method: 'POST', body: JSON.stringify({ cuit }) }),
  publicStories: () => request<Array<{ id: string; displayName: string; initials: string; product: string; body: string; stars: number }>>('/api/stories'),
  myStories: () => request<Array<{ id: string; product: string; body: string; stars: number; status: 'pending' | 'approved' | 'rejected'; createdAt: string }>>('/api/account/stories'),
  submitStory: (body: string, stars = 5) => request<{ story: { id: string; status: string }; stories: Array<{ id: string; product: string; body: string; stars: number; status: 'pending' | 'approved' | 'rejected'; createdAt: string }> }>('/api/account/stories', { method: 'POST', body: JSON.stringify({ body, stars }) }),
  adminStories: () => request<Array<{ id: string; displayName: string; email: string; product: string; body: string; stars: number; status: 'pending' | 'approved' | 'rejected'; createdAt: string }>>('/api/admin/stories'),
  reviewStory: (id: string, action: 'approve' | 'reject') => request<{ stories: Array<{ id: string; displayName: string; email: string; product: string; body: string; stars: number; status: 'pending' | 'approved' | 'rejected'; createdAt: string }> }>(`/api/admin/stories/${id}/review`, { method: 'POST', body: JSON.stringify({ action }) }),
}

export const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export const moneyExact = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
export const day = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
