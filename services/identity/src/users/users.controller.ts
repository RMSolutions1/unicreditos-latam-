import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '@unicreditos/auth'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.prisma.client.user.findUnique({ where: { id: request.user!.id } })
    if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado.')
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
    }
  }
}
