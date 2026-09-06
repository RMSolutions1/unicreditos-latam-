import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { DiditAdapter } from '../integrations/didit/didit.adapter'
import { ArgenApiAdapter } from '../integrations/argenapi/argenapi.adapter'
import { DomainError } from '../common/errors/domain-error'
import type { AuthenticatedUser } from '@unicreditos/auth'

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly didit: DiditAdapter,
    private readonly argenApi: ArgenApiAdapter,
  ) {}

  async startSession(user: AuthenticatedUser & { phone?: string | null; firstName?: string; lastName?: string; dni?: string | null }) {
    const dbUser = await this.prisma.client.user.findUniqueOrThrow({ where: { id: user.id } })
    const session = await this.didit.createSession({
      vendorData: user.id,
      email: user.email,
      phone: dbUser.phone ?? undefined,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      dni: dbUser.dni ?? undefined,
    })

    await this.prisma.client.kycVerification.create({
      data: {
        userId: user.id,
        provider: 'didit',
        providerSessionId: session.sessionId,
        status: 'IN_PROGRESS',
      },
    })

    return { sessionId: session.sessionId, url: session.url }
  }

  async getStatus(userId: string) {
    return this.prisma.client.kycVerification.findFirst({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      select: { id: true, provider: true, status: true, requestedAt: true, resolvedAt: true },
    })
  }

  /**
   * El estado definitivo viene siempre del webhook firmado del proveedor (master prompt §94/109):
   * nunca se marca un KYC como aprobado porque el usuario "volvió" de la verificación.
   */
  async handleDiditWebhook(rawBody: string, signature: string | undefined, payload: { vendor_data?: string; session_id?: string; status?: string }) {
    if (!this.didit.validateWebhook(rawBody, signature)) {
      throw new DomainError('WEBHOOK_SIGNATURE_INVALID', 'Firma de webhook inválida.')
    }
    if (!payload.session_id || !payload.status) return

    const mapped = this.didit.mapStatus(payload.status)
    const verification = await this.prisma.client.kycVerification.findUnique({
      where: { provider_providerSessionId: { provider: 'didit', providerSessionId: payload.session_id } },
    })
    if (!verification) return

    await this.prisma.client.kycVerification.update({
      where: { id: verification.id },
      data: {
        status: mapped,
        normalizedResult: { status: payload.status },
        resolvedAt: mapped === 'APPROVED' || mapped === 'REJECTED' ? new Date() : null,
      },
    })
  }

  async validateBankAccount(userId: string, cbuOrAlias: string, requestId: string) {
    const result = await this.argenApi.validate(cbuOrAlias)

    const matchStatus =
      result.ok
        ? result.data?.activa === false
          ? 'REJECTED'
          : 'VERIFIED'
        : result.status === 'not_found'
          ? 'MISMATCH'
          : 'ERROR'

    await this.prisma.client.bankAccountVerification.create({
      data: {
        userId,
        provider: 'argenapi',
        cbuOrAlias,
        holderName: result.data?.titular,
        holderCuit: result.data?.cuit,
        matchStatus,
        requestId,
      },
    })

    return result
  }
}
