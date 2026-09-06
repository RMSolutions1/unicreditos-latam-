import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { JwtStrategy } from '@unicreditos/auth'
import { PrismaModule } from './prisma/prisma.module'
import { ProductsModule } from './products/products.module'
import { ApplicationsModule } from './applications/applications.module'
import { CreditsModule } from './credits/credits.module'
import { ContractsModule } from './contracts/contracts.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    PrismaModule,
    ProductsModule,
    ApplicationsModule,
    CreditsModule,
    ContractsModule,
    HealthModule,
  ],
  providers: [JwtStrategy],
})
export class AppModule {}
