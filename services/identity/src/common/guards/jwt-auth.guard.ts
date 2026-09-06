import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { DomainError } from '../errors/domain-error'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T = unknown>(err: unknown, user: T): T {
    if (err || !user) {
      throw new DomainError('INVALID_CREDENTIALS', 'Iniciá sesión para continuar.')
    }
    return user
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest()
  }
}
