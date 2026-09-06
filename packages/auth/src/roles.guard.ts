import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@unicreditos/database'
import { AUTH_ERROR } from './domain-error'
import { ROLES_KEY } from './roles.decorator'
import type { AuthenticatedRequest } from './types'

/** Least privilege (docs/SECURITY.md §5): sin @Roles(...) solo exige estar autenticado. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (!requiredRoles || requiredRoles.length === 0) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw AUTH_ERROR.insufficientPermissions()
    }
    return true
  }
}
