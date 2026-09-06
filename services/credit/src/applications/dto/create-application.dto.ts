import { IsInt, IsNumber, IsString, Min } from 'class-validator'

export class CreateApplicationDto {
  @IsString()
  productId!: string

  @IsNumber()
  @Min(1)
  amount!: number

  @IsInt()
  @Min(1)
  months!: number
}
