import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, RolesGuard, Roles } from '@unicreditos/auth'
import type { NotificationStatus, Role } from '@unicreditos/database'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'

const NOTIFICATION_ROLES: Role[] = ['SUPER_ADMIN', 'CEO', 'COMPLIANCE_MANAGER', 'SUPPORT', 'AUDITOR']
const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new DomainError('VALIDATION_ERROR', 'page y pageSize deben ser enteros positivos.')
  return Math.min(parsed, max)
}

/**
 * NotificationLog lo escribe packages/notifications (biblioteca compartida, sin controller
 * propio) desde credit/payment/collection -- este endpoint centraliza la LECTURA acá, mismo
 * criterio que AuditController. Solo lectura: no hay reintento manual ni edición del log.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(...NOTIFICATION_ROLES)
  @Get()
  async list(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = parsePositiveInt(pageSizeRaw, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

    const where = { type: type || undefined, status: (status as NotificationStatus) || undefined }

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.client.notificationLog.count({ where }),
    ])

    return { items, page, pageSize, total }
  }
}
