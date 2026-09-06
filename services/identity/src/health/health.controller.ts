import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'identity', time: new Date().toISOString() }
  }

  @Get('ready')
  async ready() {
    await this.prisma.client.$queryRawUnsafe('SELECT 1')
    return { status: 'ready', service: 'identity' }
  }
}
