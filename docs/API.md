# API.md — UNICRÉDITOS

REST + OpenAPI, versionado desde el día uno: **`/api/v1`**. Nunca se rompe un contrato existente sin
versionar (`/api/v2`) y deprecar el anterior con aviso.

Convenciones:
- Todo endpoint autenticado valida identidad (JWT) + autorización (RBAC) + input (zod/class-validator).
- Errores nunca exponen stack trace; siempre `{ code, message, requestId }` con `code` de una lista
  fija (ver `docs/SECURITY.md` §Error handling).
- Toda mutación financiera es auditada (`AuditLog`) y usa `Idempotency-Key` cuando aplica.
- Paginación estándar: `?page&pageSize`, máximo `pageSize=100`.

## Auth / Identity
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/mfa/enroll
POST   /api/v1/auth/mfa/verify
POST   /api/v1/auth/forgot
POST   /api/v1/auth/reset
GET    /api/v1/users/me
```

## Customers
```
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
GET    /api/v1/customers/:id/documents
```

## Investors (detrás de ENABLE_INVESTOR_MODULE)
```
GET    /api/v1/investors/:id
GET    /api/v1/investors/:id/portfolio
GET    /api/v1/investors/:id/statements
POST   /api/v1/investments
```

## Merchants
```
GET    /api/v1/merchants/:id
POST   /api/v1/merchants/:id/financing-requests
```

## KYC
```
POST   /api/v1/kyc/sessions              → crea sesión Didit
GET    /api/v1/kyc/sessions/:id
POST   /api/v1/webhooks/didit            → firmado, idempotente
POST   /api/v1/kyc/bank-account/validate → ArgenAPI, requiere auth
```

## Credit
```
GET    /api/v1/credit-products
POST   /api/v1/credit-applications
GET    /api/v1/credit-applications/:id
POST   /api/v1/credit-applications/:id/decision   (rol RISK_MANAGER/COMPLIANCE_MANAGER)
GET    /api/v1/credits
GET    /api/v1/credits/:id
GET    /api/v1/credits/:id/installments
POST   /api/v1/credits/:id/early-settlement/quote
POST   /api/v1/credits/:id/early-settlement
POST   /api/v1/credits/:id/restructure         (rol OPERATIONS_MANAGER)
```

## Payments
```
POST   /api/v1/payment-intents                 (idempotente, Idempotency-Key obligatorio)
GET    /api/v1/payment-intents/:id
POST   /api/v1/payments/:id/refund             (rol TREASURY_MANAGER)
GET    /api/v1/installments/:id/receipt        → PDF del comprobante
POST   /api/v1/webhooks/mercadopago            → firmado, idempotente
POST   /api/v1/webhooks/astropay               → firmado, idempotente (cuando esté habilitado)
```

## Treasury / Ledger / Reconciliation
```
GET    /api/v1/ledger/accounts/:id/balance
GET    /api/v1/ledger/accounts/:id/entries
GET    /api/v1/treasury/dashboard              (rol TREASURY_MANAGER/CFO)
GET    /api/v1/reconciliation/cases
POST   /api/v1/reconciliation/cases/:id/resolve
```

## Collections
```
GET    /api/v1/collections/cases
POST   /api/v1/collections/cases/:id/action    (rol COLLECTION_MANAGER)
```

## Compliance / Fraud
```
GET    /api/v1/compliance/cases
POST   /api/v1/compliance/cases/:id/resolve    (rol COMPLIANCE_MANAGER)
GET    /api/v1/fraud/cases
POST   /api/v1/fraud/cases/:id/resolve         (rol RISK_MANAGER)
```

## Documents / Contracts
```
POST   /api/v1/documents                       → sube a Object Storage, guarda metadata en PG
GET    /api/v1/documents/:id
GET    /api/v1/contracts/:id
POST   /api/v1/contracts/:id/accept
```

## Notifications / Reports / Audit
```
GET    /api/v1/notifications
POST   /api/v1/reports/exports                 → crea ExportJob async
GET    /api/v1/reports/exports/:id
GET    /api/v1/audit                           (rol AUDITOR/SUPER_ADMIN, solo lectura, sin DELETE)
```

## Observabilidad (no versionado, fuera de /api/v1)
```
GET    /health
GET    /ready
GET    /metrics
```

## Reglas de error (ejemplos de `code`)
```
PAYMENT_PROVIDER_UNAVAILABLE
KYC_VERIFICATION_FAILED
BANK_ACCOUNT_MISMATCH
CREDIT_NOT_ELIGIBLE
PAYMENT_PENDING
INSUFFICIENT_PERMISSIONS
IDEMPOTENCY_KEY_CONFLICT
VALIDATION_ERROR
```
