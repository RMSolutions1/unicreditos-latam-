import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '@unicreditos/auth'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'
import { UpdateProfileDto } from './dto/update-profile.dto'

function toPublicShape(user: {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  dni: string | null
  cuil: string | null
  income: unknown
  role: string
  status: string
  mfaEnabled: boolean
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dni: user.dni,
    cuil: user.cuil,
    income: user.income == null ? null : Number(user.income),
    role: user.role,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
  }
}

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.prisma.client.user.findUnique({ where: { id: request.user!.id } })
    if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado.')
    return toPublicShape(user)
  }

  /** Paso "FINANCIAL DATA" del flujo de solicitud (master prompt §35): ingreso, DNI, CUIL. */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Body() dto: UpdateProfileDto, @Req() request: AuthenticatedRequest) {
    const user = await this.prisma.client.user.update({
      where: { id: request.user!.id },
      data: { phone: dto.phone, dni: dto.dni, cuil: dto.cuil, income: dto.income },
    })
    return toPublicShape(user)
  }
}
