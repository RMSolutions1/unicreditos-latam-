import { Injectable } from '@nestjs/common'
import { notify } from '@unicreditos/notifications'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'
import type { AuthenticatedUser } from '@unicreditos/auth'

type CollectionStatus = 'CURRENT' | 'GRACE_PERIOD' | 'OVERDUE' | 'INTENSIVE_COLLECTION' | 'LEGAL_REVIEW' | 'RECOVERED' | 'DEFAULTED'

/**
 * Umbrales de mora (días). Configurables a futuro vía ProductRules (master prompt §61) —
 * hoy son constantes explícitas, no un número inventado en el momento de escribir cada regla.
 */
const THRESHOLDS: Array<{ maxDays: number; status: CollectionStatus }> = [
  { maxDays: 5, status: 'GRACE_PERIOD' },
  { maxDays: 30, status: 'OVERDUE' },
  { maxDays: 60, status: 'INTENSIVE_COLLECTION' },
  { maxDays: 90, status: 'LEGAL_REVIEW' },
  { maxDays: Infinity, status: 'DEFAULTED' },
]

function statusForDaysOverdue(days: number): CollectionStatus {
  if (days <= 0) return 'CURRENT'
  return THRESHOLDS.find((t) => days <= t.maxDays)!.status
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cobranza responsable (master prompt §45): esto solo calcula ESTADO a partir de fechas de
   * vencimiento reales, nunca genera contenido de comunicación agresivo. Idempotente (master
   * prompt §70): correrlo dos veces seguidas dos veces produce el mismo resultado.
   */
  async scan(actor: AuthenticatedUser, ctx: { ip?: string; userAgent?: string; requestId: string }) {
    const now = new Date()
    const activeCredits = await this.prisma.client.credit.findMany({
      where: { status: 'ACTIVE' },
      include: {
        installments: { where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } } },
        collectionCases: true,
        application: { include: { user: true } },
      },
    })

    const results: Array<{ creditId: string; publicId: string; status: CollectionStatus; maxDaysOverdue: number }> = []

    for (const credit of activeCredits) {
      const overdueInstallments = credit.installments.filter((i) => i.dueDate < now)
      const maxDaysOverdue = overdueInstallments.reduce((max, i) => Math.max(max, daysBetween(now, i.dueDate)), 0)
      const status = statusForDaysOverdue(maxDaysOverdue)

      // Marca las cuotas vencidas como OVERDUE (antes estaban PENDING) para que el resto del
      // sistema (vistas de cuenta, reconciliación) refleje la realidad, no solo este servicio.
      const toMarkOverdue = overdueInstallments.filter((i) => i.status === 'PENDING')
      if (toMarkOverdue.length) {
        await this.prisma.client.installment.updateMany({ where: { id: { in: toMarkOverdue.map((i) => i.id) } }, data: { status: 'OVERDUE' } })
      }

      const previousCase = credit.collectionCases[0]
      const previousStatus = previousCase?.status ?? 'CURRENT'

      const updated = await this.prisma.client.collectionCase.upsert({
        where: { creditId: credit.id },
        update: { status, maxDaysOverdue, lastScanAt: now, closedAt: status === 'CURRENT' ? null : previousCase?.closedAt },
        create: { creditId: credit.id, status, maxDaysOverdue, lastScanAt: now },
      })

      // Solo notifica cuando el caso EMPEORA respecto del último scan — evita spam (master prompt §45).
      const worsened = status !== 'CURRENT' && status !== previousStatus
      if (worsened && credit.application.user.email) {
        const worstInstallment = overdueInstallments.sort((a, b) => Number(b.dueDate) - Number(a.dueDate))[0]
        void notify({
          type: 'PAYMENT_OVERDUE',
          to: credit.application.user.email,
          firstName: credit.application.user.firstName,
          installmentNumber: worstInstallment?.number ?? 0,
          daysOverdue: maxDaysOverdue,
          amount: worstInstallment ? Number(worstInstallment.totalDue) - Number(worstInstallment.amountPaid) : 0,
          creditPublicId: credit.publicId,
        })
      }

      results.push({ creditId: credit.id, publicId: credit.publicId, status: updated.status, maxDaysOverdue })
    }

    await this.prisma.client.auditLog.create({
      data: { actorId: actor.id, actorRole: actor.role, action: 'COLLECTION_SCAN_RUN', resource: 'collection_scan', resourceId: 'batch', after: { scanned: results.length }, ip: ctx.ip, device: ctx.userAgent, requestId: ctx.requestId },
    })

    return { scanned: results.length, results }
  }

  async listCases() {
    return this.prisma.client.collectionCase.findMany({
      where: { status: { not: 'CURRENT' } },
      orderBy: { maxDaysOverdue: 'desc' },
      include: { credit: { select: { publicId: true, userId: true, amount: true, balance: true } } },
    })
  }

  async recordAction(actor: AuthenticatedUser, caseId: string, action: 'CONTACT_ATTEMPT' | 'PROMISE_TO_PAY' | 'MARK_RECOVERED', notes: string | undefined, ctx: { ip?: string; userAgent?: string; requestId: string }) {
    const collectionCase = await this.prisma.client.collectionCase.findUnique({ where: { id: caseId } })
    if (!collectionCase) throw new DomainError('NOT_FOUND', 'Caso de cobranza no encontrado.')

    if (action === 'MARK_RECOVERED') {
      await this.prisma.client.collectionCase.update({ where: { id: caseId }, data: { status: 'RECOVERED', closedAt: new Date() } })
    }

    await this.prisma.client.auditLog.create({
      data: { actorId: actor.id, actorRole: actor.role, action: `COLLECTION_${action}`, resource: 'collection_case', resourceId: caseId, after: { notes: notes ?? null }, ip: ctx.ip, device: ctx.userAgent, requestId: ctx.requestId },
    })

    return this.prisma.client.collectionCase.findUnique({ where: { id: caseId } })
  }
}
