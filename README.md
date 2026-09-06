# UNICRÉDITOS

Plataforma real de crédito online para el mercado argentino (LATAM-ready): monorepo de servicios
de dominio independientes con ledger contable de doble entrada como fuente de verdad, motores
separados de riesgo, KYC, pagos y cobranzas, y decisión de crédito con humano en el loop siempre.
Ningún desembolso o pago se marca exitoso sin confirmación real del proveedor correspondiente
(Mercado Pago, Didit, ArgenAPI).

Documentación completa en [`docs/`](./docs/README.md) — empezar por
[ARCHITECTURE.md](./docs/README.md) y [ROADMAP.md](./docs/ROADMAP.md) para el estado fase por fase.

## Estructura

- `packages/` — librerías compartidas: `database` (Prisma), `auth` (JWT/RBAC), `ledger`
  (doble entrada), `notifications`.
- `services/` — microservicios NestJS: `identity` (3100), `kyc` (3101), `credit` (3102),
  `payment` (3103), `ledger` (3104, tesorería), `collection` (3105).
- `apps/admin` — backoffice (Vite + TypeScript, sin framework), puerto 5174.

## Correr local

Cada servicio y `apps/admin` tiene su propio `.env.example` — copiarlo a `.env` y completar
credenciales reales antes de levantarlo.

```bash
npm install
npm run generate --workspace packages/database

npm run start:dev --workspace services/identity
npm run start:dev --workspace services/kyc
npm run start:dev --workspace services/credit
npm run start:dev --workspace services/payment
npm run start:dev --workspace services/ledger
npm run start:dev --workspace services/collection

npm --prefix apps/admin run dev
```

## Tests y CI

```bash
npm test --workspace services/credit
npm test --workspace services/payment
npm test --workspace packages/ledger
```

Cada push/PR a `main` corre build + typecheck + tests en GitHub Actions
([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).
