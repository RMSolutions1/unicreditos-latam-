import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { JwtStrategy } from '@unicreditos/auth'
import { PrismaModule } from './prisma/prisma.module'
import { LedgerModule } from './ledger/ledger.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PassportModule, PrismaModule, LedgerModule, HealthModule],
  providers: [JwtStrategy],
})
export class AppModule {}
