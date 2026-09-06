const IDENTITY_BASE = 'http://127.0.0.1:3100'
const CREDIT_BASE = 'http://127.0.0.1:3102'
const LEDGER_BASE = 'http://127.0.0.1:3104'
const COLLECTION_BASE = 'http://127.0.0.1:3105'
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

export type CreditApplication = {
  id: string
  publicId: string
  userId: string
  productId: string
  amount: string
  months: number
  monthlyPayment: string
  status: string
  createdAt: string
  product?: { name: string }
  user?: { firstName: string; lastName: string; email: string }
  decisions?: Array<{ decision: string; riskScore: number; riskLevel: string; decidedAt: string }>
  contract?: { acceptedAt: string } | null
  credit?: { publicId: string; installments: Installment[] } | null
}

export type Installment = {
  id: string
  number: number
  dueDate: string
  principal: string
  interest: string
  totalDue: string
  amountPaid: string
  status: string
}

export type Credit = {
  id: string
  publicId: string
  userId: string
  amount: string
  balance: string
  months: number
  status: string
  createdAt: string
  application?: { user: { firstName: string; lastName: string; email: string } }
}

export type TreasuryDashboard = {
  treasuryNetBalance: number
  totalDisbursed: number
  totalCollected: number
  disbursementCount: number
  repaymentCount: number
}

export type Reconciliation = {
  credits: Array<{ creditId: string; publicId: string; cachedBalance: number; ledgerImpliedBalance: number; match: boolean }>
  allMatch: boolean
}

export type CollectionCase = {
  id: string
  creditId: string
  status: string
  maxDaysOverdue: number
  lastScanAt: string
  openedAt: string
  closedAt: string | null
  credit: { publicId: string; userId: string; amount: string; balance: string }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: SessionUser }>(IDENTITY_BASE, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<SessionUser & { dni: string | null; cuil: string | null; income: number | null }>(IDENTITY_BASE, '/users/me'),
  creditProducts: () => request<CreditProduct[]>(CREDIT_BASE, '/credit-products'),

  applicationsQueue: () => request<CreditApplication[]>(CREDIT_BASE, '/credit-applications/queue'),
  applicationsReadyForDisbursement: () => request<CreditApplication[]>(CREDIT_BASE, '/credit-applications/ready-for-disbursement'),
  applicationDetail: (id: string) => request<CreditApplication>(CREDIT_BASE, `/credit-applications/${id}`),
  reviewApplication: (id: string, action: 'approve' | 'reject', reason?: string) =>
    request<CreditApplication>(CREDIT_BASE, `/credit-applications/${id}/review`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  disburseApplication: (id: string) => request<Credit>(CREDIT_BASE, `/credit-applications/${id}/disburse`, { method: 'POST' }),

  creditsAll: (status?: string) => request<Credit[]>(CREDIT_BASE, `/credits/all${status ? `?status=${status}` : ''}`),
  creditInstallments: (id: string) => request<Installment[]>(CREDIT_BASE, `/credits/${id}/installments`),

  treasuryDashboard: () => request<TreasuryDashboard>(LEDGER_BASE, '/treasury/dashboard'),
  treasuryReconciliation: () => request<Reconciliation>(LEDGER_BASE, '/treasury/reconciliation'),

  collectionCases: () => request<CollectionCase[]>(COLLECTION_BASE, '/collections/cases'),
  collectionScan: () => request<{ scanned: number }>(COLLECTION_BASE, '/collections/scan', { method: 'POST' }),
  collectionAction: (id: string, action: 'CONTACT_ATTEMPT' | 'PROMISE_TO_PAY' | 'MARK_RECOVERED', notes?: string) =>
    request(COLLECTION_BASE, `/collections/cases/${id}/action`, { method: 'POST', body: JSON.stringify({ action, notes }) }),
}
