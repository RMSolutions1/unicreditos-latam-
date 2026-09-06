import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '@unicreditos/auth'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'

@UseGuards(JwtAuthGuard)
@Controller('credits')
export class CreditsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listMine(@Req() request: AuthenticatedRequest) {
    return this.prisma.client.credit.findMany({ where: { userId: request.user!.id }, orderBy: { createdAt: 'desc' } })
  }

  @Get(':id/installments')
  async installments(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const credit = await this.prisma.client.credit.findUnique({ where: { id } })
    if (!credit || (credit.userId !== request.user!.id && request.user!.role === 'CUSTOMER')) {
      throw new DomainError('NOT_FOUND', 'Crédito no encontrado.')
    }
    return this.prisma.client.installment.findMany({ where: { creditId: id }, orderBy: { number: 'asc' } })
  }
}
