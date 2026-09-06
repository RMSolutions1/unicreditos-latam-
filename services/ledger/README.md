# @unicreditos/ledger-service

API de solo lectura/consulta sobre el ledger (`@unicreditos/ledger`) y el dashboard de tesorería.
Los asientos se escriben desde `services/credit` (desembolso) y `services/payment` (pago de
cuota), no desde acá — ver `packages/ledger/README.md`.

## Correr local

```bash
cp .env.example .env   # JWT_ACCESS_SECRET (el mismo que los demás servicios), DATABASE_URL
npm run build
npm start
```

## Endpoints

- `GET /ledger/accounts/:ownerType/:ownerId/balance` (auth: dueño o staff)
- `GET /ledger/accounts/:ownerType/:ownerId/entries` (auth: dueño o staff)
- `GET /treasury/dashboard` (`TREASURY_MANAGER`/`CFO`/`SUPER_ADMIN`/`AUDITOR`)
- `GET /treasury/reconciliation` (mismos roles) — `Credit.balance` cacheado vs. saldo del ledger
