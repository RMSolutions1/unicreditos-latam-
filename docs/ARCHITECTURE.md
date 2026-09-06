# ARCHITECTURE.md — UNICRÉDITOS

## 1. Qué es esto

UNICRÉDITOS deja de ser una "web de préstamos" (SPA + Express + store en memoria) y pasa a ser
**infraestructura financiera digital**: un monorepo modular con servicios de dominio independientes,
un ledger contable como fuente de verdad de todos los saldos, y motores separados de riesgo, KYC,
pagos, compliance, fraude y cobranzas. Ningún desembolso o pago se marca exitoso sin confirmación
real del proveedor correspondiente (Mercado Pago, AstroPay, Didit, BCRA, ARCA, ArgenAPI).

El proyecto actual (`src/`, `server/` en la raíz) es un prototipo funcional que sirvió para validar
UX y flujos. Se conserva como referencia de producto pero **no es la base de código de producción**:
la nueva arquitectura vive en `/apps`, `/services`, `/packages`.

## 2. Vista de componentes

```mermaid
flowchart TB
  subgraph Frontends
    WEB[apps/web<br/>sitio público]
    CUST[apps/customer<br/>/app]
    INV[apps/investor<br/>/investor — OFF por defecto]
    MERCH[apps/merchant]
    ADMIN[apps/admin<br/>backoffice]
  end

  subgraph API["API Gateway (REST + OpenAPI, /api/v1)"]
    GW[NestJS API Gateway]
  end

  subgraph Servicios de dominio
    IDN[identity]
    KYC[kyc]
    RISK[risk]
    CREDIT[credit]
    PAY[payment]
    COLL[collection]
    LEDGER[ledger]
    TREAS[treasury]
    COMP[compliance]
    FRAUD[fraud]
    NOTIF[notification]
    REPORT[reporting]
  end

  subgraph Infra
    PG[(PostgreSQL)]
    REDIS[(Redis)]
    QUEUE[[BullMQ]]
    S3[(Object Storage)]
  end

  subgraph Proveedores externos
    MP[Mercado Pago]
    ASTRO[AstroPay]
    DIDIT[Didit]
    ARCA[ARCA]
    BCRA[BCRA]
    ARGEN[ArgenAPI]
    RESEND[Resend / SMS / WhatsApp]
  end

  Frontends --> GW
  GW --> IDN & KYC & RISK & CREDIT & PAY & COLL & LEDGER & TREAS & COMP & FRAUD & NOTIF & REPORT
  KYC --> DIDIT & ARCA
  RISK --> BCRA
  CREDIT --> ARGEN
  PAY --> MP & ASTRO
  NOTIF --> RESEND
  CREDIT --> LEDGER
  PAY --> LEDGER
  TREAS --> LEDGER
  IDN & KYC & RISK & CREDIT & PAY & COLL & LEDGER & TREAS & COMP & FRAUD & NOTIF & REPORT --> PG
  Servicios de dominio --> REDIS
  Servicios de dominio --> QUEUE
  KYC & CREDIT --> S3
```

## 3. Principio de separación: Payment Engine

Regla no negociable (sección 14 del master prompt): **`Loan` nunca llama directo a Mercado Pago.**

```
Loan → Installment → PaymentIntent → PaymentRouter → ProviderAdapter → PaymentProvider
```

- `PaymentIntent` es la entidad persistida con `idempotencyKey` único.
- `PaymentRouterService` decide proveedor/método por país+moneda+reglas, sin que `credit` conozca a MP/AstroPay.
- Agregar un proveedor nuevo = un `ProviderAdapter` nuevo, sin tocar `credit` ni `ledger`.
- El estado final de un pago **siempre** viene del webhook firmado del proveedor, nunca del retorno del checkout en el browser.

## 4. Ledger como fuente de verdad

Nunca `balance = balance + amount`. Todo movimiento de dinero (desembolso, pago, reembolso, comisión,
liquidación a inversor) es un asiento de doble entrada en `LedgerEntry`, agrupado en una `Transaction`.
`Credit.balance` e `Investment.balance` son **vistas derivadas** del ledger, recalculables — nunca
el dato primario.

## 5. Human-in-the-loop obligatorio

Ningún crédito se desembolsa automáticamente. Flujo mínimo:

```
Preapproval → Risk Review → Compliance → Manual Approval → Treasury Approval → Disbursement
```

`RiskEngine` produce un score/nivel; `DecisionEngine` (separado) traduce ese nivel en
`APPROVE | PRE_APPROVE | MANUAL_REVIEW | REJECT`, pero el desembolso requiere un actor humano con
rol autorizado (RBAC) más aprobación de tesorería. Toda decisión queda en `AuditLog` con modelo,
versión de reglas, inputs y resultado.

## 6. Multipaís desde el core

`Country`, `Currency`, `TaxRules`, `CreditRules`, `PaymentMethods`, `PaymentProviders`,
`ComplianceRules` y `DocumentTypes` son configuración, no código. Argentina es el primer dataset,
no un valor hardcodeado en `credit`/`payment`.

## 7. Dominios de datos (Data Ownership)

| Dominio | Dueño | Acceso |
|---|---|---|
| Datos personales del cliente (teléfono, email, domicilio, DNI, selfie) | `identity` / `kyc` | Cliente, admin autorizado. **Nunca** el inversor. |
| Datos financieros (score, deuda BCRA cruda) | `risk` | Risk/Compliance/Auditor. Cifrado en reposo. |
| Ledger y transacciones | `ledger` | Treasury/CFO/Auditor. Solo lectura para el resto. |
| Documentos (contratos, comprobantes, DNI) | `documents` (S3 + metadata en PG) | Según `DataAccessPolicy` por rol. |
| Audit logs | `audit` | Solo lectura, nadie puede borrar desde la UI. |

Ver `docs/SECURITY.md` §"Privacidad del deudor frente al inversor" para el detalle de qué campos
puede ver un inversor (ninguno de los de la tabla de arriba salvo lo que el contrato de inversión
permita explícitamente, y sin PII identificable).

## 8. Árbol de carpetas

```
/docs            → este set de documentos
/architecture    → ADRs y diagramas adicionales
/database        → schema.prisma, migraciones, seeds
/apps
  web/           → sitio público (Next.js)
  customer/      → portal cliente (Next.js) — /app
  investor/      → portal inversor (Next.js) — /invest, OFF por defecto
  merchant/      → portal comercio (Next.js)
  admin/         → backoffice (Next.js) — /admin
/services
  identity/ kyc/ risk/ credit/ payment/ collection/
  ledger/ treasury/ compliance/ fraud/ notification/ reporting/
  (cada uno: NestJS module + Prisma access propio + tests)
/packages
  ui/ auth/ database/ config/ logging/ validation/ events/ security/
/infrastructure  → Dockerfiles, docker-compose, Nginx, CI/CD, IaC
/tests           → e2e y contract tests cross-servicio
```

## 9. Riesgos técnicos a resolver antes de Fase 4 (Pagos)

1. **Elección de topología**: monolito modular NestJS (un solo proceso, módulos internos) vs.
   microservicios reales (proceso por servicio + broker de eventos). Recomendación CTO: empezar
   **monolito modular** con límites de módulo estrictos (cada `services/*` es un módulo Nest con su
   propio esquema Prisma lógico) y separar a microservicio solo lo que necesite escalar o aislarse
   por compliance (`ledger`, `kyc`). Migrar a microservicios reales sin haber operado el monolito es
   costo prematuro sin datos de carga reales.
2. **Broker de eventos**: BullMQ/Redis alcanza para colas de trabajo, pero un event bus real
   (outbox pattern sobre Postgres + worker) es necesario para no perder eventos financieros si Redis
   cae. Diseñar `packages/events` sobre outbox desde el día uno.
3. **AstroPay**: no hay documentación pública de API confirmada en este proyecto todavía. El adapter
   se construye con la interfaz `PaymentProvider` pero **no se activa** (`ENABLE_ASTROPAY=false`)
   hasta tener credenciales reales y su documentación oficial — no se inventan endpoints.
