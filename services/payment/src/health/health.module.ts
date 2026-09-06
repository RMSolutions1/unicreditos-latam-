import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { MercadoPagoAdapter } from '../providers/mercadopago.adapter'

@Module({
  controllers: [HealthController],
  providers: [MercadoPagoAdapter],
})
export class HealthModule {}
