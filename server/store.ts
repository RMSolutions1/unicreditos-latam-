import { FIRST_CREDIT_HARD_CAP, INCOME_DTI_RATIO, SCORE_REJECT_BELOW, addMonths, creditScore, evaluateApplication, hashPassword, publicId, quote, token } from './lib.ts'

export type Product = {
  id: string
  name: string
  kind: 'cash' | 'express' | 'line' | 'installments'
  monthlyRate: number
  minAmount: number
  maxAmount: number
  minTerm: number
  maxTerm: number
  summary: string
  detail: string
}

export type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  income: number
  dni: string
  cuil: string
  cbu: string
  province: string
  score: number
  lineLimit: number
  lineUsed: number
  kycStatus: 'pending' | 'reviewing' | 'approved' | 'rejected'
  diditSessionId: string
  resetToken: string
  role: 'customer' | 'admin'
  passwordHash: string
  createdAt: string
}

export type Application = {
  id: string
  publicId: string
  userId: string
  productId: string
  amount: number
  months: number
  monthlyPayment: number
  tna: number
  tea: number
  cft: number
  score: number
  status: 'under_review' | 'approved' | 'rejected'
  createdAt: string
}

export type Credit = {
  id: string
  publicId: string
  userId: string
  productId: string
  applicationId: string
  amount: number
  balance: number
  months: number
  monthlyPayment: number
  tna: number
  status: 'active' | 'paid_off'
  disbursedTo: string
  createdAt: string
}

export type Payment = {
  id: string
  publicId: string
  creditId: string
  amount: number
  status: 'pending' | 'paid'
  method: string | null
  dueDate: string
  paidAt: string | null
  mpPreferenceId?: string
  mpExternalRef?: string
}

export type Document = {
  id: string
  userId: string
  name: string
  status: string
}

export type Notice = {
  id: string
  userId: string
  title: string
  body: string
  at: string
  read: boolean
}

type Session = { token: string; userId: string }

const products: Product[] = [
  { id: 'personal', name: 'Préstamo personal', kind: 'cash', monthlyRate: 7.5, minAmount: 50000, maxAmount: 3000000, minTerm: 3, maxTerm: 48, summary: 'Cuota fija, TNA y CFT a la vista. Primer crédito acotado a $400.000.', detail: 'Hasta $3.000.000 en 3 a 48 cuotas. Acreditación en tu CBU o CVU cuando tesorería confirma.' },
  { id: 'express', name: 'Crédito de consumo', kind: 'express', monthlyRate: 8.2, minAmount: 10000, maxAmount: 1000000, minTerm: 3, maxTerm: 24, summary: 'Para un gasto puntual. Misma evaluación KYC + BCRA.', detail: 'Hasta $1.000.000 en 1 a 24 cuotas. El primer crédito también respeta el tope de $400.000.' },
  { id: 'linea', name: 'Línea Unicréditos', kind: 'line', monthlyRate: 7.5, minAmount: 30000, maxAmount: 1500000, minTerm: 3, maxTerm: 24, summary: 'Usá solo lo que necesitás. Pagás por lo que usás.', detail: 'Desembolsos contra tu línea. Misma TEM 7,5% del préstamo personal.' },
  { id: 'cuotas', name: 'Cuotas sin tarjeta', kind: 'installments', monthlyRate: 8.2, minAmount: 15000, maxAmount: 800000, minTerm: 3, maxTerm: 24, summary: 'Financiá una compra sin tarjeta de crédito.', detail: 'TEM 8,2% (catálogo de consumo). Pagás desde tu cuenta Unicréditos.' },
]

const users = new Map<string, User>()
const applications = new Map<string, Application>()
const credits = new Map<string, Credit>()
const payments = new Map<string, Payment>()
const documents = new Map<string, Document>()
const notices = new Map<string, Notice>()
const sessions = new Map<string, Session>()

function notify(userId: string, title: string, body: string) {
  const id = publicId('NT')
  notices.set(id, { id, userId, title, body, at: new Date().toISOString(), read: false })
}

function seed() {
  const ana: User = {
    id: 'user-ana',
    firstName: 'Ana',
    lastName: 'Martínez',
    email: 'ana@unicreditos.com.ar',
    phone: '1155550101',
    income: 420000,
    dni: '32456789',
    cuil: '27-32456789-3',
    cbu: '0170099220000034567891',
    province: 'CABA',
    score: 742,
    lineLimit: 850000,
    lineUsed: 450000,
    kycStatus: 'approved',
    diditSessionId: '',
    resetToken: '',
    role: 'customer',
    passwordHash: hashPassword('demo1234'),
    createdAt: '2026-03-12T10:00:00.000Z',
  }
  users.set(ana.id, ana)

  const application: Application = {
    id: 'app-ana',
    publicId: 'UNI-1048',
    userId: ana.id,
    productId: 'personal',
    amount: 450000,
    months: 12,
    monthlyPayment: quote(450000, 12, 7.5).monthlyPayment,
    tna: quote(450000, 12, 7.5).tna,
    tea: quote(450000, 12, 7.5).tea,
    cft: quote(450000, 12, 7.5).cft,
    score: 742,
    status: 'approved',
    createdAt: '2026-03-12T10:12:00.000Z',
  }
  applications.set(application.id, application)

  const credit: Credit = {
    id: 'credit-ana',
    publicId: 'CR-1048',
    userId: ana.id,
    productId: 'personal',
    applicationId: application.id,
    amount: 450000,
    balance: 262500,
    months: 12,
    monthlyPayment: application.monthlyPayment,
    tna: application.tna,
    status: 'active',
    disbursedTo: ana.cbu,
    createdAt: '2026-03-12T10:20:00.000Z',
  }
  credits.set(credit.id, credit)

  const schedule = [
    { dueDate: '2026-04-22', status: 'paid' as const, method: 'homebanking' },
    { dueDate: '2026-05-22', status: 'paid' as const, method: 'mercadopago' },
    { dueDate: '2026-06-22', status: 'paid' as const, method: 'debito' },
    { dueDate: '2026-07-22', status: 'paid' as const, method: 'rapipago' },
    { dueDate: '2026-08-22', status: 'paid' as const, method: 'mercadopago' },
    { dueDate: '2026-09-22', status: 'pending' as const, method: null },
    { dueDate: '2026-10-22', status: 'pending' as const, method: null },
    { dueDate: '2026-11-22', status: 'pending' as const, method: null },
    { dueDate: '2026-12-22', status: 'pending' as const, method: null },
    { dueDate: '2027-01-22', status: 'pending' as const, method: null },
    { dueDate: '2027-02-22', status: 'pending' as const, method: null },
    { dueDate: '2027-03-22', status: 'pending' as const, method: null },
  ]
  schedule.forEach((row, index) => {
    const id = `pay-ana-${index + 1}`
    payments.set(id, {
      id,
      publicId: `PAG-${1040 + index}`,
      creditId: credit.id,
      amount: Number(credit.monthlyPayment.toFixed(2)),
      status: row.status,
      method: row.method,
      dueDate: row.dueDate,
      paidAt: row.status === 'paid' ? `${row.dueDate}T09:15:00.000Z` : null,
    })
  })

  ;[
    ['doc-1', 'DNI frente y dorso', 'Validado'],
    ['doc-2', 'Selfie de identidad', 'Validada'],
    ['doc-3', 'CBU / CVU a tu nombre', 'Validado'],
    ['doc-4', 'Contrato de crédito en efectivo', 'Firmado'],
    ['doc-5', 'Estado de cuenta', 'Disponible'],
  ].forEach(([id, name, status]) => documents.set(id, { id, userId: ana.id, name, status }))

  notify(ana.id, 'Próximo vencimiento', 'Tu cuota de septiembre vence el 22/09. Podés pagarla por Mercado Pago, homebanking o Rapipago.')
  notify(ana.id, 'Línea disponible', 'Tenés $400.000 disponibles en tu Línea Unicréditos.')
  notify(ana.id, 'Desembolso acreditado', 'Tu crédito CR-1048 se acreditó en el CBU terminado en 7891.')

  const mesa: User = {
    id: 'user-mesa',
    firstName: 'Mesa',
    lastName: 'Unicréditos',
    email: 'operaciones@unicreditos.com',
    phone: '',
    income: 0,
    dni: '',
    cuil: '',
    cbu: '',
    province: 'CABA',
    score: 0,
    lineLimit: 0,
    lineUsed: 0,
    kycStatus: 'approved',
    diditSessionId: '',
    resetToken: '',
    role: 'admin',
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'unicred-mesa'),
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  users.set(mesa.id, mesa)
}

seed()

export const catalog = {
  products,
  demo: { email: 'ana@unicreditos.com.ar', password: 'demo1234' },
  aliases: { 'ana@unicreditos.mx': 'ana@unicreditos.com.ar' } as Record<string, string>,
}

export function listProducts() {
  return products.map((product) => ({ ...product, ...quote(500000, Math.min(12, product.maxTerm), product.monthlyRate) }))
}

export function findProduct(id: string) {
  return products.find((product) => product.id === id)
}

export function findUserByEmail(email: string) {
  const normalized = catalog.aliases[email.toLowerCase()] || email.toLowerCase()
  return [...users.values()].find((user) => user.email.toLowerCase() === normalized || user.email.toLowerCase() === email.toLowerCase())
}

export function findUser(id: string) {
  return users.get(id)
}

export function createUser(input: Omit<User, 'id' | 'createdAt' | 'passwordHash' | 'score' | 'lineLimit' | 'lineUsed' | 'role' | 'kycStatus' | 'diditSessionId' | 'resetToken'> & { password: string; score?: number }) {
  const existing = findUserByEmail(input.email)
  if (existing) return existing
  const user: User = {
    id: publicId('USR'),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email.toLowerCase(),
    phone: input.phone,
    income: input.income,
    dni: input.dni || '',
    cuil: input.cuil || '',
    cbu: input.cbu || '',
    province: input.province || 'Argentina',
    score: input.score || 600,
    lineLimit: Math.max(150000, Math.round((input.income || 0) * 2.2)),
    lineUsed: 0,
    kycStatus: 'pending',
    diditSessionId: '',
    resetToken: '',
    role: 'customer',
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  }
  users.set(user.id, user)
  documents.set(`${user.id}-dni`, { id: `${user.id}-dni`, userId: user.id, name: 'DNI frente y dorso', status: input.dni ? 'En revisión' : 'Pendiente' })
  documents.set(`${user.id}-selfie`, { id: `${user.id}-selfie`, userId: user.id, name: 'Selfie de identidad', status: 'Pendiente' })
  documents.set(`${user.id}-cbu`, { id: `${user.id}-cbu`, userId: user.id, name: 'CBU / CVU a tu nombre', status: input.cbu ? 'En revisión' : 'Pendiente' })
  notify(user.id, 'Bienvenida a Unicréditos', 'Tu cuenta ya está lista. Completá tu DNI y CBU para pedir tu primer crédito.')
  return user
}

export function createSession(userId: string) {
  const sessionToken = token()
  sessions.set(sessionToken, { token: sessionToken, userId })
  return sessionToken
}

export function authenticate(email: string, password: string) {
  const user = findUserByEmail(email)
  if (!user || user.passwordHash !== hashPassword(password)) return null
  return { user, token: createSession(user.id) }
}

export function sessionUser(sessionToken?: string) {
  if (!sessionToken) return null
  const session = sessions.get(sessionToken)
  return session ? users.get(session.userId) ?? null : null
}

export function destroySession(sessionToken?: string) {
  if (sessionToken) sessions.delete(sessionToken)
}

function createSchedule(credit: Credit) {
  const start = new Date().toISOString().slice(0, 10)
  for (let index = 1; index <= credit.months; index += 1) {
    const id = publicId('PAY')
    payments.set(id, {
      id,
      publicId: id,
      creditId: credit.id,
      amount: Number(credit.monthlyPayment.toFixed(2)),
      status: 'pending',
      method: null,
      dueDate: addMonths(start, index),
      paidAt: null,
    })
  }
}

function activateCredit(user: User, application: Application, product: Product) {
  const credit: Credit = {
    id: publicId('CR'),
    publicId: publicId('CR'),
    userId: user.id,
    productId: product.id,
    applicationId: application.id,
    amount: application.amount,
    balance: application.amount,
    months: application.months,
    monthlyPayment: application.monthlyPayment,
    tna: pricing.tna,
    status: 'active',
    disbursedTo: user.cbu || 'CBU pendiente',
    createdAt: new Date().toISOString(),
  }
  credits.set(credit.id, credit)
  createSchedule(credit)
  if (product.kind === 'line') user.lineUsed = Number((user.lineUsed + application.amount).toFixed(2))
  documents.set(`${user.id}-contract-${credit.id}`, { id: `${user.id}-contract-${credit.id}`, userId: user.id, name: `Contrato ${product.name}`, status: 'Firmado' })
  notify(user.id, 'Crédito acreditado', `Acreditamos ${application.amount.toLocaleString('es-AR')} en tu CBU/CVU. Folio ${credit.publicId}.`)
  return credit
}

export function createApplication(input: { user: User; productId: string; amount: number; months: number; dni?: string; cuil?: string; cbu?: string; phone?: string; income?: number }) {
  const product = findProduct(input.productId)
  if (!product) throw new Error('Producto no disponible')
  if (input.amount < product.minAmount || input.amount > product.maxAmount) throw new Error(`El monto debe estar entre ${product.minAmount} y ${product.maxAmount}`)
  if (input.months < product.minTerm || input.months > product.maxTerm) throw new Error(`El plazo debe estar entre ${product.minTerm} y ${product.maxTerm} meses`)

  if (input.dni) input.user.dni = String(input.dni)
  if (input.cuil) input.user.cuil = String(input.cuil)
  if (input.cbu) input.user.cbu = String(input.cbu)
  if (input.phone) input.user.phone = String(input.phone)
  if (input.income) input.user.income = Number(input.income)

  const completed = userCredits(input.user.id).filter((item) => item.status === 'paid_off').length
  if (!completed && input.amount > FIRST_CREDIT_HARD_CAP) {
    throw new Error(`El primer crédito está acotado a $${FIRST_CREDIT_HARD_CAP.toLocaleString('es-AR')}`)
  }
  const pricing = quote(input.amount, input.months, product.monthlyRate)
  if ((input.user.income || 0) > 0 && pricing.monthlyPayment > input.user.income * INCOME_DTI_RATIO) {
    throw new Error('La cuota supera el 35% de tus ingresos declarados')
  }
  const score = creditScore(input.user.income || 0, pricing.monthlyPayment, { hasCbu: Boolean(input.user.cbu), hasDni: Boolean(input.user.dni) })
  input.user.score = score
  if (score < SCORE_REJECT_BELOW) {
    throw new Error('El perfil no alcanza el umbral mínimo de evaluación')
  }
  if (score > 700) input.user.lineLimit = Math.max(input.user.lineLimit, Math.round(input.user.income * 2.4))

  if (product.kind === 'line' && input.user.lineUsed + input.amount > input.user.lineLimit) {
    throw new Error('Ese monto supera tu línea disponible')
  }

  const status = evaluateApplication(input.user.income || 0, pricing.monthlyPayment)
  const application: Application = {
    id: publicId('APP'),
    publicId: publicId('UNI'),
    userId: input.user.id,
    productId: product.id,
    amount: input.amount,
    months: input.months,
    monthlyPayment: pricing.monthlyPayment,
    tna: pricing.tna,
    tea: pricing.tea,
    cft: pricing.cft,
    score,
    status,
    createdAt: new Date().toISOString(),
  }
  applications.set(application.id, application)

  if (status === 'approved') activateCredit(input.user, application, product)
  if (status === 'under_review') notify(input.user.id, 'Solicitud en revisión', `Estamos validando tu DNI y CBU. Folio ${application.publicId}.`)
  if (status === 'rejected') notify(input.user.id, 'Oferta no disponible', 'Por ahora no podemos ofrecerte ese monto. Probá un plazo más largo o un monto menor.')

  return application
}

export function userApplications(userId: string) {
  return [...applications.values()].filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function userCredits(userId: string) {
  return [...credits.values()].filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function creditPayments(creditId: string) {
  return [...payments.values()].filter((item) => item.creditId === creditId).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function userDocuments(userId: string) {
  return [...documents.values()].filter((item) => item.userId === userId)
}

export function userNotices(userId: string) {
  return [...notices.values()].filter((item) => item.userId === userId).sort((a, b) => b.at.localeCompare(a.at))
}

export function payNext(userId: string, method = 'mercadopago', count = 1) {
  const credit = userCredits(userId).find((item) => item.status === 'active')
  if (!credit) throw new Error('No tenés un crédito activo')
  const pending = creditPayments(credit.id).filter((item) => item.status === 'pending')
  if (!pending.length) throw new Error('No hay pagos pendientes')
  const batch = pending.slice(0, Math.max(1, count))
  batch.forEach((next) => {
    next.status = 'paid'
    next.method = method
    next.paidAt = new Date().toISOString()
    credit.balance = Number(Math.max(0, credit.balance - next.amount).toFixed(2))
  })
  if (credit.balance <= 0) {
    credit.balance = 0
    credit.status = 'paid_off'
    const user = findUser(userId)
    if (user && credit.productId === 'linea') user.lineUsed = Math.max(0, user.lineUsed - credit.amount)
    notify(userId, 'Crédito liquidado', `Cancelaste ${credit.publicId}. Tu línea vuelve a estar disponible.`)
  } else {
    notify(userId, 'Pago registrado', `Registramos ${batch.length} cuota${batch.length > 1 ? 's' : ''} por ${method}.`)
  }
  return { credit, payment: batch[0], paid: batch.length }
}

export function settleCredit(userId: string, method = 'homebanking') {
  const credit = userCredits(userId).find((item) => item.status === 'active')
  if (!credit) throw new Error('No tenés un crédito activo')
  const pending = creditPayments(credit.id).filter((item) => item.status === 'pending')
  return payNext(userId, method, pending.length || 1)
}

export function markNoticesRead(userId: string) {
  userNotices(userId).forEach((item) => { item.read = true })
}

export function accountSnapshot(user: User) {
  const credit = userCredits(user.id).find((item) => item.status === 'active') || userCredits(user.id)[0] || null
  const schedule = credit ? creditPayments(credit.id) : []
  const paid = schedule.filter((item) => item.status === 'paid')
  const next = schedule.find((item) => item.status === 'pending') || null
  const product = credit ? findProduct(credit.productId) : null
  const latestApplication = userApplications(user.id)[0] || null
  const progress = credit ? Math.round(((credit.amount - credit.balance) / credit.amount) * 100) : 0
  const pricing = credit && product ? quote(credit.amount, credit.months, product.monthlyRate) : null

  return {
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      firstName: user.firstName,
      email: user.email,
      phone: user.phone,
      income: user.income,
      dni: user.dni,
      cuil: user.cuil,
      cbu: user.cbu,
      province: user.province,
      score: user.score,
      kycStatus: user.kycStatus,
      role: user.role,
    },
    line: {
      limit: user.lineLimit,
      used: user.lineUsed,
      available: Math.max(0, user.lineLimit - user.lineUsed),
    },
    credit: credit && {
      publicId: credit.publicId,
      product: product?.name || 'Crédito en efectivo',
      amount: credit.amount,
      balance: credit.balance,
      months: credit.months,
      monthlyPayment: credit.monthlyPayment,
      status: credit.status,
      progress,
      tna: credit.tna,
      disbursedTo: credit.disbursedTo,
    },
    quote: pricing && { tna: pricing.tnaLabel, tea: pricing.teaLabel, cft: pricing.cftLabel },
    nextPayment: next && { publicId: next.publicId, amount: next.amount, dueDate: next.dueDate },
    paidThisYear: Number(paid.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
    paidCount: paid.length,
    pendingCount: schedule.filter((item) => item.status === 'pending').length,
    payments: schedule.map((item) => ({
      publicId: item.publicId,
      amount: item.amount,
      dueDate: item.dueDate,
      status: item.status === 'paid' ? 'Pagado' : 'Pendiente',
      method: item.method,
    })),
    documents: userDocuments(user.id).map((item) => ({ name: item.name, status: item.status })),
    notices: userNotices(user.id).map((item) => ({ id: item.id, title: item.title, body: item.body, at: item.at, read: item.read })),
    application: latestApplication && {
      publicId: latestApplication.publicId,
      amount: latestApplication.amount,
      months: latestApplication.months,
      monthlyPayment: latestApplication.monthlyPayment,
      status: latestApplication.status,
      tna: latestApplication.tna,
      tea: latestApplication.tea,
      cft: latestApplication.cft,
      score: latestApplication.score,
    },
  }
}

export function setUserKyc(userId: string, status: User['kycStatus'], sessionId?: string) {
  const user = findUser(userId)
  if (!user) return null
  user.kycStatus = status
  if (sessionId) user.diditSessionId = sessionId
  const doc = [...documents.values()].find((item) => item.userId === userId && item.name.includes('Selfie'))
  if (doc) doc.status = status === 'approved' ? 'Validado' : status === 'rejected' ? 'Rechazado' : 'En revisión'
  notify(userId, 'Identidad Didit', status === 'approved' ? 'Tu verificación de identidad quedó aprobada.' : `Estado KYC: ${status}.`)
  return user
}

export function findUserByDiditSession(sessionId: string) {
  return [...users.values()].find((user) => user.diditSessionId === sessionId)
}

export function attachCheckout(userId: string, preferenceId: string, externalRef: string) {
  const credit = userCredits(userId).find((item) => item.status === 'active')
  if (!credit) throw new Error('No tenés un crédito activo')
  const pending = creditPayments(credit.id).find((item) => item.status === 'pending')
  if (!pending) throw new Error('No hay cuotas pendientes')
  pending.mpPreferenceId = preferenceId
  pending.mpExternalRef = externalRef
  return pending
}

export function settleByExternalRef(externalRef: string, method = 'mercadopago') {
  const payment = [...payments.values()].find((item) => item.mpExternalRef === externalRef)
  if (!payment) return null
  if (payment.status === 'paid') return payment
  const credit = credits.get(payment.creditId)
  if (!credit) return null
  payment.status = 'paid'
  payment.method = method
  payment.paidAt = new Date().toISOString()
  credit.balance = Number(Math.max(0, credit.balance - payment.amount).toFixed(2))
  if (credit.balance <= 0) {
    credit.balance = 0
    credit.status = 'paid_off'
  }
  notify(credit.userId, 'Pago acreditado', `Mercado Pago acreditó la cuota ${payment.publicId}.`)
  return payment
}

export function issueResetToken(email: string) {
  const user = findUserByEmail(email)
  if (!user) return null
  user.resetToken = token()
  return { user, token: user.resetToken }
}

export function resetPassword(tokenValue: string, password: string) {
  const user = [...users.values()].find((item) => item.resetToken && item.resetToken === tokenValue)
  if (!user) return null
  user.passwordHash = hashPassword(password)
  user.resetToken = ''
  return user
}
