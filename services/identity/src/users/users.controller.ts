import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, RolesGuard, Roles, type AuthenticatedRequest } from '@unicreditos/auth'
import type { Role, UserStatus } from '@unicreditos/database'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { UpdateUserStaffDto } from './dto/update-user-staff.dto'

/** Roles con motivo de negocio para ver la lista completa de cuentas. */
const USER_STAFF_ROLES: Role[] = ['SUPER_ADMIN', 'CEO', 'COMPLIANCE_MANAGER', 'SUPPORT', 'AUDITOR', 'OPERATIONS_MANAGER']
const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new DomainError('VALIDATION_ERROR', 'page y pageSize deben ser enteros positivos.')
  return Math.min(parsed, max)
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  /** Listado de cuentas para el backoffice -- nunca expuesto a un CUSTOMER. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_STAFF_ROLES)
  @Get()
  async list(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = parsePositiveInt(pageSizeRaw, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

    const where = {
      role: (role as Role) || undefined,
      status: (status as UserStatus) || undefined,
      OR: search
        ? [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { dni: { contains: search, mode: 'insensitive' as const } },
          ]
        : undefined,
    }

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.user.count({ where }),
    ])

    return { items: items.map(toPublicShape), page, pageSize, total }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id } })
    if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado.')
    return toPublicShape(user)
  }

  /**
   * Cambiar rol o estado de una cuenta es una acción de máximo privilegio (escalamiento posible) --
   * restringido a SUPER_ADMIN únicamente y siempre auditado con el before/after real.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Patch(':id')
  async updateStaff(@Body() dto: UpdateUserStaffDto, @Param('id') id: string, @Req() request: AuthenticatedRequest) {
    if (!dto.role && !dto.status) throw new DomainError('VALIDATION_ERROR', 'Especificá al menos role o status.')

    const before = await this.prisma.client.user.findUnique({ where: { id } })
    if (!before) throw new DomainError('NOT_FOUND', 'Usuario no encontrado.')

    const user = await this.prisma.client.user.update({
      where: { id },
      data: { role: dto.role, status: dto.status },
    })

    await this.audit.record({
      actorId: request.user!.id,
      actorRole: request.user!.role,
      action: 'USER_ROLE_OR_STATUS_CHANGED',
      resource: 'user',
      resourceId: id,
      before: { role: before.role, status: before.status },
      after: { role: user.role, status: user.status },
      requestId: (request.headers['x-request-id'] as string) || '',
    })

    return toPublicShape(user)
  }
}
