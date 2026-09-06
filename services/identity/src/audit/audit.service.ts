import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export type AuditInput = {
  actorId: string | null
  actorRole: string
  action: string
  resource: string
  resourceId: string
  before?: unknown
  after?: unknown
  ip?: string
  device?: string
  requestId: string
}

/**
 * AuditLog es append-only (docs/DATABASE.md §6 / SECURITY.md §9): no hay update ni delete expuestos aquí.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    await this.prisma.client.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        before: input.before ? JSON.parse(JSON.stringify(input.before)) : undefined,
        after: input.after ? JSON.parse(JSON.stringify(input.after)) : undefined,
        ip: input.ip,
        device: input.device,
        requestId: input.requestId,
      },
    })
  }
}
