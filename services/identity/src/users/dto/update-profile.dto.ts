import { IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  dni?: string

  @IsOptional()
  @IsString()
  cuil?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  income?: number
}
