import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { AuthenticatedUser } from '../auth.types'

export type AccessTokenPayload = {
  sub: string
  email: string
  role: AuthenticatedUser['role']
}

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
