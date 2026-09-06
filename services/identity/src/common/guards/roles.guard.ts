import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@unicreditos/database'
import { DomainError } from '../errors/domain-error'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { AuthenticatedRequest } from '../../auth/auth.types'

/**
 * Least privilege (docs/SECURITY.md §5): sin @Roles(...) el endpoint solo exige estar autenticado.
 * Con @Roles(...) exige además pertenecer a uno de esos roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (!requiredRoles || requiredRoles.length === 0) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.user
    if (!user || !requiredRoles.includes(user.role)) {
      throw new DomainError('INSUFFICIENT_PERMISSIONS', 'No tenés permisos para esta acción.')
    }
    return true
  }
}
