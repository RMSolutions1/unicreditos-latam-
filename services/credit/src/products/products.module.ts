import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { FinancialCalculationService } from '../finance/financial-calculation.service'

@Module({
  controllers: [ProductsController],
  providers: [FinancialCalculationService],
  exports: [FinancialCalculationService],
})
export class ProductsModule {}
