import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentRouterService } from '../providers/payment-router.service'
import { MercadoPagoAdapter } from '../providers/mercadopago.adapter'
import { DomainError } from '../common/errors/domain-error'
import { publicId } from '../common/public-id'
import { postLedgerTransaction, GLOBAL_OWNER_ID } from '@unicreditos/ledger'
import { notify } from '@unicreditos/notifications'
import type { AuthenticatedUser } from '@unicreditos/auth'

type SessionContext = { ip?: string; userAgent?: string; requestId: string }

/** Roles con motivo de negocio para ver pagos de un cliente que no es el propio. */
const PAYMENT_STAFF_ROLES: string[] = ['TREASURY_MANAGER', 'SUPPORT', 'AUDITOR', 'SUPER_ADMIN', 'CFO']

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: PaymentRouterService,
    private readonly mercadoPago: MercadoPagoAdapter,
  ) {}

  private async audit(input: { actorId: string | null; actorRole: string; action: string; resourceId: string; after?: unknown; ctx: SessionContext }) {
    await this.prisma.client.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        resource: 'payment_intent',
        resourceId: input.resourceId,
        after: input.after ? JSON.parse(JSON.stringify(input.after)) : undefined,
        ip: input.ctx.ip,
        device: input.ctx.userAgent,
        requestId: input.ctx.requestId,
      },
    })
  }

  async createIntent(user: AuthenticatedUser, installmentId: string, ctx: SessionContext) {
    const installment = await this.prisma.client.installment.findUnique({
      where: { id: installmentId },
      include: { credit: true },
    })
    if (!installment || installment.credit.userId !== user.id) throw new DomainError('NOT_FOUND', 'Cuota no encontrada.')
    if (installment.status === 'PAID' || installment.status === 'CANCELLED') {
      throw new DomainError('INSTALLMENT_ALREADY_PAID', 'Esta cuota ya está paga.')
    }

    const amount = Number(installment.totalDue) - Number(installment.amountPaid)
    const externalReference = publicId('UNI-PAY')
    const provider = this.router.resolve('AR')

    const checkout = await provider.createCheckout({
      amount,
      externalReference,
      description: `Cuota ${installment.number} · Crédito ${installment.credit.publicId} · UNICRÉDITOS`,
    })

    const intent = await this.prisma.client.paymentIntent.create({
      data: {
        userId: user.id,
        installmentId: installment.id,
        amount,
        provider: provider.name,
        status: 'PENDING',
        externalReference,
        idempotencyKey: randomUUID(),
      },
    })

    await this.audit({ actorId: user.id, actorRole: user.role, action: 'PAYMENT_INTENT_CREATED', resourceId: intent.id, after: { amount, installmentId }, ctx })
    return { paymentIntentId: intent.id, checkoutUrl: checkout.initPoint, externalReference }
  }

  async getOne(id: string, requester: AuthenticatedUser) {
    const intent = await this.prisma.client.paymentIntent.findUnique({ where: { id }, include: { installment: { include: { credit: true } } } })
    if (!intent) throw new DomainError('NOT_FOUND', 'Pago no encontrado.')
    const isOwner = intent.userId === requester.id
    // Hallazgo de auditoría: "cualquier rol que no sea CUSTOMER" era demasiado amplio.
    const isStaff = PAYMENT_STAFF_ROLES.includes(requester.role)
    if (!isOwner && !isStaff) throw new DomainError('NOT_FOUND', 'Pago no encontrado.')
    return intent
  }

  async getReceipt(id: string, requester: AuthenticatedUser) {
    const intent = await this.getOne(id, requester)
    if (intent.status !== 'APPROVED') throw new DomainError('VALIDATION_ERROR', 'El comprobante solo está disponible para pagos aprobados.')
    return {
      comprobante: intent.externalReference,
      cliente: intent.userId,
      credito: intent.installment.credit.publicId,
      cuota: intent.installment.number,
      importe: intent.amount,
      moneda: intent.currency,
      proveedor: intent.provider,
      idOperacion: intent.providerPaymentId,
      fecha: intent.updatedAt,
      estado: intent.status,
    }
  }

  /**
   * El estado definitivo viene siempre de acá, nunca de que el usuario "vuelva" del checkout
   * (master prompt §19/94). Idempotente vía WebhookEvent(provider, providerEventId) — un
   * reintento del mismo evento no vuelve a acreditar el pago.
   */
  async handleMercadoPagoWebhook(headers: Record<string, string | undefined>, body: { data?: { id?: string }; id?: string }, queryId: string | undefined, ctx: SessionContext) {
    const dataId = String(body?.data?.id ?? body?.id ?? queryId ?? '')
    if (!dataId) return { ok: true }

    const signatureValid = this.mercadoPago.validateWebhookSignature(headers, dataId)
    if (!signatureValid) throw new DomainError('WEBHOOK_SIGNATURE_INVALID', 'Firma de webhook inválida.')

    const existing = await this.prisma.client.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: 'mercadopago', providerEventId: dataId } } })
    if (existing?.processedAt) return { ok: true, idempotent: true }

    const event =
      existing ??
      (await this.prisma.client.webhookEvent.create({ data: { provider: 'mercadopago', providerEventId: dataId, signatureValid: true, payload: body as object } }))

    const payment = await this.mercadoPago.getPayment(dataId)

    if (payment.status === 'approved' && payment.externalReference) {
      const intentSummary = await this.prisma.client.paymentIntent.findUnique({ where: { externalReference: payment.externalReference } })
      if (intentSummary && intentSummary.status !== 'APPROVED') {
        const approvedNotification = await this.prisma.client.$transaction(async (tx) => {
          // Releído DENTRO de la transacción (hallazgo de auditoría): el snapshot de afuera podía
          // quedar stale si dos webhooks para el mismo crédito se procesan casi al mismo tiempo,
          // pisando el balance/amountPaid calculado con datos viejos.
          const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentSummary.id }, include: { installment: { include: { credit: true } } } })
          if (intent.status === 'APPROVED') return null // otro proceso ya lo aprobó mientras esperábamos el lock

          await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'APPROVED', providerPaymentId: payment.providerPaymentId } })

          const newAmountPaid = Math.min(Number(intent.installment.amountPaid) + Number(intent.amount), Number(intent.installment.totalDue))
          const installmentStatus = newAmountPaid >= Number(intent.installment.totalDue) ? 'PAID' : 'PARTIALLY_PAID'
          await tx.installment.update({ where: { id: intent.installmentId }, data: { amountPaid: newAmountPaid, status: installmentStatus } })

          // Credit.balance representa CAPITAL pendiente, no "lo que falta cobrar" -- solo la
          // porción de capital de este pago se descuenta, nunca el interés (hallazgo corregido
          // antes de construir el pago anticipado en Fase 6, que necesita un capital exacto).
          const totalDue = Number(intent.installment.totalDue)
          const paidFraction = totalDue > 0 ? Number(intent.amount) / totalDue : 0
          const principalPortion = Math.round(Number(intent.installment.principal) * paidFraction * 100) / 100
          const interestPortion = Math.round((Number(intent.amount) - principalPortion) * 100) / 100

          const remainingBalance = Math.max(0, Number(intent.installment.credit.balance) - principalPortion)
          const unpaidCount = await tx.installment.count({ where: { creditId: intent.installment.creditId, status: { not: 'PAID' } } })
          await tx.credit.update({
            where: { id: intent.installment.creditId },
            data: { balance: remainingBalance, status: unpaidCount === 0 ? 'PAID_OFF' : undefined },
          })

          // Ledger de doble entrada real (master prompt §39): el capital reduce lo que nos debe
          // el cliente (cuenta CUSTOMER); el interés es ingreso reconocido (cuenta REVENUE).
          // TREASURY recibe el efectivo completo. Débitos siempre == créditos.
          const entries: Parameters<typeof postLedgerTransaction>[1]['entries'] = [
            { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'DEBIT', amount: Number(intent.amount) },
          ]
          if (principalPortion > 0) entries.push({ ownerType: 'CUSTOMER', ownerId: intent.userId, direction: 'CREDIT', amount: principalPortion })
          if (interestPortion > 0) entries.push({ ownerType: 'REVENUE', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: interestPortion })

          await postLedgerTransaction(tx, { type: 'REPAYMENT', reference: intent.id, entries })

          await tx.auditLog.create({
            data: {
              actorId: null,
              actorRole: 'system',
              action: 'PAYMENT_APPROVED',
              resource: 'payment_intent',
              resourceId: intent.id,
              after: { providerPaymentId: payment.providerPaymentId, amount: intent.amount },
              requestId: ctx.requestId,
            },
          })

          return { userId: intent.userId, amount: Number(intent.amount), installmentNumber: intent.installment.number, creditPublicId: intent.installment.credit.publicId }
        })

        // Fuera de la transacción: un fallo de email no debe revertir un pago ya acreditado.
        if (approvedNotification) {
          const customer = await this.prisma.client.user.findUnique({ where: { id: approvedNotification.userId } })
          if (customer) {
            void notify({
              type: 'PAYMENT_RECEIVED',
              to: customer.email,
              firstName: customer.firstName,
              installmentNumber: approvedNotification.installmentNumber,
              amount: approvedNotification.amount,
              creditPublicId: approvedNotification.creditPublicId,
            })
          }
        }
      }
    } else if (['rejected', 'cancelled'].includes(payment.status) && payment.externalReference) {
      await this.prisma.client.paymentIntent.updateMany({
        where: { externalReference: payment.externalReference, status: { notIn: ['APPROVED'] } },
        data: { status: payment.status === 'rejected' ? 'REJECTED' : 'CANCELLED' },
      })
    }

    await this.prisma.client.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
    return { ok: true }
  }
}
