import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AUTH_ERROR } from './domain-error'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T = unknown>(err: unknown, user: T): T {
    if (err || !user) throw AUTH_ERROR.invalidCredentials()
    return user
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest()
  }
}
