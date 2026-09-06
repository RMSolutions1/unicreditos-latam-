import { IsIn, IsOptional, IsString } from 'class-validator'

export class ReviewApplicationDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject'

  @IsOptional()
  @IsString()
  reason?: string
}
