import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { PaymentRouterService } from '../providers/payment-router.service'
import { MercadoPagoAdapter } from '../providers/mercadopago.adapter'
import { WebhooksController } from '../webhooks/webhooks.controller'

@Module({
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, PaymentRouterService, MercadoPagoAdapter],
})
export class PaymentsModule {}
