import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { JwtAuthGuard, type AuthenticatedRequest } from '@unicreditos/auth'
import { PaymentsService } from './payments.service'
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto'

@UseGuards(JwtAuthGuard)
@Controller('payment-intents')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreatePaymentIntentDto, @Req() request: AuthenticatedRequest) {
    const ctx = { ip: request.ip, userAgent: request.headers['user-agent'], requestId: (request.headers['x-request-id'] as string) || randomUUID() }
    return this.payments.createIntent(request.user!, dto.installmentId, ctx, dto.provider)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.payments.getOne(id, request.user!)
  }

  @Get(':id/receipt')
  getReceipt(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.payments.getReceipt(id, request.user!)
  }
}
