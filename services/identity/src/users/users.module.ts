import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
})
export class UsersModule {}
