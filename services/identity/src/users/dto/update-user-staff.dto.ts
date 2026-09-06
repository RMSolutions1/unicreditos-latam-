import { IsIn, IsOptional } from 'class-validator'
import type { Role, UserStatus } from '@unicreditos/database'

const ROLES: Role[] = [
  'SUPER_ADMIN',
  'CEO',
  'CFO',
  'CTO',
  'RISK_MANAGER',
  'COMPLIANCE_MANAGER',
  'TREASURY_MANAGER',
  'COLLECTION_MANAGER',
  'OPERATIONS_MANAGER',
  'SUPPORT',
  'AUDITOR',
  'ANALYST',
  'MERCHANT_ADMIN',
  'CUSTOMER',
  'INVESTOR',
]
const STATUSES: UserStatus[] = ['ACTIVE', 'PENDING', 'SUSPENDED', 'BLOCKED']

/** Cambiar rol o estado de una cuenta -- master prompt §RBAC: solo SUPER_ADMIN, siempre auditado. */
export class UpdateUserStaffDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: Role

  @IsOptional()
  @IsIn(STATUSES)
  status?: UserStatus
}
