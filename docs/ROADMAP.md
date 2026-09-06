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
- [x] CI mínimo en GitHub Actions (`.github/workflows/ci.yml`): lint (ESLint 10 + typescript-eslint), build de todos los paquetes/servicios, typecheck de `apps/admin` y los 28 tests unitarios en cada push/PR a `main` — corrido real verificado en verde ([run 34034756872](https://github.com/RMSolutions1/unicreditos-latam-/actions/runs/34034756872)).

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
- [x] `AstroPayAdapter` (`services/payment/src/providers/astropay.adapter.ts`) — construido contra la documentación real de AstroPay (OAuth client_credentials, `POST /v1/payments` Offsite Checkout, verificación de firma RSA vía `GET /v1/certificates`). **Wireado en `PaymentRouterService`** detrás de `ENABLE_ASTROPAY` (default `false`): decisión de negocio tomada — AstroPay **convive** con Mercado Pago para `AR` (no lo reemplaza), el cliente elige el proveedor al crear el `PaymentIntent` (`POST /payment-intents { installmentId, provider? }`), sin preferencia el default es Mercado Pago.
  - **Confirmado en vivo (2026-09-06)**: un único host, `partners-api.astropay.com`, sirve auth (`POST /v1/partners/oauth/token`), certificados y pagos — la tabla "Environments" de la guía prosa pública resultó incorrecta/inaplicable; se corrigió el adapter para usar un host único configurable (`ASTROPAY_BASE_URL`).
  - **Bug real encontrado y corregido en auditoría (2026-09-06)**: el `400 { "method": "is required" }` que bloqueaba `POST /v1/payments` se debía a que la guía prosa "Accept AstroPay → Checkout" (la primera que se leyó) no lista varios campos reales. Existe una página de referencia distinta y autoritativa, "Platform → Payments", que documenta el schema real: `method: "CHECKOUT"` (requerido), la referencia del pedido va en `order.id` (no `merchant_payment_id` a nivel raíz), `callback_notification` se puede fijar por request (no es fijo en el dashboard como se pensó), y existe `GET /v1/payments/{id}?method=CHECKOUT` documentado — `AstroPayAdapter.getPayment()` ya no falla explícito, hace la consulta real.
  - **Fix de seguridad en el camino**: `createCheckout` devolvía el body de error crudo de AstroPay directo al cliente final vía `DomainError.message`. Ahora se loguea server-side y el cliente recibe un mensaje genérico.
  - **Tests reales agregados**: firma RSA de `AstroPayAdapter` verificada con un par de claves generado en el test (no un mock del comportamiento de AstroPay), cubriendo los 4 caminos de rechazo; `PaymentRouterService` probado contra instancias reales de los adapters.
  - **Bloqueante que sigue sin resolverse**: nunca se completó una llamada real exitosa a `POST /v1/payments` (ni sandbox ni producción). Al reintentar el `POST /v1/partners/oauth/token` contra producción tras el fix, la respuesta fue inconsistente entre corridas — un intento devolvió `401 Unauthorized` con las mismas credenciales que antes habían dado `200 OK`. No se investigó la causa (rotación de credenciales del lado de AstroPay, límite de rate, o algo puntual de la corrida) — **queda pendiente que el usuario lo confirme directamente contra su panel de AstroPay** antes de cualquier intento adicional. El algoritmo de firma del webhook (RSA-SHA256) y el mapeo `order.id` → `merchant_payment_id` del callback siguen sin confirmar contra una respuesta real. `ENABLE_ASTROPAY` permanece en `false`.
  - Mercado Pago tampoco está listo para producción real: las credenciales configuradas son `TEST-...` (sandbox), nunca se recibieron credenciales de producción, y nunca se completó un pago real de punta a punta con webhook (requiere túnel HTTPS, ver ítem debajo).
  - `ENABLE_ASTROPAY` permanece en `false` hasta resolver el campo `method` y probar un pago + webhook de punta a punta en sandbox.
- [ ] Reconciliación (`/admin/payments/reconciliation`) comparando Provider vs Ledger vs Settlement — Fase 5, cuando exista el ledger.
- [ ] Comprobantes PDF + envío por email — hoy `GET /payment-intents/:id/receipt` devuelve JSON.
- [ ] Completar un pago real en sandbox de punta a punta (requiere túnel HTTPS para que Mercado Pago llegue al webhook local).

## Fase 5 — Ledger y Tesorería
- [x] Ledger de doble entrada (`packages/ledger`) operando para desembolsos y pagos de cuota — probado contra Supabase, incluyendo el guard que rechaza transacciones desbalanceadas (0 filas escritas, rollback limpio confirmado).
- [x] Treasury dashboard (`services/ledger`, puerto 3104): fondos, total desembolsado, total cobrado — probado con datos reales.
- [x] Transacciones DB atómicas en la cadena "desembolso → Credit + Installments → asiento de ledger → audit event" y "pago aprobado → asiento de ledger → cuota actualizada → crédito actualizado → audit event" — ambas dentro de un único `prisma.$transaction`.
- [x] `GET /treasury/reconciliation`: compara `Credit.balance` cacheado contra el saldo implícito del ledger — detectó correctamente que los créditos desembolsados antes de esta fase no tienen asientos históricos (no se hizo backfill; queda documentado, no oculto).
- [ ] Liquidaciones a inversores — bloqueado hasta resolución legal de `ENABLE_INVESTOR_MODULE` (docs/SECURITY.md §1).
- [ ] Backfill de ledger para los créditos desembolsados antes de esta fase (opcional, a decidir con el negocio).

## Fase 6 — Cobranzas y notificaciones
- [x] `CollectionService` (`services/collection`) con estados de mora calculados desde fechas de vencimiento reales — probado con un atraso simulado explícitamente (10 días), detectó `OVERDUE` correctamente y marcó la cuota vencida.
- [x] `NotificationEngine` (`packages/notifications`): email real vía Resend, catálogo fijo de eventos (`CREDIT_DISBURSED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `KYC_APPROVED`, `KYC_REJECTED`) conectado a desembolso, pago y mora. SMS/WhatsApp y colas quedan pendientes (sin Redis/BullMQ todavía).
- [x] `EarlySettlementService` (cotización) en `services/credit`: `GET /credits/:id/early-settlement/quote` devuelve el capital pendiente real (no "lo que falta cobrar" con interés incluido — bug corregido en el camino, ver más abajo). Ejecutar la liquidación en un solo pago queda pendiente (requiere que `installmentId` sea opcional en `PaymentIntent`).
- [ ] Pago parcial — el modelo ya lo soporta (`InstallmentStatus.PARTIALLY_PAID`) pero no se probó un caso real de punta a punta.
- [ ] Refinanciación / reprogramación — no implementado.
- [ ] Cron real para el scan de cobranza (hoy es manual bajo demanda) — pendiente de Redis/BullMQ.

**Fix de correctness incluido**: `Credit.balance` se descontaba por el pago TOTAL (capital + interés) en cada cuota pagada, no solo por el capital — inflaba la velocidad de amortización y hubiera dado una cotización de pago anticipado incorrecta. Se corrigió en `services/payment` para descontar solo la porción de capital, y el ledger ahora reconoce el interés como ingreso en una cuenta `REVENUE` separada (antes iba todo a la cuenta del cliente).

## Fase 7 — Investor Portal (bloqueado hasta validación legal, ver SECURITY.md §1)
- [ ] Modelo de datos y ledger de inversión ya soportan esto (Fase 5); UI e API se activan solo con `ENABLE_INVESTOR_MODULE=true` y sign-off legal.
- [ ] `DataAccessPolicy` que impide al inversor ver PII del deudor.

## Fase 8 — Merchant Portal
- [ ] Financiación de consumo en comercios adheridos sobre el mismo Credit Engine (producto `MERCHANT`).

## Fase 9 — Admin Backoffice (en construcción)
- [x] Dashboard con métricas reales (tesorería, cola de solicitudes, casos de cobranza, productos).
- [x] Solicitudes: cola de revisión (aprobar/rechazar) + cola de desembolso + detalle, probado end-to-end en el navegador.
- [x] Créditos: listado completo + cuotas por crédito.
- [x] Cobranzas: casos activos, disparar el scan, registrar acciones.
- [x] Tesorería: dashboard + reconciliación con las diferencias resaltadas visualmente.
- [x] Auditoría: lectura de `AuditLog` (append-only) con filtros por recurso/acción, paginación y detalle antes/después — `GET /audit-logs` en `identity`, restringido a `SUPER_ADMIN/CEO/COMPLIANCE_MANAGER/AUDITOR`, probado en vivo contra 60 eventos reales.
- [ ] Usuarios, Clientes, Comercios, Compliance, Fraude, Documentos, Contratos, Reportes, Notificaciones, Configuración, Sistema.
- [ ] Tablas admin con búsqueda, filtros, orden, paginación, export asíncrono (`ExportJob`).
- [ ] Inversores — bloqueado hasta validación legal (Fase 7).

## Fase 10 — Hardening de producción
- [ ] Backups diarios cifrados + verificación de restore, PITR si la infraestructura lo permite.
- [ ] Runbook de disaster recovery con RPO/RTO documentados.
- [ ] Pruebas de carga en `payment`/`ledger`.
- [ ] Pipeline completo: lint → typecheck → unit → integration → build → security scan → docker build → deploy staging → smoke tests → aprobación → deploy production.

## Riesgos técnicos abiertos (ver también SECURITY.md §1 para los regulatorios)
1. Monolito modular vs. microservicios reales — decisión tomada: monolito modular en Fase 1-6, separar por necesidad real de escala/aislamiento después (ver ARCHITECTURE.md §9).
2. Event bus: BullMQ alcanza para colas; falta decidir outbox pattern para no perder eventos financieros si Redis cae.
3. AstroPay: wireado y conviviendo con Mercado Pago para `AR` detrás de `ENABLE_ASTROPAY` — activarlo en producción sin haber podido probar contra sandbox es una decisión de negocio explícita, no un detalle técnico pendiente.
4. Definir proveedor de Object Storage (S3-compatible) y política de retención de documentos/biometría antes de Fase 2.
