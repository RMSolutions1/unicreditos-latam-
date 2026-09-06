import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Request } from 'express'
import { JwtAuthGuard, RolesGuard, Roles, type AuthenticatedRequest } from '@unicreditos/auth'
import { CollectionsService } from './collections.service'
import { RecordActionDto } from './dto/record-action.dto'

function ctxFrom(request: Request) {
  return { ip: request.ip, userAgent: request.headers['user-agent'], requestId: (request.headers['x-request-id'] as string) || randomUUID() }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  /**
   * Manual por ahora (master prompt §70 pide un cron job para esto); documentado en el README
   * como próximo paso cuando exista infraestructura de colas/scheduler (Redis/BullMQ).
   */
  @Roles('COLLECTION_MANAGER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post('scan')
  scan(@Req() request: AuthenticatedRequest) {
    return this.collections.scan(request.user!, ctxFrom(request))
  }

  @Roles('COLLECTION_MANAGER', 'RISK_MANAGER', 'SUPER_ADMIN', 'AUDITOR')
  @Get('cases')
  listCases() {
    return this.collections.listCases()
  }

  @Roles('COLLECTION_MANAGER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post('cases/:id/action')
  recordAction(@Param('id') id: string, @Body() dto: RecordActionDto, @Req() request: AuthenticatedRequest) {
    return this.collections.recordAction(request.user!, id, dto.action, dto.notes, ctxFrom(request))
  }
}
