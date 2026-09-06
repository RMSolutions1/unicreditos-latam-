import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, RolesGuard, Roles } from '@unicreditos/auth'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'

const CONTRACT_STAFF_ROLES = ['TREASURY_MANAGER', 'COMPLIANCE_MANAGER', 'SUPER_ADMIN', 'AUDITOR', 'CEO', 'CFO'] as const
const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new DomainError('VALIDATION_ERROR', 'page y pageSize deben ser enteros positivos.')
  return Math.min(parsed, max)
}

/**
 * Contract es 1:1 con CreditApplication (master prompt §37: "aceptar" crea el registro una sola
 * vez, nunca se sobrescribe). Este endpoint es de solo lectura -- no hay forma de anular ni
 * editar un contrato desde acá, a propósito.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(...CONTRACT_STAFF_ROLES)
  @Get()
  async list(@Query('search') search: string | undefined, @Query('page') pageRaw?: string, @Query('pageSize') pageSizeRaw?: string) {
    const page = parsePositiveInt(pageRaw, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = parsePositiveInt(pageSizeRaw, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

    const where = search
      ? {
          application: {
            is: {
              OR: [
                { publicId: { contains: search, mode: 'insensitive' as const } },
                { user: { is: { email: { contains: search, mode: 'insensitive' as const } } } },
                { user: { is: { firstName: { contains: search, mode: 'insensitive' as const } } } },
                { user: { is: { lastName: { contains: search, mode: 'insensitive' as const } } } },
              ],
            },
          },
        }
      : undefined

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.contract.findMany({
        where,
        orderBy: { acceptedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          application: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              product: { select: { name: true } },
              credit: { select: { id: true, publicId: true } },
            },
          },
        },
      }),
      this.prisma.client.contract.count({ where }),
    ])

    return { items, page, pageSize, total }
  }
}
