import type { Prisma, LedgerOwnerType, LedgerTransactionType } from '@unicreditos/database'

type Tx = Prisma.TransactionClient

export const GLOBAL_OWNER_ID = 'GLOBAL'

export type LedgerEntryInput = {
  ownerType: LedgerOwnerType
  /** userId cuando ownerType = CUSTOMER; usar GLOBAL_OWNER_ID para TREASURY/REVENUE. */
  ownerId: string
  direction: 'DEBIT' | 'CREDIT'
  amount: number
  currency?: string
}

export class LedgerImbalanceError extends Error {
  constructor(debits: number, credits: number) {
    super(`Transacción de ledger desbalanceada: débitos=${debits} créditos=${credits}. No se registró nada.`)
  }
}

/**
 * Cuentas únicas por (ownerType, ownerId, currency) — ver docs/DATABASE.md. Se crean bajo demanda
 * dentro de la misma transacción que las usa, así que nunca hay una carrera entre "leer si existe"
 * y "crearla". Nunca se usa NULL como ownerId: Postgres no garantiza unicidad entre NULLs en un
 * UNIQUE constraint, así que TREASURY/REVENUE usan el sentinel GLOBAL_OWNER_ID.
 */
async function getOrCreateAccount(tx: Tx, ownerType: LedgerOwnerType, ownerId: string, currency: string) {
  const existing = await tx.ledgerAccount.findUnique({
    where: { ownerType_ownerId_currency: { ownerType, ownerId, currency } },
  })
  if (existing) return existing
  return tx.ledgerAccount.create({ data: { ownerType, ownerId, currency } })
}

/**
 * Registra una transacción de ledger balanceada (master prompt §39: nunca "balance = balance +
 * amount", siempre un asiento). Debe llamarse DENTRO de la misma transacción de Prisma que
 * actualiza Credit/Installment, para que todo el movimiento sea atómico (master prompt §74).
 *
 * Lanza LedgerImbalanceError si la suma de débitos no es igual a la de créditos — eso nunca debe
 * pasar en producción; si pasa, es un bug en el caller, no un caso de negocio válido.
 */
export async function postLedgerTransaction(
  tx: Tx,
  input: { type: LedgerTransactionType; reference: string; entries: LedgerEntryInput[] },
) {
  const debits = input.entries.filter((e) => e.direction === 'DEBIT').reduce((sum, e) => sum + e.amount, 0)
  const credits = input.entries.filter((e) => e.direction === 'CREDIT').reduce((sum, e) => sum + e.amount, 0)
  if (Math.round(debits * 100) !== Math.round(credits * 100)) {
    throw new LedgerImbalanceError(debits, credits)
  }

  const transaction = await tx.ledgerTransaction.create({ data: { type: input.type, reference: input.reference } })

  for (const entry of input.entries) {
    const account = await getOrCreateAccount(tx, entry.ownerType, entry.ownerId, entry.currency ?? 'ARS')
    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: account.id,
        direction: entry.direction,
        amount: entry.amount,
        currency: entry.currency ?? 'ARS',
      },
    })
  }

  return transaction
}

/** Recalcula el saldo de una cuenta 100% desde sus asientos — nunca desde un campo cacheado. */
export async function getAccountBalance(tx: Tx, ownerType: LedgerOwnerType, ownerId: string, currency = 'ARS') {
  const account = await tx.ledgerAccount.findUnique({
    where: { ownerType_ownerId_currency: { ownerType, ownerId, currency } },
    include: { entries: true },
  })
  if (!account) return { accountId: null as string | null, debitTotal: 0, creditTotal: 0, net: 0 }

  const debitTotal = account.entries.filter((e) => e.direction === 'DEBIT').reduce((sum, e) => sum + Number(e.amount), 0)
  const creditTotal = account.entries.filter((e) => e.direction === 'CREDIT').reduce((sum, e) => sum + Number(e.amount), 0)
  return { accountId: account.id, debitTotal, creditTotal, net: Math.round((debitTotal - creditTotal) * 100) / 100 }
}
