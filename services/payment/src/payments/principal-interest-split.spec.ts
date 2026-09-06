import { splitPrincipalAndInterest } from './principal-interest-split'

describe('splitPrincipalAndInterest', () => {
  it('un pago completo reparte exactamente el capital y el interés originales de la cuota', () => {
    // Cuota real del seed: capital 16283.35, interés 22500, totalDue 38783.35.
    const result = splitPrincipalAndInterest(38783.35, 16283.35, 38783.35)
    expect(result.principalPortion).toBeCloseTo(16283.35, 2)
    expect(result.interestPortion).toBeCloseTo(22500, 2)
  })

  it('principalPortion + interestPortion siempre suma exactamente el monto pagado (sin drift de redondeo)', () => {
    const result = splitPrincipalAndInterest(38783.35, 16283.35, 38783.35)
    expect(Math.round((result.principalPortion + result.interestPortion) * 100) / 100).toBe(38783.35)
  })

  it('un pago parcial (mitad de la cuota) reparte proporcionalmente capital e interés', () => {
    const result = splitPrincipalAndInterest(19391.68, 16283.35, 38783.35) // ~50% de la cuota
    expect(result.principalPortion).toBeCloseTo(8141.68, 1)
    expect(result.interestPortion).toBeCloseTo(11250, 1)
  })

  it('totalDue en 0 no divide por cero: devuelve todo como interés en vez de NaN', () => {
    const result = splitPrincipalAndInterest(100, 50, 0)
    expect(Number.isNaN(result.principalPortion)).toBe(false)
    expect(Number.isNaN(result.interestPortion)).toBe(false)
    expect(result.principalPortion).toBe(0)
  })

  it('regresión: nunca descuenta el pago completo del capital (el bug que existía antes del fix)', () => {
    // Antes del fix, "principalPortion" hubiera sido igual a amountPaid (38783.35) siempre,
    // sin importar cuánto de la cuota era en realidad capital.
    const result = splitPrincipalAndInterest(38783.35, 16283.35, 38783.35)
    expect(result.principalPortion).not.toBe(38783.35)
    expect(result.principalPortion).toBeLessThan(38783.35)
  })
})
