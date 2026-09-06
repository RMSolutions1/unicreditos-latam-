import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { PaymentRouterService } from '../providers/payment-router.service'
import { MercadoPagoAdapter } from '../providers/mercadopago.adapter'
import { AstroPayAdapter } from '../providers/astropay.adapter'
import { WebhooksController } from '../webhooks/webhooks.controller'
import { AstroPayWebhooksController } from '../webhooks/astropay-webhooks.controller'

@Module({
  controllers: [PaymentsController, WebhooksController, AstroPayWebhooksController],
  providers: [PaymentsService, PaymentRouterService, MercadoPagoAdapter, AstroPayAdapter],
})
export class PaymentsModule {}
