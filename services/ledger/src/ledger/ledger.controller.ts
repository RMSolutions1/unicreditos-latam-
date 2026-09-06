import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '@unicreditos/auth'
import { getAccountBalance } from '@unicreditos/ledger'
import type { LedgerOwnerType } from '@unicreditos/database'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'

/** Roles con motivo de negocio para ver el ledger de un cliente que no es el propio. */
const LEDGER_STAFF_ROLES: string[] = ['TREASURY_MANAGER', 'CFO', 'AUDITOR', 'SUPER_ADMIN']

@UseGuards(JwtAuthGuard)
@Controller('ledger/accounts')
export class LedgerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':ownerType/:ownerId/balance')
  async balance(
    @Param('ownerType') ownerType: LedgerOwnerType,
    @Param('ownerId') ownerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const isSelf = ownerType === 'CUSTOMER' && ownerId === request.user!.id
    const isStaff = LEDGER_STAFF_ROLES.includes(request.user!.role)
    if (!isSelf && !isStaff) throw new DomainError('INSUFFICIENT_PERMISSIONS', 'No tenés permisos para ver esta cuenta.')

    return getAccountBalance(this.prisma.client, ownerType, ownerId)
  }

  @Get(':ownerType/:ownerId/entries')
  async entries(
    @Param('ownerType') ownerType: LedgerOwnerType,
    @Param('ownerId') ownerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const isSelf = ownerType === 'CUSTOMER' && ownerId === request.user!.id
    const isStaff = LEDGER_STAFF_ROLES.includes(request.user!.role)
    if (!isSelf && !isStaff) throw new DomainError('INSUFFICIENT_PERMISSIONS', 'No tenés permisos para ver esta cuenta.')

    const account = await this.prisma.client.ledgerAccount.findUnique({
      where: { ownerType_ownerId_currency: { ownerType, ownerId, currency: 'ARS' } },
      include: { entries: { include: { transaction: true }, orderBy: { createdAt: 'desc' } } },
    })
    if (!account) return []
    return account.entries.map((e) => ({
      id: e.id,
      direction: e.direction,
      amount: e.amount,
      type: e.transaction.type,
      reference: e.transaction.reference,
      createdAt: e.createdAt,
    }))
  }
}
