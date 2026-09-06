import { Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { FinancialCalculationService } from '../finance/financial-calculation.service'
import { RiskEngineService } from '../risk/risk-engine.service'
import { DecisionEngineService, DECISION_RULES_VERSION, type Decision } from '../risk/decision-engine.service'
import { DomainError } from '../common/errors/domain-error'
import { publicId } from '../common/public-id'
import { postLedgerTransaction, GLOBAL_OWNER_ID } from '@unicreditos/ledger'
import type { AuthenticatedUser } from '@unicreditos/auth'

const FIRST_CREDIT_HARD_CAP = 400_000
const INCOME_DTI_RATIO = 0.35

const DECISION_TO_STATUS: Record<Decision, 'APPROVED' | 'PRE_APPROVED' | 'MANUAL_REVIEW' | 'REJECTED'> = {
  APPROVE: 'APPROVED',
  PRE_APPROVE: 'PRE_APPROVED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  REJECT: 'REJECTED',
}

type SessionContext = { ip?: string; userAgent?: string; requestId: string }

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinancialCalculationService,
    private readonly riskEngine: RiskEngineService,
    private readonly decisionEngine: DecisionEngineService,
  ) {}

  private async audit(input: { actorId: string | null; actorRole: string; action: string; resource: string; resourceId: string; after?: unknown; before?: unknown; ctx: SessionContext }) {
    await this.prisma.client.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        before: input.before ? JSON.parse(JSON.stringify(input.before)) : undefined,
        after: input.after ? JSON.parse(JSON.stringify(input.after)) : undefined,
        ip: input.ctx.ip,
        device: input.ctx.userAgent,
        requestId: input.ctx.requestId,
      },
    })
  }

  async create(user: AuthenticatedUser, dto: { productId: string; amount: number; months: number }, ctx: SessionContext) {
    const product = await this.prisma.client.creditProduct.findUnique({ where: { id: dto.productId, active: true } })
    if (!product) throw new DomainError('PRODUCT_NOT_FOUND', 'Producto no disponible.')
    if (dto.amount < Number(product.minAmount) || dto.amount > Number(product.maxAmount)) {
      throw new DomainError('AMOUNT_OUT_OF_RANGE', `El monto debe estar entre ${product.minAmount} y ${product.maxAmount}.`)
    }
    if (dto.months < product.minTermMonths || dto.months > product.maxTermMonths) {
      throw new DomainError('TERM_OUT_OF_RANGE', `El plazo debe estar entre ${product.minTermMonths} y ${product.maxTermMonths} meses.`)
    }

    const dbUser = await this.prisma.client.user.findUniqueOrThrow({ where: { id: user.id } })
    const income = Number(dbUser.income ?? 0)
    if (income <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'Declará tu ingreso mensual antes de solicitar un crédito.')
    }

    const hasDisbursedBefore = await this.prisma.client.credit.findFirst({ where: { userId: user.id } })
    if (!hasDisbursedBefore && dto.amount > FIRST_CREDIT_HARD_CAP) {
      throw new DomainError('FIRST_CREDIT_CAP_EXCEEDED', `Tu primer crédito está acotado a $${FIRST_CREDIT_HARD_CAP.toLocaleString('es-AR')}.`)
    }

    const pricing = this.finance.quote(dto.amount, dto.months, Number(product.monthlyRate))
    const dtiOk = pricing.monthlyPayment <= income * INCOME_DTI_RATIO

    const latestBankVerification = await this.prisma.client.bankAccountVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    const bankVerified = latestBankVerification ? latestBankVerification.matchStatus === 'VERIFIED' : null

    const risk = this.riskEngine.assess({
      income,
      monthlyPayment: pricing.monthlyPayment,
      hasDni: Boolean(dbUser.dni),
      hasCuil: Boolean(dbUser.cuil),
      bankVerified,
    })
    const decision = this.decisionEngine.decide(risk, dtiOk)
    const status = DECISION_TO_STATUS[decision]

    const application = await this.prisma.client.creditApplication.create({
      data: {
        publicId: publicId('UNI'),
        userId: user.id,
        productId: product.id,
        amount: dto.amount,
        months: dto.months,
        monthlyPayment: pricing.monthlyPayment,
        tna: pricing.tna,
        tea: pricing.tea,
        cft: pricing.cft,
        status,
        decisions: {
          create: {
            decision,
            riskScore: risk.score,
            riskLevel: risk.riskLevel,
            modelVersion: risk.modelVersion,
            rulesVersion: DECISION_RULES_VERSION,
            inputs: { income, monthlyPayment: pricing.monthlyPayment, hasDni: Boolean(dbUser.dni), hasCuil: Boolean(dbUser.cuil), bankVerified, dtiOk },
            result: { decision, status },
            decidedBy: 'system',
          },
        },
      },
      include: { decisions: true },
    })

    await this.audit({ actorId: user.id, actorRole: user.role, action: 'CREDIT_APPLICATION_SUBMITTED', resource: 'credit_application', resourceId: application.id, after: { status, decision }, ctx })
    return application
  }

  async listMine(userId: string) {
    return this.prisma.client.creditApplication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { product: true } })
  }

  async getOne(id: string, requester: AuthenticatedUser) {
    const application = await this.prisma.client.creditApplication.findUnique({
      where: { id },
      include: { product: true, decisions: { orderBy: { decidedAt: 'desc' } }, contract: true, credit: { include: { installments: true } } },
    })
    if (!application) throw new DomainError('NOT_FOUND', 'Solicitud no encontrada.')
    const isOwner = application.userId === requester.id
    const isStaff = requester.role !== 'CUSTOMER'
    if (!isOwner && !isStaff) throw new DomainError('NOT_FOUND', 'Solicitud no encontrada.')
    return application
  }

  /** Requiere rol RISK_MANAGER/COMPLIANCE_MANAGER (enforcement en el controller vía @Roles). */
  async review(admin: AuthenticatedUser, applicationId: string, action: 'approve' | 'reject', reason: string | undefined, ctx: SessionContext) {
    const application = await this.prisma.client.creditApplication.findUnique({ where: { id: applicationId }, include: { decisions: { orderBy: { decidedAt: 'desc' }, take: 1 } } })
    if (!application) throw new DomainError('NOT_FOUND', 'Solicitud no encontrada.')
    if (application.status !== 'PRE_APPROVED' && application.status !== 'MANUAL_REVIEW') {
      throw new DomainError('INVALID_TRANSITION', `No se puede revisar una solicitud en estado ${application.status}.`)
    }

    const nextStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    const lastDecision = application.decisions[0]

    const [updated] = await this.prisma.client.$transaction([
      this.prisma.client.creditApplication.update({ where: { id: applicationId }, data: { status: nextStatus } }),
      this.prisma.client.creditDecision.create({
        data: {
          applicationId,
          decision: action === 'approve' ? 'APPROVED_BY_REVIEWER' : 'REJECTED_BY_REVIEWER',
          riskScore: lastDecision?.riskScore ?? 0,
          riskLevel: lastDecision?.riskLevel ?? 'N/A',
          modelVersion: lastDecision?.modelVersion ?? 'n/a',
          rulesVersion: DECISION_RULES_VERSION,
          inputs: { reason: reason ?? null },
          result: { action, status: nextStatus },
          decidedBy: admin.id,
        },
      }),
    ])

    await this.audit({ actorId: admin.id, actorRole: admin.role, action: 'CREDIT_APPLICATION_REVIEWED', resource: 'credit_application', resourceId: applicationId, before: { status: application.status }, after: { status: nextStatus, action, reason }, ctx })
    return updated
  }

  async acceptContract(user: AuthenticatedUser, applicationId: string, ctx: SessionContext) {
    const application = await this.prisma.client.creditApplication.findUnique({ where: { id: applicationId }, include: { contract: true } })
    if (!application || application.userId !== user.id) throw new DomainError('NOT_FOUND', 'Solicitud no encontrada.')
    if (application.status !== 'APPROVED') throw new DomainError('INVALID_TRANSITION', 'La solicitud todavía no está aprobada.')
    if (application.contract) throw new DomainError('CONTRACT_ALREADY_ACCEPTED', 'Ya aceptaste el contrato de esta solicitud.')

    const documentHash = createHash('sha256')
      .update(`${application.id}:${application.amount}:${application.months}:${application.tna}:v1`)
      .digest('hex')

    const [, application2] = await this.prisma.client.$transaction([
      this.prisma.client.contract.create({
        data: {
          applicationId,
          version: 1,
          documentHash,
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      }),
      this.prisma.client.creditApplication.update({ where: { id: applicationId }, data: { status: 'READY_FOR_DISBURSEMENT' } }),
    ])

    await this.audit({ actorId: user.id, actorRole: user.role, action: 'CONTRACT_ACCEPTED', resource: 'credit_application', resourceId: applicationId, after: { documentHash }, ctx })
    return application2
  }

  /** Requiere rol TREASURY_MANAGER (enforcement en el controller). Segregación de funciones: master prompt §33/56/97. */
  async disburse(treasury: AuthenticatedUser, applicationId: string, ctx: SessionContext) {
    const application = await this.prisma.client.creditApplication.findUnique({
      where: { id: applicationId },
      include: { product: true, decisions: { orderBy: { decidedAt: 'desc' } } },
    })
    if (!application) throw new DomainError('NOT_FOUND', 'Solicitud no encontrada.')
    if (application.status !== 'READY_FOR_DISBURSEMENT') {
      throw new DomainError('INVALID_TRANSITION', `No se puede desembolsar una solicitud en estado ${application.status}.`)
    }
    if (application.userId === treasury.id) {
      throw new DomainError('SEGREGATION_OF_DUTIES_VIOLATION', 'No podés desembolsar tu propio crédito.')
    }
    const approverDecision = application.decisions.find((d) => d.decision === 'APPROVED_BY_REVIEWER' || d.decision === 'APPROVE')
    if (approverDecision && approverDecision.decidedBy !== 'system' && approverDecision.decidedBy === treasury.id) {
      throw new DomainError('SEGREGATION_OF_DUTIES_VIOLATION', 'Quien aprueba una solicitud no puede además desembolsarla.')
    }

    const bankVerification = await this.prisma.client.bankAccountVerification.findFirst({
      where: { userId: application.userId, matchStatus: 'VERIFIED' },
      orderBy: { createdAt: 'desc' },
    })
    if (!bankVerification) throw new DomainError('BANK_ACCOUNT_NOT_VERIFIED', 'El cliente no tiene una cuenta bancaria verificada.')

    const plan = this.finance.buildInstallmentPlan(Number(application.amount), application.months, Number(application.product.monthlyRate))
    const now = new Date()

    const credit = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.credit.create({
        data: {
          publicId: publicId('CR'),
          applicationId: application.id,
          userId: application.userId,
          productId: application.productId,
          amount: application.amount,
          balance: application.amount,
          months: application.months,
          monthlyPayment: application.monthlyPayment,
          tna: application.tna,
          disbursedTo: bankVerification.cbuOrAlias,
          disbursedBy: treasury.id,
        },
      })
      await tx.installment.createMany({
        data: plan.map((row) => ({
          creditId: created.id,
          number: row.number,
          dueDate: new Date(now.getFullYear(), now.getMonth() + row.number, now.getDate()),
          principal: row.principal,
          interest: row.interest,
          totalDue: row.totalDue,
        })),
      })
      await tx.creditApplication.update({ where: { id: application.id }, data: { status: 'DISBURSED' } })

      // Ledger de doble entrada (master prompt §39): nunca "balance = balance + amount".
      // El desembolso mueve fondos de TREASURY hacia el cliente (aumenta lo que nos debe).
      await postLedgerTransaction(tx, {
        type: 'DISBURSEMENT',
        reference: created.id,
        entries: [
          { ownerType: 'CUSTOMER', ownerId: application.userId, direction: 'DEBIT', amount: Number(application.amount) },
          { ownerType: 'TREASURY', ownerId: GLOBAL_OWNER_ID, direction: 'CREDIT', amount: Number(application.amount) },
        ],
      })

      return created
    })

    await this.audit({ actorId: treasury.id, actorRole: treasury.role, action: 'CREDIT_DISBURSED', resource: 'credit', resourceId: credit.id, after: { amount: credit.amount, disbursedTo: credit.disbursedTo }, ctx })
    return this.prisma.client.credit.findUnique({ where: { id: credit.id }, include: { installments: true } })
  }
}
