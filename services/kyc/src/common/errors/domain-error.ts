import { HttpException, HttpStatus } from '@nestjs/common'

export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'KYC_NOT_CONFIGURED'
  | 'KYC_PROVIDER_UNAVAILABLE'
  | 'BANK_PROVIDER_UNAVAILABLE'
  | 'BANK_ACCOUNT_MISMATCH'
  | 'TAX_PROVIDER_NOT_CONFIGURED'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'INTERNAL_ERROR'

const STATUS_BY_CODE: Record<DomainErrorCode, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  KYC_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  KYC_PROVIDER_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  BANK_PROVIDER_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  BANK_ACCOUNT_MISMATCH: HttpStatus.UNPROCESSABLE_ENTITY,
  TAX_PROVIDER_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  WEBHOOK_SIGNATURE_INVALID: HttpStatus.UNAUTHORIZED,
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
