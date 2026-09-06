import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { AccessTokenPayload, AuthenticatedUser } from './types'

/**
 * Fail-closed (docs/SECURITY.md §2): sin JWT_ACCESS_SECRET, el servicio no debe arrancar.
 * Cada servicio que use este paquete comparte el mismo secreto de acceso emitido por identity.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET no está configurado — el servicio no puede arrancar sin él (fail-closed).')
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email, role: payload.role }
  }
}
