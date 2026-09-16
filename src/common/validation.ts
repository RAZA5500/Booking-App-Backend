import { ValidationPipe, ValidationPipeOptions, applyDecorators } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { IsNotEmpty, IsString, Matches, MinLength, ValidateIf } from 'class-validator';
import { ApiException } from './api-exception';

/**
 * Marks a field the client may leave out. An empty string counts as "left out"
 * too, because the forms on the client submit `''` for untouched inputs.
 */
export const OptionalField = () =>
  applyDecorators(
    ValidateIf((_object, value) => value !== undefined && value !== null && value !== ''),
  );

/** The counterpart: present, and not blank. */
export const RequiredField = () =>
  applyDecorators(IsNotEmpty({ message: '$property is required' }));

/** The password policy, shared by registration, reset and change-password. */
export const IsPassword = () =>
  applyDecorators(
    IsString({ message: '$property must be text' }),
    MinLength(8, { message: '$property must be at least 8 characters' }),
    Matches(/(?=.*[a-z])(?=.*[A-Z])/, {
      message: '$property must include an upper and lower case letter',
    }),
    Matches(/\d/, { message: '$property must include a number' }),
  );

/**
 * Flattens class-validator's tree into `{ field: 'first failure' }` — the shape
 * the client maps onto its form inputs. A missing value reports as "required"
 * rather than whichever type rule happened to fire alongside it.
 */
const collect = (errors: ValidationError[], prefix = ''): Record<string, string> => {
  const details: Record<string, string> = {};

  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const constraints = error.constraints || {};
    const messages = Object.values(constraints);

    if (constraints.isNotEmpty) {
      details[path] = constraints.isNotEmpty;
    } else if (messages.length > 0) {
      details[path] = messages[0];
    } else if (error.children?.length) {
      Object.assign(details, collect(error.children, path));
    }
  }

  return details;
};

export const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  transform: true,
  // Query strings and route params arrive as plain objects rather than DTO
  // classes, which keeps the permissive search/filter behaviour intact.
  exceptionFactory: (errors: ValidationError[]) =>
    ApiException.badRequest('Some fields need your attention.', collect(errors)),
};

export const buildValidationPipe = () => new ValidationPipe(validationPipeOptions);
