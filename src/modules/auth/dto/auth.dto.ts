import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsPassword, OptionalField, RequiredField } from '../../../common/validation';

/**
 * Messages are spelled out in full so the client can drop them straight into a
 * field's error slot, exactly as the previous hand-rolled validator did.
 */
export class RegisterDto {
  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MinLength(2, { message: '$property must be at least 2 characters' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  name: string;

  @RequiredField()
  @IsEmail({}, { message: '$property must be a valid email address' })
  email: string;

  @RequiredField()
  @IsPassword()
  password: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(32, { message: '$property must be at most 32 characters' })
  phone?: string;
}

export class LoginDto {
  @RequiredField()
  @IsEmail({}, { message: '$property must be a valid email address' })
  email: string;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  password: string;
}

export class UpdateProfileDto {
  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MinLength(2, { message: '$property must be at least 2 characters' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  name?: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(32, { message: '$property must be at most 32 characters' })
  phone?: string;
}

export class ChangePasswordDto {
  @RequiredField()
  @IsString({ message: '$property must be text' })
  currentPassword: string;

  @RequiredField()
  @IsPassword()
  newPassword: string;
}
