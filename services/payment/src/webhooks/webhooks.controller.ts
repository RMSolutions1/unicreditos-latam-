import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Request } from 'express'
import { PaymentsService } from '../payments/payments.service'

@Controller('webhooks/mercadopago')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  ping() {
    return { ok: true, service: 'mercadopago', webhook: true }
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  handle(@Body() body: { data?: { id?: string }; id?: string }, @Query('id') queryId: string | undefined, @Req() request: Request) {
    const headers = {
      'x-signature': request.headers['x-signature'] as string | undefined,
      'x-request-id': request.headers['x-request-id'] as string | undefined,
    }
    const ctx = { ip: request.ip, userAgent: request.headers['user-agent'], requestId: (request.headers['x-request-id'] as string) || randomUUID() }
    return this.payments.handleMercadoPagoWebhook(headers, body, queryId, ctx)
  }
}
