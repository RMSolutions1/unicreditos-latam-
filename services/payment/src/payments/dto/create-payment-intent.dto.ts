import { IsIn, IsOptional, IsString } from 'class-validator'

export class CreatePaymentIntentDto {
  @IsString()
  installmentId!: string

  /** Sin esto, PaymentRouterService usa el default (Mercado Pago). */
  @IsOptional()
  @IsIn(['mercadopago', 'astropay'])
  provider?: 'mercadopago' | 'astropay'
}
