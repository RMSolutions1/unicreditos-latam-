import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { KycModule } from '../kyc/kyc.module'

@Module({
  imports: [KycModule],
  controllers: [HealthController],
})
export class HealthModule {}
