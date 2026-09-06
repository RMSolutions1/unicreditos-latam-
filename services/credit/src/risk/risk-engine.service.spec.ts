import { RiskEngineService } from './risk-engine.service'

describe('RiskEngineService', () => {
  const engine = new RiskEngineService()

  it('sin cuenta bancaria verificada, SIEMPRE fuerza MANUAL_REVIEW sin importar el score', () => {
    const highIncome = engine.assess({ income: 900000, monthlyPayment: 38783, hasDni: true, hasCuil: true, bankVerified: false })
    expect(highIncome.riskLevel).toBe('MANUAL_REVIEW')

    const lowIncome = engine.assess({ income: 50000, monthlyPayment: 38783, hasDni: false, hasCuil: false, bankVerified: null })
    expect(lowIncome.riskLevel).toBe('MANUAL_REVIEW')
  })

  it('con cuenta verificada y buena relación ingreso/cuota, el riesgo es LOW', () => {
    const result = engine.assess({ income: 900000, monthlyPayment: 38783, hasDni: true, hasCuil: true, bankVerified: true })
    expect(result.riskLevel).toBe('LOW')
    expect(result.score).toBeGreaterThanOrEqual(720)
  })

  it('con cuenta verificada y relación ingreso/cuota ajustada, el riesgo escala de MEDIUM a CRITICAL', () => {
    const medium = engine.assess({ income: 100000, monthlyPayment: 38000, hasDni: true, hasCuil: true, bankVerified: true }) // ratio ~2.6
    expect(['MEDIUM', 'HIGH']).toContain(medium.riskLevel)

    const critical = engine.assess({ income: 40000, monthlyPayment: 38000, hasDni: false, hasCuil: false, bankVerified: true }) // ratio ~1.05
    expect(critical.riskLevel).toBe('CRITICAL')
  })

  it('tener DNI y CUIL declarados suma puntos al score frente a no tenerlos', () => {
    const withDocs = engine.assess({ income: 200000, monthlyPayment: 100000, hasDni: true, hasCuil: true, bankVerified: true })
    const withoutDocs = engine.assess({ income: 200000, monthlyPayment: 100000, hasDni: false, hasCuil: false, bankVerified: true })
    expect(withDocs.score).toBeGreaterThan(withoutDocs.score)
  })

  it('el score nunca supera 850', () => {
    const result = engine.assess({ income: 10_000_000, monthlyPayment: 1, hasDni: true, hasCuil: true, bankVerified: true })
    expect(result.score).toBeLessThanOrEqual(850)
  })
})
