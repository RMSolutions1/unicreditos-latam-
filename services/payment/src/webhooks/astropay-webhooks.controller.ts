import { Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { PaymentsService } from '../payments/payments.service'

@Controller('webhooks/astropay')
export class AstroPayWebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  ping() {
    return { ok: true, service: 'astropay', webhook: true }
  }

  /**
   * AstroPay firma el body crudo completo (ver AstroPayAdapter.verifyCallbackSignature) -- por
   * eso lee request.rawBody (habilitado en main.ts) en vez de @Body(), que ya vendría
   * re-serializado y rompería la verificación de firma.
   */
  @HttpCode(HttpStatus.OK)
  @Post()
  handle(@Req() request: RawBodyRequest<Request>) {
    const headers = {
      'partner-signature': request.headers['partner-signature'] as string | undefined,
      'partner-request-id': request.headers['partner-request-id'] as string | undefined,
      'partner-request-time': request.headers['partner-request-time'] as string | undefined,
      'partner-certificate-serial-number': request.headers['partner-certificate-serial-number'] as string | undefined,
    }
    const ctx = { ip: request.ip, userAgent: request.headers['user-agent'], requestId: (request.headers['partner-request-id'] as string) || randomUUID() }
    const rawBody = request.rawBody?.toString('utf8') ?? ''
    return this.payments.handleAstroPayWebhook(headers, rawBody, ctx)
  }
}
