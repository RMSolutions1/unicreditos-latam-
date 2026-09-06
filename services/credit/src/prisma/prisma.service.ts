import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { prisma } from '@unicreditos/database'

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = prisma

  async onModuleInit() {
    await this.client.$connect()
  }

  async onModuleDestroy() {
    await this.client.$disconnect()
  }
}
