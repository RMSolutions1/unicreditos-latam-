import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, RolesGuard, Roles } from '@unicreditos/auth'
import type { Role } from '@unicreditos/database'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'

const AUDIT_ROLES: Role[] = ['SUPER_ADMIN', 'CEO', 'COMPLIANCE_MANAGER', 'AUDITOR']
const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new DomainError('VALIDATION_ERROR', 'page y pageSize deben ser enteros positivos.')
  }
  return Math.min(parsed, max)
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new DomainError('VALIDATION_ERROR', `${field} debe ser una fecha ISO válida.`)
  }
  return date
}

/**
 * AuditLog es append-only y solo tiene lectura acá -- ver docs/DATABASE.md §6 / SECURITY.md §9.
 * Cada uno de los 6 servicios escribe sus propios eventos directo a la misma tabla compartida
 * (Prisma apunta a la misma DB); este endpoint centraliza la LECTURA porque identity ya es el
 * dueño del dominio de auditoría (es quien registró el primer AuditLog en Fase 1).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(...AUDIT_ROLES)
  @Get()
  async list(
    @Query('resource') resource?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = parsePositiveInt(pageSizeRaw, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    const fromDate = parseDate(from, 'from')
    const toDate = parseDate(to, 'to')
    if (fromDate && toDate && fromDate > toDate) {
      throw new DomainError('VALIDATION_ERROR', 'from no puede ser posterior a to.')
    }

    const where = {
      resource: resource || undefined,
      actorId: actorId || undefined,
      action: action || undefined,
      createdAt: fromDate || toDate ? { gte: fromDate, lte: toDate } : undefined,
    }

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.client.auditLog.count({ where }),
    ])

    return { items, page, pageSize, total }
  }
}
