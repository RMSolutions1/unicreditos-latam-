import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, Roles, RolesGuard } from '@unicreditos/auth'
import { getAccountBalance, GLOBAL_OWNER_ID } from '@unicreditos/ledger'
import { PrismaService } from '../prisma/prisma.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('TREASURY_MANAGER', 'CFO', 'SUPER_ADMIN', 'AUDITOR')
  @Get('dashboard')
  async dashboard() {
    const treasury = await getAccountBalance(this.prisma.client, 'TREASURY', GLOBAL_OWNER_ID)

    const [disbursements, repayments] = await Promise.all([
      this.prisma.client.ledgerTransaction.aggregate({ where: { type: 'DISBURSEMENT' }, _count: true }),
      this.prisma.client.ledgerTransaction.aggregate({ where: { type: 'REPAYMENT' }, _count: true }),
    ])

    const disbursedEntries = await this.prisma.client.ledgerEntry.aggregate({
      where: { transaction: { type: 'DISBURSEMENT' }, direction: 'CREDIT' },
      _sum: { amount: true },
    })
    const collectedEntries = await this.prisma.client.ledgerEntry.aggregate({
      where: { transaction: { type: 'REPAYMENT' }, direction: 'DEBIT' },
      _sum: { amount: true },
    })

    return {
      // "fondos disponibles": neto de TREASURY == cobrado - desembolsado (crece con cada cuota cobrada).
      treasuryNetBalance: treasury.net,
      totalDisbursed: Number(disbursedEntries._sum.amount ?? 0),
      totalCollected: Number(collectedEntries._sum.amount ?? 0),
      disbursementCount: disbursements._count,
      repaymentCount: repayments._count,
    }
  }

  /**
   * Compara el balance derivado 100% del ledger contra el campo Credit.balance cacheado —
   * si difieren, hay un caso de conciliación (docs/DATABASE.md §5: Credit.balance es un valor
   * cacheado recalculable, el ledger es la fuente de verdad).
   */
  @Roles('TREASURY_MANAGER', 'CFO', 'SUPER_ADMIN', 'AUDITOR')
  @Get('reconciliation')
  async reconciliation() {
    const credits = await this.prisma.client.credit.findMany({ select: { id: true, publicId: true, userId: true, amount: true, balance: true } })
    const results = [] as Array<{ creditId: string; publicId: string; cachedBalance: number; ledgerImpliedBalance: number; match: boolean }>

    for (const credit of credits) {
      const customerLedger = await getAccountBalance(this.prisma.client, 'CUSTOMER', credit.userId)
      // El ledger de un cliente mezcla todos sus créditos si tuviera más de uno; para un solo
      // crédito activo (caso de hoy) el neto del cliente == saldo pendiente de ESE crédito.
      const ledgerImpliedBalance = customerLedger.net
      const cachedBalance = Number(credit.balance)
      results.push({
        creditId: credit.id,
        publicId: credit.publicId,
        cachedBalance,
        ledgerImpliedBalance,
        match: Math.abs(cachedBalance - ledgerImpliedBalance) < 0.01,
      })
    }

    return { credits: results, allMatch: results.every((r) => r.match) }
  }
}
