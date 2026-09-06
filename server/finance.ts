export const IVA_INTERESES = 0.21
export const FIRST_CREDIT_HARD_CAP = 400_000
export const INCOME_DTI_RATIO = 0.35
export const SCORE_REJECT_BELOW = 560

export function computeFrenchAmortization(principal: number, term: number, monthlyRate: number) {
  const i = monthlyRate / 100
  const installmentAmount =
    i === 0 ? principal / term : (principal * (i * Math.pow(1 + i, term))) / (Math.pow(1 + i, term) - 1)
  const roundedInstallment = Math.round(installmentAmount * 100) / 100
  const totalAmount = Math.round(roundedInstallment * term * 100) / 100
  const totalInterest = Math.round((totalAmount - principal) * 100) / 100
  const tna = Math.round(i * 12 * 100 * 100) / 100
  const tea = Math.round((Math.pow(1 + i, 12) - 1) * 100 * 100) / 100
  const cft = Math.round(tea * (1 + IVA_INTERESES) * 100) / 100
  return {
    amount: principal,
    months: term,
    monthlyPayment: roundedInstallment,
    total: totalAmount,
    totalInterest,
    tna,
    tea,
    cft,
    tnaLabel: `${tna.toFixed(1).replace('.', ',')}%`,
    teaLabel: `${tea.toFixed(2).replace('.', ',')}%`,
    cftLabel: `${cft.toFixed(2).replace('.', ',')}%`,
  }
}

export function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2).replace('.', ',')}%`
}
