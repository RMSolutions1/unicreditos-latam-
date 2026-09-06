import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { DiditAdapter } from '../integrations/didit/didit.adapter'
import { ArgenApiAdapter } from '../integrations/argenapi/argenapi.adapter'
import { ArcaAdapter } from '../integrations/arca/arca.adapter'

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly didit: DiditAdapter,
    private readonly argenApi: ArgenApiAdapter,
    private readonly arca: ArcaAdapter,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'kyc',
      time: new Date().toISOString(),
      resources: {
        didit: { configured: this.didit.isConfigured() },
        argenapi: { configured: this.argenApi.isConfigured() },
        arca: { configured: this.arca.isConfigured() },
      },
    }
  }

  @Get('ready')
  async ready() {
    await this.prisma.client.$queryRawUnsafe('SELECT 1')
    return { status: 'ready', service: 'kyc' }
  }
}
