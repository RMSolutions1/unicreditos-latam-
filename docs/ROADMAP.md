# ROADMAP.md — UNICRÉDITOS

Orden de construcción por fases (master prompt §112), con criterio CTO de qué es realmente
bloqueante en cada una. Cada fase solo se da por cerrada cuando cumple el "Definition of Done"
(frontend + backend + DB + validaciones + permisos + auditoría + errores + tests + docs +
responsive + accesibilidad + seguridad + observabilidad).

## Fase 1 — Fundaciones (en curso)
- [x] Análisis, árbol de directorios, documentación base (este set de docs).
- [ ] Monorepo (pnpm workspaces o Turborepo) con `/apps` `/services` `/packages`.
- [ ] `packages/database`: `schema.prisma` inicial (identidad + RBAC + audit) + migraciones.
- [ ] `services/identity`: registro, login, refresh tokens, MFA TOTP, RBAC guards.
- [ ] `packages/ui`: design system base (tokens de `docs/ARCHITECTURE.md` §paleta) + componentes core.
- [ ] `packages/logging`: logs JSON estructurados + OpenTelemetry.
- [ ] `AuditLog` funcionando de punta a punta en `identity` (primer servicio que audita).
- [ ] CI mínimo: lint + typecheck + unit tests en cada push.

## Fase 2 — Identidad del cliente y KYC
- [ ] `services/kyc` + `DiditAdapter` (real, sin mocks fuera de test/dev).
- [ ] `TaxIdentityService` + `ARCAAdapter` (DNI/CUIL/CUIT).
- [ ] `BankAccountVerificationAdapter` (ArgenAPI) con estados `PENDING/VERIFIED/MISMATCH/REJECTED/ERROR`.
- [ ] Política de minimización y cifrado de datos sensibles (`docs/SECURITY.md` §4) implementada, no solo documentada.

## Fase 3 — Credit Engine
- [ ] `CreditProduct`, `CreditApplication`, `Credit`, `Installment`, `Contract`.
- [ ] `RiskEngine` (score) separado de `DecisionEngine` (decisión), ambos versionados y auditables.
- [ ] Flujo humano obligatorio: Preapproval → Risk Review → Compliance → Manual Approval → Treasury Approval → Disbursement.
- [ ] `FinancialCalculationService` en backend (amortización francesa, TNA/TEA/CFT) — el frontend nunca calcula.

## Fase 4 — Payment Engine
- [ ] `PaymentIntent`, `PaymentRouterService`, `MercadoPagoAdapter`.
- [ ] `WebhookGateway` con verificación de firma fail-closed, idempotencia por `(provider, providerEventId)`, replay protection.
- [ ] `AstroPayAdapter` construido contra la interfaz `PaymentProvider` pero **apagado** (`ENABLE_ASTROPAY=false`) hasta tener credenciales y documentación real.
- [ ] Reconciliación (`/admin/payments/reconciliation`) comparando Provider vs Ledger vs Settlement.
- [ ] Comprobantes PDF + envío por email.

## Fase 5 — Ledger y Tesorería
- [ ] Ledger de doble entrada operando para desembolsos y pagos de cuota (reemplaza cualquier campo `balance` mutable directo).
- [ ] Treasury dashboard: fondos disponibles/comprometidos, desembolsos, cobros, liquidaciones.
- [ ] Transacciones DB atómicas en la cadena "pago aprobado → asiento ledger → cuota actualizada → crédito actualizado → audit event".

## Fase 6 — Cobranzas y notificaciones
- [ ] `CollectionService` con estados de mora y plantillas configurables (cobranza responsable, sin acoso).
- [ ] `NotificationEngine` (email ya, SMS/WhatsApp cuando exista integración autorizada) sobre colas.
- [ ] Pago parcial, pago anticipado (`EarlySettlementService` sobre `ProductRules`, sin reglas hardcodeadas), refinanciación.

## Fase 7 — Investor Portal (bloqueado hasta validación legal, ver SECURITY.md §1)
- [ ] Modelo de datos y ledger de inversión ya soportan esto (Fase 5); UI e API se activan solo con `ENABLE_INVESTOR_MODULE=true` y sign-off legal.
- [ ] `DataAccessPolicy` que impide al inversor ver PII del deudor.

## Fase 8 — Merchant Portal
- [ ] Financiación de consumo en comercios adheridos sobre el mismo Credit Engine (producto `MERCHANT`).

## Fase 9 — Admin Backoffice completo
- [ ] CEO / Risk / Treasury / Payment / Compliance dashboards (métricas de `docs/ARCHITECTURE.md`).
- [ ] Tablas admin con búsqueda, filtros, orden, paginación, export asíncrono (`ExportJob`).

## Fase 10 — Hardening de producción
- [ ] Backups diarios cifrados + verificación de restore, PITR si la infraestructura lo permite.
- [ ] Runbook de disaster recovery con RPO/RTO documentados.
- [ ] Pruebas de carga en `payment`/`ledger`.
- [ ] Pipeline completo: lint → typecheck → unit → integration → build → security scan → docker build → deploy staging → smoke tests → aprobación → deploy production.

## Riesgos técnicos abiertos (ver también SECURITY.md §1 para los regulatorios)
1. Monolito modular vs. microservicios reales — decisión tomada: monolito modular en Fase 1-6, separar por necesidad real de escala/aislamiento después (ver ARCHITECTURE.md §9).
2. Event bus: BullMQ alcanza para colas; falta decidir outbox pattern para no perder eventos financieros si Redis cae.
3. AstroPay: sin documentación de API confirmada todavía — no se inventa su contrato.
4. Definir proveedor de Object Storage (S3-compatible) y política de retención de documentos/biometría antes de Fase 2.
