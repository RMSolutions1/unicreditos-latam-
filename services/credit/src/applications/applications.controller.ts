import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import { JwtAuthGuard, RolesGuard, Roles, type AuthenticatedRequest } from '@unicreditos/auth'
import { ApplicationsService } from './applications.service'
import { CreateApplicationDto } from './dto/create-application.dto'
import { ReviewApplicationDto } from './dto/review-application.dto'

function ctxFrom(request: Request) {
  return { ip: request.ip, userAgent: request.headers['user-agent'], requestId: (request.headers['x-request-id'] as string) || randomUUID() }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('credit-applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto, @Req() request: AuthenticatedRequest) {
    return this.applications.create(request.user!, dto, ctxFrom(request))
  }

  @Get()
  listMine(@Req() request: AuthenticatedRequest) {
    return this.applications.listMine(request.user!.id)
  }

  // Rutas estáticas ANTES de ':id' -- si no, Nest interpreta "queue" como un id.
  @Roles('RISK_MANAGER', 'COMPLIANCE_MANAGER', 'SUPER_ADMIN', 'AUDITOR')
  @Get('queue')
  listQueue() {
    return this.applications.listQueue()
  }

  @Roles('TREASURY_MANAGER', 'SUPER_ADMIN', 'AUDITOR')
  @Get('ready-for-disbursement')
  listReadyForDisbursement() {
    return this.applications.listReadyForDisbursement()
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.applications.getOne(id, request.user!)
  }

  @Roles('RISK_MANAGER', 'COMPLIANCE_MANAGER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewApplicationDto, @Req() request: AuthenticatedRequest) {
    return this.applications.review(request.user!, id, dto.action, dto.reason, ctxFrom(request))
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/contract/accept')
  acceptContract(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.applications.acceptContract(request.user!, id, ctxFrom(request))
  }

  @Roles('TREASURY_MANAGER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/disburse')
  disburse(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.applications.disburse(request.user!, id, ctxFrom(request))
  }
}
