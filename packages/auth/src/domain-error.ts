import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * Error de dominio genérico y reutilizable entre servicios (docs/API.md §Reglas de error).
 * Cada servicio define sus propios `code` (ej. 'CREDIT_NOT_ELIGIBLE'); este paquete solo
 * aporta los códigos transversales de auth/RBAC que usan sus guards.
 */
export class DomainError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status)
  }
}

export const AUTH_ERROR = {
  invalidCredentials: () => new DomainError('INVALID_CREDENTIALS', 'Iniciá sesión para continuar.', HttpStatus.UNAUTHORIZED),
  insufficientPermissions: () => new DomainError('INSUFFICIENT_PERMISSIONS', 'No tenés permisos para esta acción.', HttpStatus.FORBIDDEN),
}
