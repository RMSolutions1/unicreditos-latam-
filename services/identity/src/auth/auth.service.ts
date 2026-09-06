import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { randomBytes, createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import type { RegisterDto } from './dto/register.dto'
import type { LoginDto } from './dto/login.dto'

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL ?? '15m'
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 días

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

type SessionContext = { ip?: string; userAgent?: string }

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private async issueTokenPair(userId: string, email: string, role: string, familyId: string, ctx: SessionContext) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL as unknown as number },
    )

    const rawRefreshToken = randomBytes(48).toString('hex')
    await this.prisma.client.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawRefreshToken),
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    })

    return { accessToken, refreshToken: rawRefreshToken }
  }

  async register(dto: RegisterDto, ctx: SessionContext & { requestId: string }) {
    const existing = await this.prisma.client.user.findUnique({ where: { email: dto.email.toLowerCase() } })
    if (existing) {
      throw new DomainError('EMAIL_ALREADY_REGISTERED', 'Ese correo ya tiene una cuenta.')
    }

    const passwordHash = await argon2.hash(dto.password)
    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
        role: 'CUSTOMER',
      },
    })

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      resource: 'user',
      resourceId: user.id,
      after: { email: user.email },
      ip: ctx.ip,
      device: ctx.userAgent,
      requestId: ctx.requestId,
    })

    const familyId = randomBytes(12).toString('hex')
    const tokens = await this.issueTokenPair(user.id, user.email, user.role, familyId, ctx)
    return { user: this.toPublicUser(user), ...tokens }
  }

  async login(dto: LoginDto, ctx: SessionContext & { requestId: string }) {
    const user = await this.prisma.client.user.findUnique({ where: { email: dto.email.toLowerCase() } })
    const valid = user ? await argon2.verify(user.passwordHash, dto.password).catch(() => false) : false

    if (!user || !valid || user.status !== 'ACTIVE') {
      throw new DomainError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')
    }

    await this.prisma.client.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resource: 'user',
      resourceId: user.id,
      ip: ctx.ip,
      device: ctx.userAgent,
      requestId: ctx.requestId,
    })

    const familyId = randomBytes(12).toString('hex')
    const tokens = await this.issueTokenPair(user.id, user.email, user.role, familyId, ctx)
    return { user: this.toPublicUser(user), ...tokens }
  }

  /**
   * Rotación de refresh tokens con detección de reuso (docs/SECURITY.md §3 y #6 de la auditoría
   * del prototipo): si un token ya rotado se reutiliza, se revoca toda la familia — indicio de robo.
   */
  async refresh(rawRefreshToken: string, ctx: SessionContext) {
    const tokenHash = hashToken(rawRefreshToken)
    const stored = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } })

    if (!stored || stored.expiresAt < new Date()) {
      throw new DomainError('REFRESH_TOKEN_INVALID', 'La sesión expiró. Iniciá sesión de nuevo.')
    }

    if (stored.revokedAt) {
      await this.prisma.client.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new DomainError('REFRESH_TOKEN_REUSED', 'Detectamos reuso de sesión. Iniciá sesión de nuevo.')
    }

    const rotated = await this.issueTokenPair(stored.userId, stored.user.email, stored.user.role, stored.familyId, ctx)
    await this.prisma.client.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: hashToken(rotated.refreshToken) },
    })

    return { user: this.toPublicUser(stored.user), ...rotated }
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken)
    const stored = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash } })
    if (!stored) return
    await this.prisma.client.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  private toPublicUser(user: { id: string; email: string; firstName: string; lastName: string; role: string; status: string }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } })
    const valid = await argon2.verify(user.passwordHash, currentPassword).catch(() => false)
    if (!valid) throw new DomainError('INVALID_CREDENTIALS', 'La contraseña actual no es correcta.')

    const passwordHash = await argon2.hash(newPassword)
    await this.prisma.client.user.update({ where: { id: userId }, data: { passwordHash } })
    // Cerrar todas las sesiones existentes: un cambio de contraseña revoca todo lo demás.
    await this.prisma.client.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
  }
}
