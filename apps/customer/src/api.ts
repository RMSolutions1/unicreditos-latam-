const IDENTITY_BASE = 'http://127.0.0.1:3100'
const KYC_BASE = 'http://127.0.0.1:3101'
const CREDIT_BASE = 'http://127.0.0.1:3102'
const PAYMENT_BASE = 'http://127.0.0.1:3103'

const ACCESS_TOKEN_KEY = 'unicreditos_customer_access'
const REFRESH_TOKEN_KEY = 'unicreditos_customer_refresh'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || ''
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || ''
}
export function setTokens(accessToken: string | null, refreshToken?: string | null) {
  if (!accessToken) localStorage.removeItem(ACCESS_TOKEN_KEY)
  else localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken === null) localStorage.removeItem(REFRESH_TOKEN_KEY)
  else if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

type ApiError = { code: string; message: string; requestId: string }

/**
 * Un solo reintento automático ante 401 usando el refresh token (rotativo -- master prompt §1
 * identity): si el refresh también falla, se limpia la sesión y se deja que la pantalla de login
 * la vuelva a pedir. Nunca se reintenta más de una vez para no entrar en loop.
 */
async function request<T>(base: string, path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${base}${path}`, { ...init, headers })

  if (response.status === 401 && !isRetry && getRefreshToken()) {
    try {
      const refreshed = await api.refresh()
      setTokens(refreshed.accessToken, refreshed.refreshToken)
      return request<T>(base, path, init, true)
    } catch {
      setTokens(null, null)
    }
  }

  const text = await response.text()
  // Un body vacío (ej. GET /kyc/sessions/latest sin sesión) es "sin contenido", no "{}" -- para
  // endpoints tipados como T | null eso importa (kyc ? ... : ... dependía de esto).
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error((data as ApiError | null)?.message || 'No se pudo completar la operación.')
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

export type Profile = SessionUser & { phone: string | null; dni: string | null; cuil: string | null; income: number | null; mfaEnabled: boolean; createdAt: string }

export type AuthResponse = { user: SessionUser; accessToken: string; refreshToken: string }

export type Quote = {
  productId?: string
  product?: string
  amount: number
  months: number
  monthlyPayment: number
  total: number
  totalInterest: number
  tna: number
  tea: number
  cft: number
}

export type CreditProduct = {
  id: string
  name: string
  monthlyRate: string
  minAmount: string
  maxAmount: string
  minTermMonths: number
  maxTermMonths: number
  active: boolean
  sampleQuote: Quote
}

export type CreditDecision = {
  id: string
  decision: string
  riskScore: number
  riskLevel: string
  modelVersion: string
  rulesVersion: string
  decidedAt: string
}

export type CreditApplication = {
  id: string
  publicId: string
  productId: string
  amount: string
  months: number
  monthlyPayment: string
  tna: string
  tea: string
  cft: string
  status: string
  createdAt: string
  product?: CreditProduct
  decisions?: CreditDecision[]
  contract?: { id: string; acceptedAt: string } | null
  credit?: (Credit & { installments: Installment[] }) | null
}

export type Credit = {
  id: string
  publicId: string
  applicationId: string
  amount: string
  balance: string
  months: number
  monthlyPayment: string
  tna: string
  status: string
  createdAt: string
}

export type Installment = {
  id: string
  creditId: string
  number: number
  dueDate: string
  principal: string
  interest: string
  totalDue: string
  amountPaid: string
  status: string
}

export type EarlySettlementQuote = {
  creditId: string
  outstandingPrincipal: number
  fees: number
  totalPayoff: number
  remainingInstallments: number
  note: string
}

export type KycSession = { id: string; provider: string; status: string; requestedAt: string; resolvedAt: string | null } | null

export type PaymentIntentResult = { paymentIntentId: string; checkoutUrl: string; externalReference: string }

export type Receipt = {
  comprobante: string
  cliente: string
  credito: string
  cuota: number
  importe: string
  moneda: string
  proveedor: string
  idOperacion: string | null
  fecha: string
  estado: string
}

export const api = {
  register: (input: { firstName: string; lastName: string; email: string; phone?: string; password: string }) =>
    request<AuthResponse>(IDENTITY_BASE, '/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (email: string, password: string) => request<AuthResponse>(IDENTITY_BASE, '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: () => request<AuthResponse>(IDENTITY_BASE, '/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: getRefreshToken() }) }),
  logout: () => request<{ ok: true }>(IDENTITY_BASE, '/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: getRefreshToken() }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>(IDENTITY_BASE, '/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  me: () => request<Profile>(IDENTITY_BASE, '/users/me'),
  updateProfile: (input: { phone?: string; dni?: string; cuil?: string; income?: number }) =>
    request<Profile>(IDENTITY_BASE, '/users/me', { method: 'PATCH', body: JSON.stringify(input) }),

  kycLatest: () => request<KycSession>(KYC_BASE, '/kyc/sessions/latest'),
  kycStart: () => request<{ sessionId: string; url: string }>(KYC_BASE, '/kyc/sessions', { method: 'POST' }),
  validateBankAccount: (cbuOrAlias: string) => request<{ ok: boolean; status?: string }>(KYC_BASE, '/kyc/bank-account/validate', { method: 'POST', body: JSON.stringify({ cbuOrAlias }) }),

  creditProducts: () => request<CreditProduct[]>(CREDIT_BASE, '/credit-products'),
  simulate: (productId: string, amount: number, months: number) =>
    request<Quote>(CREDIT_BASE, '/simulate', { method: 'POST', body: JSON.stringify({ productId, amount, months }) }),

  applications: () => request<CreditApplication[]>(CREDIT_BASE, '/credit-applications'),
  applicationDetail: (id: string) => request<CreditApplication>(CREDIT_BASE, `/credit-applications/${id}`),
  applyForCredit: (productId: string, amount: number, months: number) =>
    request<CreditApplication>(CREDIT_BASE, '/credit-applications', { method: 'POST', body: JSON.stringify({ productId, amount, months }) }),
  acceptContract: (applicationId: string) => request<CreditApplication>(CREDIT_BASE, `/credit-applications/${applicationId}/contract/accept`, { method: 'POST' }),

  credits: () => request<Credit[]>(CREDIT_BASE, '/credits'),
  creditInstallments: (id: string) => request<Installment[]>(CREDIT_BASE, `/credits/${id}/installments`),
  earlySettlementQuote: (id: string) => request<EarlySettlementQuote>(CREDIT_BASE, `/credits/${id}/early-settlement/quote`),

  createPaymentIntent: (installmentId: string, provider?: 'mercadopago' | 'astropay') =>
    request<PaymentIntentResult>(PAYMENT_BASE, '/payment-intents', { method: 'POST', body: JSON.stringify({ installmentId, provider }) }),
  paymentReceipt: (id: string) => request<Receipt>(PAYMENT_BASE, `/payment-intents/${id}/receipt`),
}
