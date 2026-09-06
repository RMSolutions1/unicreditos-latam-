import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @MinLength(2)
  firstName!: string

  @IsString()
  @MinLength(2)
  lastName!: string

  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres.' })
  password!: string
}
