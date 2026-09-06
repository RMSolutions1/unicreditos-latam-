import { HttpException, HttpStatus } from '@nestjs/common'

export type DomainErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'INTERNAL_ERROR'

const STATUS_BY_CODE: Record<DomainErrorCode, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  INSUFFICIENT_PERMISSIONS: HttpStatus.FORBIDDEN,
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
