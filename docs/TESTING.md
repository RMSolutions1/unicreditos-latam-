# TESTING.md — UNICRÉDITOS

Fundación de tests automatizados sobre la lógica más crítica del sistema (master prompt §71-74:
"cobertura mínima 80% para lógica crítica, especialmente Ledger, Payments, Loans, Installments,
Risk, Reconciliation"). Esto es el arranque, no el 80% completo — prioriza lo que mueve dinero.

## Por qué esto ahora y no más features

La auditoría de la Fase 6 encontró 9 bugs reales a mano — incluyendo uno de seguridad (auto-
aprobación) y uno de integridad de datos (race condition en el webhook de pagos). Seguir
construyendo funcionalidad nueva sobre lógica de dinero sin una red de pruebas automatizada viola
directamente la regla del propio proyecto: **CORRECTNESS > VELOCIDAD**. Antes de la Fase 9 (Admin
Backoffice), se prioriza esto.

## Qué tiene test hoy

| Paquete/servicio | Qué cubre | Por qué |
|---|---|---|
| `services/credit/src/finance` | Amortización francesa: cuota fija, TNA/TEA/CFT, capital creciente/interés decreciente, suma exacta del capital | Un error acá se replica en cada crédito desembolsado |
| `services/credit/src/risk` | `RiskEngineService` (score, umbrales) + `DecisionEngineService` (mapeo a decisión) | **Regresión directa del bug encontrado hoy**: cuenta bancaria sin verificar debía forzar `MANUAL_REVIEW` sin importar el score, y el orden de checks lo rompía |
| `packages/ledger` | Guard de balance (`postLedgerTransaction` rechaza y no escribe nada si débitos ≠ créditos), reuso de cuentas globales, `getAccountBalance` recalculado desde cero | Es la fuente de verdad de todo el dinero del sistema |
| `services/payment/src/payments/principal-interest-split.ts` | Reparto capital/interés de un pago, incluida una prueba de regresión explícita del bug de Fase 6 (antes se descontaba el pago completo del capital) | Corrompía `Credit.balance` y el reconocimiento de ingresos en el ledger |

## Correr los tests

```bash
npm test --workspace services/credit
npm test --workspace services/payment
npm test --workspace @unicreditos/ledger
```

## Cómo están armados

- Jest + ts-jest, cada paquete con su propio `jest.config.js` y `tsconfig.spec.json` (extiende el
  tsconfig de build pero agrega los tipos de `jest`) para no filtrar tipos de test al build de
  producción — `tsconfig.build.json`/`tsconfig.json` excluyen `**/*.spec.ts` explícitamente.
- `packages/ledger` prueba `postLedgerTransaction`/`getAccountBalance` contra un fake en memoria
  del `Prisma.TransactionClient` (no una base real) — son pruebas unitarias de la lógica, no de
  integración con Postgres. Las pruebas de integración reales (webhook completo, flujo de
  desembolso) quedan pendientes y requieren una base de test separada de la de desarrollo.

## Pendiente (para llegar al 80% del master prompt)

- Tests de integración de `services/identity` (auth, refresh rotation, rate limiting).
- Tests de integración del flujo completo de `services/credit` (solicitud → revisión → desembolso).
- Tests del webhook de `services/payment` (idempotencia, fail-closed de firma) — hoy solo probado
  manualmente en las Fases 4-6.
- Tests de `services/collection` (umbrales de mora, idempotencia del scan).
- CI (GitHub Actions) que corra `npm test` en cada push — todavía no existe.
- Una base de datos de test separada de la de desarrollo/Supabase para pruebas de integración
  reales sin tocar datos de la app.
