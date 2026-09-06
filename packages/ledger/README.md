# @unicreditos/ledger

Librería compartida (no un servicio de red) para escribir y leer el ledger de doble entrada.
Se importa desde `services/credit` y `services/payment` para que el asiento contable quede
**dentro de la misma transacción de Prisma** que actualiza `Credit`/`Installment` — así el
desembolso o el pago de una cuota son atómicos de punta a punta (master prompt §74).

## Por qué es una librería y no un microservicio

Escribir el ledger vía una llamada de red a otro servicio rompería la atomicidad: si el pago se
marca aprobado pero la llamada al "servicio de ledger" falla, quedarían datos inconsistentes. En
la arquitectura de monolito modular de las Fases 1-6 (`docs/ARCHITECTURE.md` §9), varios servicios
comparten la misma base — esta librería aprovecha eso para que el asiento contable entre en el
mismo `prisma.$transaction(...)` que el resto del movimiento.

## Reglas duras

- **Nunca `balance = balance + amount`** (master prompt §39): todo movimiento de dinero real es
  una `LedgerTransaction` con sus `LedgerEntry`, nunca una resta/suma directa sobre un campo.
- **Balanceada siempre**: `postLedgerTransaction` sólo escribe entradas si `suma(débitos) ==
  suma(créditos)`, si no lanza `LedgerImbalanceError` y no escribe nada (probado: una transacción
  desbalanceada deja 0 filas, incluso el intento de `LedgerTransaction` se revierte).
- **Sin `NULL` como owner**: Postgres no garantiza unicidad entre `NULL`s en un `UNIQUE`, así que
  las cuentas globales (`TREASURY`, `REVENUE`) usan el sentinel `GLOBAL_OWNER_ID` en vez de `null`
  — evita duplicar la cuenta de tesorería por una carrera.
- **Append-only**: `LedgerEntry` no tiene `updatedAt`/`deletedAt` ni se expone ningún endpoint de
  borrado. Una corrección es un `ADJUSTMENT` nuevo.

## `services/ledger` (lectura/consulta, puerto 3104)

- `GET /ledger/accounts/:ownerType/:ownerId/balance` — saldo recalculado 100% desde los asientos.
- `GET /ledger/accounts/:ownerType/:ownerId/entries` — historial de movimientos.
- `GET /treasury/dashboard` (`TREASURY_MANAGER`/`CFO`/`SUPER_ADMIN`/`AUDITOR`) — fondos, total
  desembolsado, total cobrado.
- `GET /treasury/reconciliation` — compara el saldo cacheado en `Credit.balance` contra el
  implícito en el ledger por cliente; marca `match: false` cuando difieren.

## Estado real (probado contra Supabase)

Los créditos desembolsados **antes** de esta fase no tienen asientos históricos — no se
retroactivó el ledger sobre datos viejos. `GET /treasury/reconciliation` lo muestra tal cual: el
crédito de la Fase 3 aparece con `match: false` (saldo cacheado 300.000, ledger 0) porque nunca
generó un asiento; un crédito desembolsado en esta fase aparece con `match: true`. Esto es
información real para decidir si conviene una migración de backfill, no un bug oculto.
