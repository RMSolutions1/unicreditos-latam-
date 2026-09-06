# ROADMAP.md — UNICRÉDITOS

Orden de construcción por fases (master prompt §112), con criterio CTO de qué es realmente
bloqueante en cada una. Cada fase solo se da por cerrada cuando cumple el "Definition of Done"
(frontend + backend + DB + validaciones + permisos + auditoría + errores + tests + docs +
responsive + accesibilidad + seguridad + observabilidad).

## Fase 1 — Fundaciones (en curso)
- [x] Análisis, árbol de directorios, documentación base (este set de docs).
- [x] Monorepo (npm workspaces) con `/apps` `/services` `/packages`.
- [x] `packages/database`: `schema.prisma` inicial (identidad + RBAC + audit) + migración `init` aplicada.
- [x] `services/identity`: registro, login, refresh tokens rotativos con detección de reuso, RBAC guards — probado de punta a punta contra Postgres real. MFA TOTP queda pendiente (ver abajo).
- [x] `AuditLog` funcionando de punta a punta en `identity` (primer servicio que audita).
- [x] Logs JSON estructurados en `identity` (`JsonLogger`); OpenTelemetry queda para cuando haya más de un servicio corriendo.
- [ ] `packages/ui`: design system base (tokens de `docs/ARCHITECTURE.md` §paleta) + componentes core.
- [ ] MFA TOTP para roles de admin.
- [ ] Rate limiting de `identity` respaldado en Redis (hoy es un placeholder en memoria).
- [ ] Tests automatizados (unit + e2e) de `identity`.
- [ ] CI mínimo: lint + typecheck + unit tests en cada push.

## Fase 2 — Identidad del cliente y KYC
- [x] `services/kyc` + `DiditAdapter` — probado contra la API real de Didit (sin mocks).
- [x] `BankAccountVerificationAdapter` (ArgenAPI) con estados `PENDING/VERIFIED/MISMATCH/REJECTED/ERROR` — probado contra la API real; ahora requiere autenticación (el prototipo la exponía sin auth).
- [ ] `TaxIdentityService` + `ARCAAdapter` (DNI/CUIL/CUIT) — interfaz lista (`ArcaAdapter.isConfigured()`), pero sin credenciales de ARCA todavía; cualquier llamada falla explícitamente con `TAX_PROVIDER_NOT_CONFIGURED` en vez de inventar una respuesta.
- [ ] Cifrado a nivel de columna para `rawResultEncrypted` (hoy el campo existe en el esquema pero no hay cifrado de aplicación todavía — hoy no se está guardando resultado crudo, solo el normalizado).

## Fase 3 — Credit Engine
- [x] `CreditProduct`, `CreditApplication`, `CreditDecision`, `Credit`, `Installment`, `Contract` — probado end-to-end contra Supabase.
- [x] `RiskEngine` (score) separado de `DecisionEngine` (decisión), ambos versionados (`risk-v1` / `decision-rules-v1`) y auditables vía `CreditDecision`.
- [x] Flujo humano obligatorio: solicitud → decisión automática → revisión (RISK_MANAGER/COMPLIANCE_MANAGER) → contrato → desembolso (TREASURY_MANAGER) con segregación de funciones real (no solo documentada) y verificación bancaria obligatoria antes de desembolsar.
- [x] `FinancialCalculationService` en backend (amortización francesa, TNA/TEA/CFT + desglose capital/interés por cuota) — probado con un crédito real de 12 cuotas.
- [ ] Estados adicionales del ciclo completo (VERIFICATION, COMPLIANCE_REVIEW, OVERDUE, IN_COLLECTION, RESTRUCTURED, DEFAULTED, CLOSED) — se agregan con cobranza/ledger.

## Fase 4 — Payment Engine
- [x] `PaymentIntent`, `PaymentRouterService`, `MercadoPagoAdapter` — checkout real creado contra la sandbox de Mercado Pago.
- [x] Webhook con verificación de firma fail-closed (probado: sin firma → 401, firma inválida → 401, firma válida → pasa y llama a la API real), idempotencia por `(provider, providerEventId)` a nivel de constraint de DB.
- [ ] `AstroPayAdapter` — interfaz `PaymentProvider` lista, `PaymentRouterService.resolve()` solo enruta a Mercado Pago para `AR` hoy; se agrega cuando haya credenciales y documentación real.
- [ ] Reconciliación (`/admin/payments/reconciliation`) comparando Provider vs Ledger vs Settlement — Fase 5, cuando exista el ledger.
- [ ] Comprobantes PDF + envío por email — hoy `GET /payment-intents/:id/receipt` devuelve JSON.
- [ ] Completar un pago real en sandbox de punta a punta (requiere túnel HTTPS para que Mercado Pago llegue al webhook local).

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
