import { Module } from '@nestjs/common'
import { LedgerController } from './ledger.controller'
import { TreasuryController } from '../treasury/treasury.controller'

@Module({ controllers: [LedgerController, TreasuryController] })
export class LedgerModule {}
