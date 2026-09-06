import { IsString, MinLength } from 'class-validator'

export class ValidateBankAccountDto {
  @IsString()
  @MinLength(6)
  cbuOrAlias!: string
}
