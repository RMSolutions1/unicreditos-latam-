import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentRouterService } from '../providers/payment-router.service'
import { MercadoPagoAdapter } from '../providers/mercadopago.adapter'
import { DomainError } from '../common/errors/domain-error'
import { publicId } from '../common/public-id'
import type { AuthenticatedUser } from '@unicreditos/auth'

type SessionContext = { ip?: string; userAgent?: string; requestId: string }

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
    if (!isOwner && requester.role === 'CUSTOMER') throw new DomainError('NOT_FOUND', 'Pago no encontrado.')
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
      const intent = await this.prisma.client.paymentIntent.findUnique({ where: { externalReference: payment.externalReference }, include: { installment: { include: { credit: true } } } })
      if (intent && intent.status !== 'APPROVED') {
        await this.prisma.client.$transaction(async (tx) => {
          await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'APPROVED', providerPaymentId: payment.providerPaymentId } })

          const newAmountPaid = Math.min(Number(intent.installment.amountPaid) + Number(intent.amount), Number(intent.installment.totalDue))
          const installmentStatus = newAmountPaid >= Number(intent.installment.totalDue) ? 'PAID' : 'PARTIALLY_PAID'
          await tx.installment.update({ where: { id: intent.installmentId }, data: { amountPaid: newAmountPaid, status: installmentStatus } })

          const remainingBalance = Math.max(0, Number(intent.installment.credit.balance) - Number(intent.amount))
          const unpaidCount = await tx.installment.count({ where: { creditId: intent.installment.creditId, status: { not: 'PAID' } } })
          await tx.credit.update({
            where: { id: intent.installment.creditId },
            data: { balance: remainingBalance, status: unpaidCount === 0 ? 'PAID_OFF' : undefined },
          })

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
        })
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
