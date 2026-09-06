import { Injectable } from '@nestjs/common'
import type { RiskAssessment } from './risk-engine.service'
import { SCORE_REJECT_BELOW } from './risk-engine.service'

export type Decision = 'APPROVE' | 'PRE_APPROVE' | 'MANUAL_REVIEW' | 'REJECT'
export const DECISION_RULES_VERSION = 'decision-rules-v1'

/**
 * Decision Engine (master prompt §32): separado del Risk Engine a propósito. Nunca implica
 * desembolso automático (§33) — solo decide si la solicitud avanza, y a qué cola.
 */
@Injectable()
export class DecisionEngineService {
  decide(risk: RiskAssessment, dtiOk: boolean): Decision {
    if (!dtiOk) return 'REJECT'
    if (risk.score < SCORE_REJECT_BELOW) return 'REJECT'

    switch (risk.riskLevel) {
      case 'CRITICAL':
        return 'REJECT'
      case 'LOW':
        return 'APPROVE'
      case 'MEDIUM':
        return 'PRE_APPROVE'
      case 'HIGH':
      case 'MANUAL_REVIEW':
      default:
        return 'MANUAL_REVIEW'
    }
  }
}
