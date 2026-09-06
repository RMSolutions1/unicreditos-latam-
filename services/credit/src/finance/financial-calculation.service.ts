import { Injectable } from '@nestjs/common'

const IVA_INTERESES = 0.21

export type Quote = {
  amount: number
  months: number
  monthlyPayment: number
  total: number
  totalInterest: number
  tna: number
  tea: number
  cft: number
}

export type InstallmentPlanRow = {
  number: number
  principal: number
  interest: number
  totalDue: number
}

/**
 * Fuente de verdad de los cálculos financieros (master prompt §104/105): el frontend nunca
 * recalcula esto, solo muestra lo que este servicio devuelve.
 */
@Injectable()
export class FinancialCalculationService {
  quote(principal: number, months: number, monthlyRatePercent: number): Quote {
    const i = monthlyRatePercent / 100
    const installment = i === 0 ? principal / months : (principal * (i * Math.pow(1 + i, months))) / (Math.pow(1 + i, months) - 1)
    const monthlyPayment = Math.round(installment * 100) / 100
    const total = Math.round(monthlyPayment * months * 100) / 100
    const totalInterest = Math.round((total - principal) * 100) / 100
    const tna = Math.round(i * 12 * 100 * 100) / 100
    const tea = Math.round((Math.pow(1 + i, 12) - 1) * 100 * 100) / 100
    const cft = Math.round(tea * (1 + IVA_INTERESES) * 100) / 100
    return { amount: principal, months, monthlyPayment, total, totalInterest, tna, tea, cft }
  }

  /** Genera el desglose capital/interés por cuota (sistema francés, cuota fija). */
  buildInstallmentPlan(principal: number, months: number, monthlyRatePercent: number): InstallmentPlanRow[] {
    const i = monthlyRatePercent / 100
    const { monthlyPayment } = this.quote(principal, months, monthlyRatePercent)
    let balance = principal
    const rows: InstallmentPlanRow[] = []

    for (let number = 1; number <= months; number += 1) {
      const interest = Math.round(balance * i * 100) / 100
      let principalPortion = Math.round((monthlyPayment - interest) * 100) / 100
      if (number === months) principalPortion = Math.round(balance * 100) / 100 // ajusta redondeo en la última cuota
      const totalDue = Math.round((principalPortion + interest) * 100) / 100
      balance = Math.round((balance - principalPortion) * 100) / 100
      rows.push({ number, principal: principalPortion, interest, totalDue })
    }
    return rows
  }
}
