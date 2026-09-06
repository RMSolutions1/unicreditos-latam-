import { IsString, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string

  @IsString()
  @MinLength(12, { message: 'La contraseña nueva debe tener al menos 12 caracteres.' })
  newPassword!: string
}
