const IDENTITY_BASE = 'http://127.0.0.1:3100'
const CREDIT_BASE = 'http://127.0.0.1:3102'
const TOKEN_KEY = 'unicreditos_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, token)
}

type ApiError = { code: string; message: string; requestId: string }

async function request<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${base}${path}`, { ...init, headers })
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error((data as ApiError).message || 'No se pudo completar la operación.')
  return data as T
}

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
}

export type CreditProduct = {
  id: string
  name: string
  monthlyRate: string
  minAmount: string
  maxAmount: string
  minTermMonths: number
  maxTermMonths: number
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: SessionUser }>(IDENTITY_BASE, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<SessionUser & { dni: string | null; cuil: string | null; income: number | null }>(IDENTITY_BASE, '/users/me'),
  creditProducts: () => request<CreditProduct[]>(CREDIT_BASE, '/credit-products'),
}
