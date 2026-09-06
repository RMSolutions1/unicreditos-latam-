import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MercadoPagoAdapter } from '../providers/mercadopago.adapter'

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoAdapter,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'payment',
      time: new Date().toISOString(),
      resources: { mercadopago: { configured: this.mercadoPago.isConfigured() } },
    }
  }

  @Get('ready')
  async ready() {
    await this.prisma.client.$queryRawUnsafe('SELECT 1')
    return { status: 'ready', service: 'payment' }
  }
}
