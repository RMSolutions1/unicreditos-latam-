import { IsIn, IsOptional, IsString } from 'class-validator'

export class RecordActionDto {
  @IsIn(['CONTACT_ATTEMPT', 'PROMISE_TO_PAY', 'MARK_RECOVERED'])
  action!: 'CONTACT_ATTEMPT' | 'PROMISE_TO_PAY' | 'MARK_RECOVERED'

  @IsOptional()
  @IsString()
  notes?: string
}
