import { HttpException, HttpStatus } from '@nestjs/common'

export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INSTALLMENT_ALREADY_PAID'
  | 'PAYMENT_PROVIDER_UNAVAILABLE'
  | 'PAYMENT_PROVIDER_NOT_SUPPORTED'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'INTERNAL_ERROR'

const STATUS_BY_CODE: Record<DomainErrorCode, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  INSTALLMENT_ALREADY_PAID: HttpStatus.CONFLICT,
  PAYMENT_PROVIDER_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  PAYMENT_PROVIDER_NOT_SUPPORTED: HttpStatus.BAD_REQUEST,
  WEBHOOK_SIGNATURE_INVALID: HttpStatus.UNAUTHORIZED,
  IDEMPOTENCY_KEY_CONFLICT: HttpStatus.CONFLICT,
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
