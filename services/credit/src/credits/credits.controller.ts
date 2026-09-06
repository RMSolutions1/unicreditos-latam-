import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, RolesGuard, Roles, type AuthenticatedRequest } from '@unicreditos/auth'
import type { CreditStatus } from '@unicreditos/database'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'

/** Roles con motivo de negocio para ver créditos de un cliente que no es el propio. */
const CREDIT_STAFF_ROLES: string[] = ['RISK_MANAGER', 'COMPLIANCE_MANAGER', 'TREASURY_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT', 'AUDITOR', 'SUPER_ADMIN', 'CEO', 'CFO']
const CREDIT_STATUS_VALUES: CreditStatus[] = ['ACTIVE', 'PAID_OFF']

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('credits')
export class CreditsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listMine(@Req() request: AuthenticatedRequest) {
    return this.prisma.client.credit.findMany({ where: { userId: request.user!.id }, orderBy: { createdAt: 'desc' } })
  }

  // Ruta estática ANTES de ':id' -- si no, Nest interpreta "all" como un id.
  @Roles('RISK_MANAGER', 'COMPLIANCE_MANAGER', 'TREASURY_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT', 'AUDITOR', 'SUPER_ADMIN', 'CEO', 'CFO')
  @Get('all')
  async listAll(@Query('status') status?: string) {
    // Hallazgo de auditoría: un status invalido llegaba crudo a Prisma y disparaba un 500
    // generico en vez de un 400 -- se valida explicitamente contra el enum real.
    if (status && !CREDIT_STATUS_VALUES.includes(status as CreditStatus)) {
      throw new DomainError('VALIDATION_ERROR', `status debe ser uno de: ${CREDIT_STATUS_VALUES.join(', ')}.`)
    }
    return this.prisma.client.credit.findMany({
      where: status ? { status: status as CreditStatus } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { application: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    })
  }

  @Get(':id/installments')
  async installments(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const credit = await this.getOwnedCredit(id, request)
    return this.prisma.client.installment.findMany({ where: { creditId: credit.id }, orderBy: { number: 'asc' } })
  }

  /**
   * EarlySettlementService (master prompt §24): el pago anticipado cancela CAPITAL pendiente,
   * nunca intereses futuros que todavía no se devengaron. Gracias a que Credit.balance
   * representa capital puro (fix de Fase 6), la cotización es directa y no requiere recorrer
   * cada cuota. Comisiones/descuentos quedan en ProductRules — hoy son 0, no un número inventado.
   */
  @Get(':id/early-settlement/quote')
  async earlySettlementQuote(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const credit = await this.getOwnedCredit(id, request)
    const pendingInstallments = await this.prisma.client.installment.count({ where: { creditId: credit.id, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } } })
    return {
      creditId: credit.id,
      outstandingPrincipal: Number(credit.balance),
      fees: 0,
      totalPayoff: Number(credit.balance),
      remainingInstallments: pendingInstallments,
      note: 'La liquidación se paga hoy pagando individualmente las cuotas pendientes vía /payment-intents; un PaymentIntent de liquidación total en un solo pago queda pendiente (requiere que installmentId sea opcional en el Payment Engine).',
    }
  }

  private async getOwnedCredit(id: string, request: AuthenticatedRequest) {
    const credit = await this.prisma.client.credit.findUnique({ where: { id } })
    const isOwner = credit?.userId === request.user!.id
    const isStaff = CREDIT_STAFF_ROLES.includes(request.user!.role)
    if (!credit || (!isOwner && !isStaff)) {
      throw new DomainError('NOT_FOUND', 'Crédito no encontrado.')
    }
    return credit
  }
}
