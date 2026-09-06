import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import { JwtAuthGuard, type AuthenticatedRequest } from '@unicreditos/auth'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { RateLimitGuard } from '../common/guards/rate-limit.guard'

function ctxFrom(request: Request) {
  return {
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    requestId: (request.headers['x-request-id'] as string) || randomUUID(),
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(RateLimitGuard)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, ctxFrom(request))
  }

  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, ctxFrom(request))
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, ctxFrom(request))
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken)
    return { ok: true }
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() request: AuthenticatedRequest) {
    await this.auth.changePassword(request.user!.id, dto.currentPassword, dto.newPassword)
    return { ok: true }
  }
}
