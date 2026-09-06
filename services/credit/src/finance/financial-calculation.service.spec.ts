import { FinancialCalculationService } from './financial-calculation.service'

describe('FinancialCalculationService', () => {
  const finance = new FinancialCalculationService()

  describe('quote', () => {
    it('calcula la cuota fija del sistema francés para el caso semilla (450000, 12, 7.5%)', () => {
      const quote = finance.quote(450000, 12, 7.5)
      // Valor de la fórmula estándar de amortización francesa, calculado independientemente.
      expect(quote.monthlyPayment).toBeCloseTo(58175.02, 1)
      expect(quote.amount).toBe(450000)
      expect(quote.months).toBe(12)
    })

    it('con tasa 0% reparte el capital en partes iguales sin interés', () => {
      const quote = finance.quote(120000, 12, 0)
      expect(quote.monthlyPayment).toBe(10000)
      expect(quote.totalInterest).toBe(0)
      expect(quote.total).toBe(120000)
    })

    it('TNA es la TEM mensual multiplicada por 12', () => {
      const quote = finance.quote(100000, 6, 5)
      expect(quote.tna).toBeCloseTo(60, 5)
    })

    it('CFT siempre es mayor a la TEA por el IVA sobre intereses', () => {
      const quote = finance.quote(100000, 6, 5)
      expect(quote.cft).toBeGreaterThan(quote.tea)
    })
  })

  describe('buildInstallmentPlan', () => {
    it('el capital de cada cuota es creciente y el interés decreciente (amortización francesa)', () => {
      const plan = finance.buildInstallmentPlan(300000, 6, 7.5)
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].principal).toBeGreaterThan(plan[i - 1].principal)
        expect(plan[i].interest).toBeLessThan(plan[i - 1].interest)
      }
    })

    it('la suma del capital de todas las cuotas es exactamente el monto original', () => {
      const principal = 300000
      const plan = finance.buildInstallmentPlan(principal, 6, 7.5)
      const totalPrincipal = plan.reduce((sum, row) => sum + row.principal, 0)
      expect(Math.round(totalPrincipal * 100) / 100).toBeCloseTo(principal, 1)
    })

    it('todas las cuotas menos la última tienen el mismo totalDue (cuota fija)', () => {
      const plan = finance.buildInstallmentPlan(300000, 6, 7.5)
      const first = plan[0].totalDue
      for (const row of plan.slice(0, -1)) {
        expect(row.totalDue).toBeCloseTo(first, 2)
      }
    })

    it('genera exactamente `months` cuotas numeradas correlativamente', () => {
      const plan = finance.buildInstallmentPlan(50000, 4, 8.2)
      expect(plan).toHaveLength(4)
      expect(plan.map((r) => r.number)).toEqual([1, 2, 3, 4])
    })
  })
})
