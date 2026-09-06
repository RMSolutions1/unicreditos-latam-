import { createHash, randomBytes } from 'node:crypto'
import { computeFrenchAmortization } from './finance.ts'

export { computeFrenchAmortization, FIRST_CREDIT_HARD_CAP, INCOME_DTI_RATIO, SCORE_REJECT_BELOW } from './finance.ts'

export function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex')
}

export function token() {
  return randomBytes(24).toString('hex')
}

export function publicId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`
}

/** `monthlyRate` es la TEM en porcentaje, igual que el catálogo de Unicred (7.5 = 7,5%). */
export function quote(amount: number, months: number, monthlyRate: number) {
  return computeFrenchAmortization(amount, months, monthlyRate)
}

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || 'Persona', lastName: parts.slice(1).join(' ') || 'Unicréditos' }
}

export function addMonths(isoDate: string, months: number) {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

export function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${isoDate}T12:00:00`))
}

export function creditScore(income: number, payment: number, extras?: { hasCbu?: boolean; hasDni?: boolean }) {
  let score = 520
  if (income >= payment * 4) score += 180
  else if (income >= payment * 2.6) score += 140
  else if (income >= payment * 1.8) score += 70
  else if (income >= payment * 1.2) score += 20
  if (extras?.hasCbu) score += 25
  if (extras?.hasDni) score += 20
  return Math.min(850, score)
}

export function evaluateApplication(income: number, payment: number) {
  if (income >= payment * 2.4) return 'approved' as const
  if (income >= payment * 1.5) return 'under_review' as const
  return 'rejected' as const
}
