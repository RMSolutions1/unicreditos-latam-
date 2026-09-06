import { Module } from '@nestjs/common'
import { ApplicationsController } from './applications.controller'
import { ApplicationsService } from './applications.service'
import { RiskEngineService } from '../risk/risk-engine.service'
import { DecisionEngineService } from '../risk/decision-engine.service'
import { ProductsModule } from '../products/products.module'

@Module({
  imports: [ProductsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, RiskEngineService, DecisionEngineService],
})
export class ApplicationsModule {}
