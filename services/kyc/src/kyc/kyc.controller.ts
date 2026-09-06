import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import { JwtAuthGuard, type AuthenticatedRequest } from '@unicreditos/auth'
import { KycService } from './kyc.service'
import { ValidateBankAccountDto } from './dto/validate-bank-account.dto'

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @UseGuards(JwtAuthGuard)
  @Post('sessions')
  startSession(@Req() request: AuthenticatedRequest) {
    return this.kyc.startSession(request.user!)
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/latest')
  getLatest(@Req() request: AuthenticatedRequest) {
    return this.kyc.getStatus(request.user!.id)
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('bank-account/validate')
  validateBankAccount(@Body() dto: ValidateBankAccountDto, @Req() request: AuthenticatedRequest) {
    const requestId = (request.headers['x-request-id'] as string) || randomUUID()
    return this.kyc.validateBankAccount(request.user!.id, dto.cbuOrAlias, requestId)
  }

  @HttpCode(HttpStatus.OK)
  @Post('webhooks/didit')
  handleDiditWebhook(@Body() body: { vendor_data?: string; session_id?: string; status?: string }, @Req() request: Request & { rawBody?: string }) {
    const signature = String(request.headers['x-signature'] || request.headers['x-didit-signature'] || '')
    return this.kyc.handleDiditWebhook(request.rawBody ?? JSON.stringify(body), signature, body).then(() => ({ ok: true }))
  }
}
