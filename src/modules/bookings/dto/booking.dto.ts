import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { OptionalField, RequiredField } from '../../../common/validation';
import { BOOKING_STATUS } from '../../../config/configuration';
import type { BookingStatusValue } from '../../../types/models';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = '$property must be a date (YYYY-MM-DD)';

const STATUSES = Object.values(BOOKING_STATUS);

export class CreateBookingDto {
  @RequiredField()
  @IsString({ message: '$property must be text' })
  hotelId: string;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  roomId: string;

  @RequiredField()
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  checkIn: string;

  @RequiredField()
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  checkOut: string;

  @RequiredField()
  @Type(() => Number)
  @IsInt({ message: '$property must be a whole number' })
  @Min(1, { message: '$property must be at least 1' })
  @Max(10, { message: '$property must be at most 10' })
  guests: number;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MinLength(2, { message: '$property must be at least 2 characters' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  guestName: string;

  @RequiredField()
  @IsEmail({}, { message: '$property must be a valid email address' })
  guestEmail: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(32, { message: '$property must be at most 32 characters' })
  guestPhone?: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(400, { message: '$property must be at most 400 characters' })
  note?: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(4, { message: '$property must be at most 4 characters' })
  paymentLast4?: string;
}

export class UpdateBookingDto {
  @OptionalField()
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  checkIn?: string;

  @OptionalField()
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  checkOut?: string;

  @OptionalField()
  @Type(() => Number)
  @IsInt({ message: '$property must be a whole number' })
  @Min(1, { message: '$property must be at least 1' })
  @Max(10, { message: '$property must be at most 10' })
  guests?: number;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(400, { message: '$property must be at most 400 characters' })
  note?: string;
}

export class UpdateBookingStatusDto {
  @RequiredField()
  @IsIn(STATUSES, { message: `$property must be one of: ${STATUSES.join(', ')}` })
  status: BookingStatusValue;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(300, { message: '$property must be at most 300 characters' })
  note?: string;
}

export class CancelBookingDto {
  @OptionalField()
  @IsString({ message: '$property must be text' })
  reason?: string;
}

export interface QuoteQuery {
  hotelId?: string;
  roomId?: string;
  checkIn?: string;
  checkOut?: string;
}

export interface BookingListQuery {
  status?: string;
  hotelId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
  scope?: string;
}
