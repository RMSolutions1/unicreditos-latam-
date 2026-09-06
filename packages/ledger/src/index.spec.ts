import { postLedgerTransaction, getAccountBalance, LedgerImbalanceError, GLOBAL_OWNER_ID } from './index'

/**
 * Fake en memoria del Prisma TransactionClient — solo implementa lo que packages/ledger usa.
 * No golpea una base real: esto es una prueba unitaria del guard de balance y de la
 * construcción de asientos, no una prueba de integración con Postgres.
 */
function createFakeTx() {
  const accounts = new Map<string, { id: string; ownerType: string; ownerId: string; currency: string }>()
  const transactions = new Map<string, { id: string; type: string; reference: string }>()
  const entries: Array<{ id: string; transactionId: string; accountId: string; direction: string; amount: number; currency: string }> = []
  let seq = 0
  const nextId = (prefix: string) => `${prefix}-${++seq}`

  const key = (ownerType: string, ownerId: string, currency: string) => `${ownerType}:${ownerId}:${currency}`

  const tx = {
    ledgerAccount: {
      findUnique: async ({ where, include }: any) => {
        const k = key(where.ownerType_ownerId_currency.ownerType, where.ownerType_ownerId_currency.ownerId, where.ownerType_ownerId_currency.currency)
        const account = accounts.get(k)
        if (!account) return null
        if (include?.entries) return { ...account, entries: entries.filter((e) => e.accountId === account.id) }
        return account
      },
      create: async ({ data }: any) => {
        const account = { id: nextId('acc'), ownerType: data.ownerType, ownerId: data.ownerId, currency: data.currency }
        accounts.set(key(data.ownerType, data.ownerId, data.currency), account)
        return account
      },
    },
    ledgerTransaction: {
      create: async ({ data }: any) => {
        const transaction = { id: nextId('txn'), type: data.type, reference: data.reference }
        transactions.set(transaction.id, transaction)
        return transaction
      },
    },
    ledgerEntry: {
      create: async ({ data }: any) => {
        const entry = { id: nextId('entry'), transactionId: data.transactionId, accountId: data.accountId, direction: data.direction, amount: data.amount, currency: data.currency }
        entries.push(entry)
        return entry
      },
    },
  }

  return { tx, accounts, transactions, entries }
}

describe('postLedgerTransaction', () => {
  it('rechaza una transacción desbalanceada y no escribe ningún registro', async () => {
    const { tx, transactions, entries } = createFakeTx()

    await expect(
      postLedgerTransaction(tx as any, {
        type: 'ADJUSTMENT',
        reference: 'test-imbalance',
        entries: [
          { ownerType: 'CUSTOMER', ownerId: 'user-1', direction: 'DEBIT', amount: 100 },
          { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: 50 },
        ],
      }),
    ).rejects.toThrow(LedgerImbalanceError)

    // El guard corre ANTES de crear la LedgerTransaction — nada debe quedar escrito.
    expect(transactions.size).toBe(0)
    expect(entries).toHaveLength(0)
  })

  it('acepta una transacción balanceada y crea los asientos correspondientes', async () => {
    const { tx, entries } = createFakeTx()

    await postLedgerTransaction(tx as any, {
      type: 'DISBURSEMENT',
      reference: 'credit-1',
      entries: [
        { ownerType: 'CUSTOMER', ownerId: 'user-1', direction: 'DEBIT', amount: 300000 },
        { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: 300000 },
      ],
    })

    expect(entries).toHaveLength(2)
    expect(entries.filter((e) => e.direction === 'DEBIT')).toHaveLength(1)
    expect(entries.filter((e) => e.direction === 'CREDIT')).toHaveLength(1)
  })

  it('reutiliza la misma cuenta TREASURY entre llamadas en vez de duplicarla', async () => {
    const { tx, accounts } = createFakeTx()

    await postLedgerTransaction(tx as any, {
      type: 'DISBURSEMENT',
      reference: 'credit-1',
      entries: [
        { ownerType: 'CUSTOMER', ownerId: 'user-1', direction: 'DEBIT', amount: 100 },
        { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: 100 },
      ],
    })
    await postLedgerTransaction(tx as any, {
      type: 'DISBURSEMENT',
      reference: 'credit-2',
      entries: [
        { ownerType: 'CUSTOMER', ownerId: 'user-2', direction: 'DEBIT', amount: 200 },
        { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: 200 },
      ],
    })

    const treasuryAccounts = [...accounts.values()].filter((a) => a.ownerType === 'TREASURY')
    expect(treasuryAccounts).toHaveLength(1)
  })

  it('tolera diferencias de redondeo menores a un centavo como balanceado', async () => {
    const { tx, entries } = createFakeTx()
    await postLedgerTransaction(tx as any, {
      type: 'REPAYMENT',
      reference: 'payment-1',
      entries: [
        { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'DEBIT', amount: 38783.35 },
        { ownerType: 'CUSTOMER', ownerId: 'user-1', direction: 'CREDIT', amount: 16283.35 },
        { ownerType: 'REVENUE', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: 22500 },
      ],
    })
    expect(entries).toHaveLength(3)
  })
})

describe('getAccountBalance', () => {
  it('calcula el neto como débitos menos créditos, recalculado 100% desde los asientos', async () => {
    const { tx } = createFakeTx()
    await postLedgerTransaction(tx as any, {
      type: 'DISBURSEMENT',
      reference: 'credit-1',
      entries: [
        { ownerType: 'CUSTOMER', ownerId: 'user-1', direction: 'DEBIT', amount: 100000 },
        { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: 100000 },
      ],
    })
    await postLedgerTransaction(tx as any, {
      type: 'REPAYMENT',
      reference: 'payment-1',
      entries: [
        { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'DEBIT', amount: 20000 },
        { ownerType: 'CUSTOMER', ownerId: 'user-1', direction: 'CREDIT', amount: 20000 },
      ],
    })

    const balance = await getAccountBalance(tx as any, 'CUSTOMER', 'user-1')
    expect(balance.net).toBe(80000) // 100000 desembolsado - 20000 pagado = 80000 pendiente
  })

  it('una cuenta que nunca se usó devuelve saldo cero, no un error', async () => {
    const { tx } = createFakeTx()
    const balance = await getAccountBalance(tx as any, 'CUSTOMER', 'nunca-existio')
    expect(balance.net).toBe(0)
    expect(balance.accountId).toBeNull()
  })
})
