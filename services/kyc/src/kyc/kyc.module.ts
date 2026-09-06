import { Module } from '@nestjs/common'
import { KycController } from './kyc.controller'
import { KycService } from './kyc.service'
import { DiditAdapter } from '../integrations/didit/didit.adapter'
import { ArgenApiAdapter } from '../integrations/argenapi/argenapi.adapter'
import { ArcaAdapter } from '../integrations/arca/arca.adapter'

@Module({
  controllers: [KycController],
  providers: [KycService, DiditAdapter, ArgenApiAdapter, ArcaAdapter],
  exports: [DiditAdapter, ArgenApiAdapter, ArcaAdapter],
})
export class KycModule {}
