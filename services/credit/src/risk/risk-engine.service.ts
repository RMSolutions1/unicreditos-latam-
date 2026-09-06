import { Injectable } from '@nestjs/common'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'MANUAL_REVIEW'

export type RiskInput = {
  income: number
  monthlyPayment: number
  hasDni: boolean
  hasCuil: boolean
  bankVerified: boolean | null // null = todavía no se validó CBU/alias
}

export type RiskAssessment = {
  score: number
  riskLevel: RiskLevel
  modelVersion: string
}

export const RISK_MODEL_VERSION = 'risk-v1'
export const SCORE_REJECT_BELOW = 560

/**
 * Risk Engine (master prompt §31): produce un score y un nivel de riesgo, separado del
 * Decision Engine que traduce eso en una decisión de negocio (docs/ARCHITECTURE.md §5).
 */
@Injectable()
export class RiskEngineService {
  assess(input: RiskInput): RiskAssessment {
    let score = 520
    const ratio = input.monthlyPayment > 0 ? input.income / input.monthlyPayment : 0

    if (ratio >= 4) score += 180
    else if (ratio >= 2.6) score += 140
    else if (ratio >= 1.8) score += 70
    else if (ratio >= 1.2) score += 20

    if (input.hasCuil) score += 25
    if (input.hasDni) score += 20
    score = Math.min(850, score)

    // Sin verificación bancaria confirmada, el caso va siempre a revisión manual —
    // no es un problema de score, es un problema de identidad no confirmada.
    if (input.bankVerified !== true) {
      return { score, riskLevel: 'MANUAL_REVIEW', modelVersion: RISK_MODEL_VERSION }
    }

    let riskLevel: RiskLevel = 'CRITICAL'
    if (score >= 720) riskLevel = 'LOW'
    else if (score >= 620) riskLevel = 'MEDIUM'
    else if (score >= SCORE_REJECT_BELOW) riskLevel = 'HIGH'

    return { score, riskLevel, modelVersion: RISK_MODEL_VERSION }
  }
}
