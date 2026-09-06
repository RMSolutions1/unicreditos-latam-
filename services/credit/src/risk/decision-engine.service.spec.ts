import { DecisionEngineService } from './decision-engine.service'
import type { RiskAssessment } from './risk-engine.service'

function risk(overrides: Partial<RiskAssessment>): RiskAssessment {
  return { score: 700, riskLevel: 'LOW', modelVersion: 'test', ...overrides }
}

describe('DecisionEngineService', () => {
  const engine = new DecisionEngineService()

  it('DTI incumplido siempre rechaza, sin importar el riesgo', () => {
    expect(engine.decide(risk({ riskLevel: 'LOW', score: 800 }), false)).toBe('REJECT')
  })

  it('regresión: cuenta bancaria sin verificar (MANUAL_REVIEW) nunca se auto-rechaza aunque el score sea bajo', () => {
    // Hallazgo de auditoría (2026-09-06): el chequeo de score corría antes que este y
    // devolvía REJECT para un score bajo con identidad sin confirmar, en vez de MANUAL_REVIEW.
    const unverifiedLowScore = risk({ riskLevel: 'MANUAL_REVIEW', score: 300 })
    expect(engine.decide(unverifiedLowScore, true)).toBe('MANUAL_REVIEW')
  })

  it('score por debajo del umbral con riesgo evaluado (no MANUAL_REVIEW) rechaza', () => {
    expect(engine.decide(risk({ riskLevel: 'HIGH', score: 500 }), true)).toBe('REJECT')
  })

  it('mapea cada nivel de riesgo verificado a la decisión esperada', () => {
    expect(engine.decide(risk({ riskLevel: 'CRITICAL', score: 800 }), true)).toBe('REJECT')
    expect(engine.decide(risk({ riskLevel: 'LOW', score: 800 }), true)).toBe('APPROVE')
    expect(engine.decide(risk({ riskLevel: 'MEDIUM', score: 700 }), true)).toBe('PRE_APPROVE')
    expect(engine.decide(risk({ riskLevel: 'HIGH', score: 650 }), true)).toBe('MANUAL_REVIEW')
  })
})
