# @unicreditos/credit

Credit Engine: productos, solicitudes, motor de riesgo, motor de decisión, contrato y desembolso.
Ver `docs/ROADMAP.md` Fase 3.

## Flujo implementado

```
POST /credit-applications          (CUSTOMER)          → SUBMITTED, evaluado automáticamente
  ↓ RiskEngine + DecisionEngine (separados, master prompt §31/32)
  → APPROVED | PRE_APPROVED | MANUAL_REVIEW | REJECTED

POST /credit-applications/:id/review           (RISK_MANAGER | COMPLIANCE_MANAGER)
  PRE_APPROVED | MANUAL_REVIEW → APPROVED | REJECTED

POST /credit-applications/:id/contract/accept  (CUSTOMER, dueño)
  APPROVED → READY_FOR_DISBURSEMENT (crea el registro de aceptación, nunca se sobrescribe)

POST /credit-applications/:id/disburse         (TREASURY_MANAGER)
  READY_FOR_DISBURSEMENT → DISBURSED (crea Credit + cuotas con amortización francesa real)
```

**Ningún crédito se desembolsa automáticamente** (master prompt §33): incluso una decisión
automática `APPROVE` deja la solicitud en `APPROVED`, no en `DISBURSED` — todavía faltan aceptar
contrato y la aprobación de tesorería.

## Reglas duras que sí se aplican (no solo se documentan)

- **Segregación de funciones**: quien aprobó la solicitud (`CreditDecision.decidedBy`) no puede
  además desembolsarla; tampoco se puede desembolsar el propio crédito.
- **Sin cuenta bancaria verificada, no hay desembolso**: se exige un `BankAccountVerification` con
  `matchStatus = VERIFIED` para ese usuario (dato que produce `services/kyc`).
- **Sin ingreso declarado no se puede ni simular la solicitud**: `income > 0` es precondición.
- **Sin verificación bancaria confirmada, el Risk Engine fuerza `MANUAL_REVIEW`** aunque el score
  sea alto — la falta de verificación de identidad/cuenta es un riesgo en sí mismo, no un dato faltante cualquiera.
- El cálculo financiero (`FinancialCalculationService`) es la única fuente de verdad de
  TNA/TEA/CFT y del desglose capital/interés por cuota — nunca se recalcula en el frontend.

## Correr local

```bash
cp .env.example .env   # JWT_ACCESS_SECRET (el mismo que identity/kyc), DATABASE_URL
npm run build
npm start
```

Requiere `packages/database` con la migración `credit_engine` aplicada y los productos
sembrados (`npm run seed` en `packages/database`).

## Pendiente

- Estados adicionales del ciclo de vida completo (VERIFICATION, COMPLIANCE_REVIEW, OVERDUE,
  IN_COLLECTION, RESTRUCTURED, DEFAULTED, CLOSED) — se incorporan en las fases de cobranza/ledger.
- Pagos de cuotas (Payment Engine, Fase 4) — hoy `Installment.status` queda en `PENDING` tras el desembolso.
