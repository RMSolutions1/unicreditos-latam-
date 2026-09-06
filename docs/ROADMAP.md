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
- [x] **`apps/customer` — portal real del cliente** (2026-09-06): registro/login, perfil (DNI/CUIL/ingreso), verificación de identidad (Didit real), catálogo + simulador (`POST /simulate`, TNA/TEA/CFT reales), solicitar crédito (`POST /credit-applications`), mis solicitudes con historial de decisiones y aceptar contrato, mis créditos con cuotas y pago real (crea un `PaymentIntent` real vía Mercado Pago o AstroPay). Mismo stack que `apps/admin` (Vite + TypeScript sin framework, no Next.js como decía el árbol de carpetas original — se actualiza `ARCHITECTURE.md` para reflejarlo). Probado en vivo de punta a punta: registro real, perfil real, simulación con tasas reales, dos solicitudes reales evaluadas por el motor de riesgo real (`MANUAL_REVIEW` correcto por falta de verificación bancaria, no un bug), y un intento real de KYC que expuso que la cuenta de Didit se quedó sin créditos (`KYC_PROVIDER_UNAVAILABLE`, manejado explícito, no oculto). El flujo de pago de cuota (crear `PaymentIntent` + redirigir al checkout) no se probó en vivo todavía porque requiere un crédito desembolsado (acción de staff en `apps/admin`, fuera del alcance de esta sesión).

## Fase 4 — Payment Engine
- [x] `PaymentIntent`, `PaymentRouterService`, `MercadoPagoAdapter` — checkout real creado contra la sandbox de Mercado Pago.
  - **Credenciales de producción reales recibidas y confirmadas en vivo (2026-09-06)**: `POST /checkout/preferences` contra `api.mercadopago.com` con el `access_token` `APP_USR-...` real devuelve `201` con un `init_point` real (no se completó el pago). El servicio local (`services/payment`) corre con estas credenciales cargadas desde ese momento — **cualquier `PaymentIntent` creado desde la app ahora genera un checkout real**, ya no es imposible por diseño como con el token `TEST-` anterior.
  - **Confirmado el bloqueante ya documentado de webhook**: `notification_url` en producción debe ser una URL pública HTTPS — Mercado Pago rechaza `http://127.0.0.1:...` con `400 invalid_notification_url`. `MercadoPagoAdapter` ya maneja esto correctamente (solo manda `notification_url` si empieza con `https://`), pero significa que sin túnel HTTPS público, el webhook de un pago real completado nunca nos llegaría — el pago quedaría completado en Mercado Pago pero nunca se acreditaría en el ledger. No completar pagos reales hasta resolver esto.
- [x] Webhook con verificación de firma fail-closed (probado: sin firma → 401, firma inválida → 401, firma válida → pasa y llama a la API real), idempotencia por `(provider, providerEventId)` a nivel de constraint de DB.
- [x] `AstroPayAdapter` (`services/payment/src/providers/astropay.adapter.ts`) — construido contra la documentación real de AstroPay (OAuth client_credentials, `POST /v1/payments` Offsite Checkout, verificación de firma RSA vía `GET /v1/certificates`). **Wireado en `PaymentRouterService`** detrás de `ENABLE_ASTROPAY` (default `false`): decisión de negocio tomada — AstroPay **convive** con Mercado Pago para `AR` (no lo reemplaza), el cliente elige el proveedor al crear el `PaymentIntent` (`POST /payment-intents { installmentId, provider? }`), sin preferencia el default es Mercado Pago.
  - **Confirmado en vivo (2026-09-06)**: un único host, `partners-api.astropay.com`, sirve auth (`POST /v1/partners/oauth/token`), certificados y pagos — la tabla "Environments" de la guía prosa pública resultó incorrecta/inaplicable; se corrigió el adapter para usar un host único configurable (`ASTROPAY_BASE_URL`).
  - **Bug real encontrado y corregido en auditoría (2026-09-06)**: el `400 { "method": "is required" }` que bloqueaba `POST /v1/payments` se debía a que la guía prosa "Accept AstroPay → Checkout" (la primera que se leyó) no lista varios campos reales. Existe una página de referencia distinta y autoritativa, "Platform → Payments", que documenta el schema real: `method: "CHECKOUT"` (requerido), la referencia del pedido va en `order.id` (no `merchant_payment_id` a nivel raíz), `callback_notification` se puede fijar por request (no es fijo en el dashboard como se pensó), y existe `GET /v1/payments/{id}?method=CHECKOUT` documentado — `AstroPayAdapter.getPayment()` ya no falla explícito, hace la consulta real.
  - **Fix de seguridad en el camino**: `createCheckout` devolvía el body de error crudo de AstroPay directo al cliente final vía `DomainError.message`. Ahora se loguea server-side y el cliente recibe un mensaje genérico.
  - **Tests reales agregados**: firma RSA de `AstroPayAdapter` verificada con un par de claves generado en el test (no un mock del comportamiento de AstroPay), cubriendo los 4 caminos de rechazo; `PaymentRouterService` probado contra instancias reales de los adapters.
  - **`POST /v1/payments` confirmado exitoso en producción (2026-09-06, autorizado explícitamente por el negocio, monto mínimo 100 ARS, credenciales de producción reales)**: `200 OK` con `payment_external_id` real, dos veces (con y sin objeto `user` completo). El fix del campo `method: "CHECKOUT"` es correcto y funciona contra la API real.
  - **Bloqueante nuevo, de cuenta, no de código**: la respuesta NO trae `redirect_url` ni `status`, y `payment_methods` viene vacío (`[]`) en ambas pruebas — no hay forma de que un usuario complete este pago (no hay a dónde redirigirlo). No cambió al mandar `user.email`/`user.phone_number` completos, descartando que sea un campo faltante del request. Indica que la cuenta merchant de AstroPay no está completamente habilitada para `method: CHECKOUT` en producción (aprobación/KYB pendiente, o método de pago no habilitado para `country: AR` del lado de AstroPay) — **requiere contactar al account manager de AstroPay**, no es algo resoluble desde el código. Sin `redirect_url` no hay riesgo real: los 2 pagos de prueba creados (`payment_external_id` reales, visibles en el panel de AstroPay) quedan inertes, nadie puede pagarlos.
  - Nota aparte: las primeras credenciales de producción que se probaron (antes de este fix) empezaron a devolver `401 Unauthorized` de forma intermitente después de haber funcionado una vez — el usuario proveyó un segundo set de credenciales de producción ("esto es de producción") que sí autenticó consistentemente y fue el que se usó para las pruebas de arriba. No se investigó por qué el primer set dejó de funcionar.
  - El algoritmo de firma del webhook (RSA-SHA256) y el mapeo `order.id` → `merchant_payment_id` del callback siguen sin confirmar contra un callback real (no se puede completar el pago hasta resolver el punto de arriba). `ENABLE_ASTROPAY` permanece en `false` hasta que: (1) la cuenta esté habilitada para completar pagos, y (2) se confirme un webhook real de punta a punta.
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
- [x] Usuarios: `GET /users` (listado paginado y filtrable por rol/estado/búsqueda) y `PATCH /users/:id` (cambio de rol/estado) nuevos en `identity` — lectura para `SUPER_ADMIN/CEO/COMPLIANCE_MANAGER/SUPPORT/AUDITOR/OPERATIONS_MANAGER`, edición restringida a `SUPER_ADMIN` únicamente (escalamiento de privilegios) y siempre auditada (`USER_ROLE_OR_STATUS_CHANGED` con before/after real). Probado en vivo: listado real (10 cuentas), búsqueda, RBAC (403 para `CUSTOMER`), cambio de estado desde la UI confirmado contra la API.
- [ ] Clientes, Comercios, Compliance, Fraude, Documentos, Contratos, Reportes, Notificaciones, Configuración, Sistema.
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
