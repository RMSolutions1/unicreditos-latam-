import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * Códigos fijos de docs/API.md §Reglas de error. Nunca se expone un stack trace al cliente.
 */
export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'REFRESH_TOKEN_INVALID'
  | 'REFRESH_TOKEN_REUSED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'

const STATUS_BY_CODE: Record<DomainErrorCode, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  EMAIL_ALREADY_REGISTERED: HttpStatus.CONFLICT,
  REFRESH_TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
  REFRESH_TOKEN_REUSED: HttpStatus.UNAUTHORIZED,
  INSUFFICIENT_PERMISSIONS: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
}

export class DomainError extends HttpException {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super({ code, message }, STATUS_BY_CODE[code])
  }
}
