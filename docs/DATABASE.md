# DATABASE.md — UNICRÉDITOS

PostgreSQL + Prisma. Reglas fijas (no negociables, master prompt §57-59, §101-102):

- Dinero: **siempre** `NUMERIC(14,2)` + columna `currency` (`ARS`, `USD`, ...). Nunca `float`/`double`.
- Tiempos: siempre UTC en columna `TIMESTAMPTZ`; la conversión a timezone de presentación es del frontend.
- Nunca borrado físico de `loans`, `payments`, `ledger_entries`, `contracts`, `audit_logs`. Todo con
  `deleted_at TIMESTAMPTZ NULL` (soft delete) cuando el dominio lo permite; el ledger y los audit logs
  ni siquiera exponen soft delete — son append-only.
- Todas las tablas de negocio: `created_at`, `updated_at`, `created_by`, `updated_by` (FK a `users.id`
  o `'system'` para procesos automáticos).

## 1. Identidad y acceso

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  phone         String?
  passwordHash  String
  mfaEnabled    Boolean  @default(false)
  mfaSecret     String?  // cifrado a nivel de aplicación, nunca en claro
  role          Role
  status        UserStatus @default(ACTIVE)
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  customer      Customer?
  investor      Investor?
  merchantUser  MerchantUser?
}

enum Role {
  SUPER_ADMIN CEO CFO CTO RISK_MANAGER COMPLIANCE_MANAGER TREASURY_MANAGER
  COLLECTION_MANAGER OPERATIONS_MANAGER SUPPORT AUDITOR ANALYST MERCHANT_ADMIN CUSTOMER INVESTOR
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
}
```

## 2. Cliente, identidad y KYC

```prisma
model Customer {
  id            String   @id @default(cuid())
  userId        String   @unique
  firstName     String
  lastName      String
  dni           String?
  cuil          String?
  incomeDeclared Decimal @db.Decimal(14,2)
  province      String?
  country       String   @default("AR")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model KycVerification {
  id               String   @id @default(cuid())
  customerId       String
  provider         String   // "didit"
  providerSessionId String
  status           KycStatus
  rawResultEncrypted Bytes?  // resultado crudo del proveedor, cifrado en reposo
  normalizedResult Json     // solo campos mínimos necesarios (data minimization)
  requestedAt      DateTime @default(now())
  resolvedAt       DateTime?
}
enum KycStatus { PENDING IN_PROGRESS APPROVED REJECTED EXPIRED }

model BankAccountVerification {
  id           String   @id @default(cuid())
  customerId   String
  provider     String   // "argenapi"
  cbuOrAlias   String
  holderName   String?
  matchStatus  BankMatchStatus
  requestId    String
  createdAt    DateTime @default(now())
}
enum BankMatchStatus { PENDING VERIFIED MISMATCH REJECTED ERROR }

model CreditBureauQuery {
  id             String   @id @default(cuid())
  customerId     String
  provider       String   // "bcra"
  requestId      String
  requestedAt    DateTime @default(now())
  rawResponseEncrypted Bytes?
  normalizedResult Json
}
```

## 3. Crédito

```prisma
model CreditProduct {
  id            String   @id            // "personal" | "consumer" | "merchant" | "sme"
  name          String
  country       String
  currency      String
  monthlyRateBp Int                     // basis points, evita floats
  minAmount     Decimal @db.Decimal(14,2)
  maxAmount     Decimal @db.Decimal(14,2)
  minTermMonths Int
  maxTermMonths Int
  active        Boolean @default(true)
  rules         Json    // ProductRules versionadas
}

model CreditApplication {
  id             String   @id @default(cuid())
  publicId       String   @unique
  customerId     String
  productId      String
  amount         Decimal  @db.Decimal(14,2)
  months         Int
  status         ApplicationStatus
  riskScoreId    String?
  decisionId     String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
enum ApplicationStatus {
  DRAFT SUBMITTED VERIFICATION PRE_APPROVED MANUAL_REVIEW COMPLIANCE_REVIEW
  TREASURY_REVIEW APPROVED READY_FOR_DISBURSEMENT DISBURSED REJECTED CANCELLED
}

model CreditDecision {
  id            String   @id @default(cuid())
  applicationId String
  decision      String   // APPROVE | PRE_APPROVE | MANUAL_REVIEW | REJECT
  modelVersion  String
  rulesVersion  String
  inputs        Json
  result        Json
  decidedBy     String   // userId o "system"
  decidedAt     DateTime @default(now())
}

model Credit {
  id               String   @id @default(cuid())
  publicId         String   @unique
  customerId       String
  applicationId    String   @unique
  productId        String
  amount           Decimal  @db.Decimal(14,2)
  currency         String
  months           Int
  monthlyPayment   Decimal  @db.Decimal(14,2)
  status           CreditStatus
  disbursedTo      String?  // CBU/CVU, nunca datos de tarjeta
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
enum CreditStatus {
  ACTIVE OVERDUE IN_COLLECTION RESTRUCTURED PAID DEFAULTED CLOSED
}

model Installment {
  id           String   @id @default(cuid())
  creditId     String
  number       Int
  dueDate      DateTime
  principal    Decimal  @db.Decimal(14,2)
  interest     Decimal  @db.Decimal(14,2)
  taxes        Decimal  @db.Decimal(14,2) @default(0)
  fees         Decimal  @db.Decimal(14,2) @default(0)
  lateFees     Decimal  @db.Decimal(14,2) @default(0)
  totalDue     Decimal  @db.Decimal(14,2)
  amountPaid   Decimal  @db.Decimal(14,2) @default(0)
  status       InstallmentStatus
  @@unique([creditId, number])
}
enum InstallmentStatus { PENDING PARTIALLY_PAID PAID OVERDUE WAIVED CANCELLED }

model Contract {
  id              String   @id @default(cuid())
  creditId        String
  version         Int
  documentHash    String
  storageKey      String   // referencia a Object Storage, nunca el binario en PG
  acceptedAt      DateTime?
  acceptedByUserId String?
  ip              String?
  device          String?
  userAgent       String?
  signatureEvidence Json?
  createdAt       DateTime @default(now())
  // Nunca se actualiza un contrato existente: una nueva versión = una fila nueva.
}
```

## 4. Pagos

```prisma
model PaymentIntent {
  id               String   @id @default(cuid())
  customerId       String
  loanId           String?
  installmentId    String?
  amount           Decimal  @db.Decimal(14,2)
  currency         String
  country          String
  provider         String   // "mercadopago" | "astropay"
  paymentMethod    String
  status           PaymentIntentStatus
  externalReference String  @unique
  idempotencyKey   String   @unique
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
enum PaymentIntentStatus {
  CREATED PENDING PROCESSING APPROVED REJECTED CANCELLED EXPIRED REFUNDED PARTIALLY_REFUNDED
}

model WebhookEvent {
  id              String   @id @default(cuid())
  provider        String
  providerEventId String   // para replay protection
  signatureValid  Boolean
  payload         Json
  processedAt     DateTime?
  @@unique([provider, providerEventId])   // idempotencia dura a nivel DB
}

model ReconciliationCase {
  id            String   @id @default(cuid())
  paymentIntentId String?
  status        ReconciliationStatus
  providerAmount Decimal? @db.Decimal(14,2)
  ledgerAmount   Decimal? @db.Decimal(14,2)
  detail         Json
  openedAt      DateTime @default(now())
  resolvedAt    DateTime?
}
enum ReconciliationStatus { MATCH MISSING DUPLICATE AMOUNT_MISMATCH UNKNOWN PENDING }
```

## 5. Ledger (doble entrada, append-only)

```prisma
model LedgerAccount {
  id       String @id @default(cuid())
  ownerType String // "CUSTOMER" | "INVESTOR" | "TREASURY" | "REVENUE" | "FEES"
  ownerId  String?
  currency String
}

model Transaction {
  id        String   @id @default(cuid())
  type      LedgerEntryType
  reference String   // paymentIntentId / disbursementId / settlementId
  createdAt DateTime @default(now())
  entries   LedgerEntry[]
}

model LedgerEntry {
  id            String   @id @default(cuid())
  transactionId String
  accountId     String
  direction     String   // "DEBIT" | "CREDIT"
  amount        Decimal  @db.Decimal(14,2)
  currency      String
  createdAt     DateTime @default(now())
  // Append-only: no updatedAt, no deletedAt. Una corrección es una entrada de reverso (ADJUSTMENT).
}
enum LedgerEntryType {
  DEPOSIT WITHDRAWAL INVESTMENT RETURN INTEREST FEE REFUND ADJUSTMENT SETTLEMENT DISBURSEMENT REPAYMENT
}
```

`Credit.balance` e `Investment.balance` **no existen como columnas mutables**: se calculan agregando
`LedgerEntry` por cuenta. Si se cachean por performance, el cache lleva `computedAt` y se puede
recalcular 100% desde el ledger.

## 6. Compliance, fraude, cobranzas, auditoría

```prisma
model ComplianceCase {
  id        String @id @default(cuid())
  subjectType String // "CUSTOMER" | "INVESTOR" | "MERCHANT"
  subjectId String
  kind      String   // "KYC" | "AML" | "SANCTIONS_LIST" | ...
  status    ComplianceStatus
  assignedTo String?
  openedAt  DateTime @default(now())
  closedAt  DateTime?
}
enum ComplianceStatus { OPEN UNDER_REVIEW APPROVED REJECTED ESCALATED CLOSED }

model FraudCase {
  id        String @id @default(cuid())
  subjectId String
  score     Int
  riskLevel String // LOW | MEDIUM | HIGH | CRITICAL
  signals   Json
  status    ComplianceStatus
  createdAt DateTime @default(now())
}

model CollectionCase {
  id        String @id @default(cuid())
  creditId  String
  status    CollectionStatus
  openedAt  DateTime @default(now())
  closedAt  DateTime?
}
enum CollectionStatus {
  CURRENT GRACE_PERIOD OVERDUE EARLY_COLLECTION INTENSIVE_COLLECTION
  RESTRUCTURED LEGAL_REVIEW RECOVERED DEFAULTED
}

model AuditLog {
  id          String   @id @default(cuid())
  actorId     String
  actorRole   String
  action      String
  resource    String
  resourceId  String
  before      Json?
  after       Json?
  ip          String?
  device      String?
  requestId   String
  createdAt   DateTime @default(now())
  // Sin deletedAt, sin endpoint DELETE. Inmutable por diseño.
}
```

## 7. Índices y constraints mínimos día 1

- `users.email` único; `credit_applications.public_id`, `credits.public_id` únicos.
- `installments (credit_id, number)` único.
- `payment_intents.idempotency_key` y `.external_reference` únicos.
- `webhook_events (provider, provider_event_id)` único → esto es lo que impide procesar dos veces
  el mismo evento de Mercado Pago/AstroPay aunque el proveedor reintente el webhook.
- FKs con `ON DELETE RESTRICT` en todo lo financiero (nunca `CASCADE` que borre historial).
- Índices por `customer_id`, `credit_id`, `due_date`, `status` en las tablas de alto volumen
  (`installments`, `payment_intents`, `audit_logs`) para las vistas de admin con paginación.
