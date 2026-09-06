/**
 * Reparte un pago de cuota entre capital e interés, proporcional a lo que ya componía esa cuota
 * (docs/ROADMAP.md Fase 6 — hallazgo de auditoría: antes se descontaba el pago completo del
 * capital pendiente, mezclando interés cobrado con capital devuelto).
 *
 * Pura y testeable a propósito: es la pieza que decide cuánto baja `Credit.balance` (capital) y
 * cuánto se reconoce como ingreso en la cuenta REVENUE del ledger — un error acá corrompe ambos.
 */
export function splitPrincipalAndInterest(amountPaid: number, installmentPrincipal: number, installmentTotalDue: number) {
  const paidFraction = installmentTotalDue > 0 ? amountPaid / installmentTotalDue : 0
  const principalPortion = Math.round(installmentPrincipal * paidFraction * 100) / 100
  const interestPortion = Math.round((amountPaid - principalPortion) * 100) / 100
  return { principalPortion, interestPortion }
}
