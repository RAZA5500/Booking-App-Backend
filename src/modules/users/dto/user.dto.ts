import { IsBoolean, IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { IsPassword, OptionalField, RequiredField } from '../../../common/validation';
import { ROLES } from '../../../config/configuration';
import type { Role } from '../../../types/models';

const ROLE_VALUES = Object.values(ROLES);
const ROLE_MESSAGE = `$property must be one of: ${ROLE_VALUES.join(', ')}`;

export class CreateUserDto {
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

  @RequiredField()
  @IsIn(ROLE_VALUES, { message: ROLE_MESSAGE })
  role: Role;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  hotelId?: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(32, { message: '$property must be at most 32 characters' })
  phone?: string;
}

export class UpdateUserDto {
  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MinLength(2, { message: '$property must be at least 2 characters' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  name?: string;

  @OptionalField()
  @IsIn(ROLE_VALUES, { message: ROLE_MESSAGE })
  role?: Role;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(32, { message: '$property must be at most 32 characters' })
  phone?: string;

  @OptionalField()
  @IsBoolean({ message: '$property must be true or false' })
  active?: boolean;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  hotelId?: string;
}

export class ResetPasswordDto {
  @RequiredField()
  @IsPassword()
  password: string;
}

export interface UserListQuery {
  role?: string;
  q?: string;
  active?: string;
  page?: string;
  limit?: string;
}
