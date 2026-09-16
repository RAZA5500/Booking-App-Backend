import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OptionalField, RequiredField } from '../../../common/validation';

export const HOTEL_CATEGORIES = ['luxury', 'resort', 'boutique', 'city', 'lodge'] as const;

export class CreateHotelDto {
  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MinLength(2, { message: '$property must be at least 2 characters' })
  @MaxLength(120, { message: '$property must be at most 120 characters' })
  name: string;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  city: string;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  country: string;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MaxLength(40, { message: '$property must be at most 40 characters' })
  continent: string;

  @RequiredField()
  @IsIn(HOTEL_CATEGORIES, { message: `$property must be one of: ${HOTEL_CATEGORIES.join(', ')}` })
  category: string;

  @RequiredField()
  @Type(() => Number)
  @IsInt({ message: '$property must be a whole number' })
  @Min(1, { message: '$property must be at least 1' })
  @Max(5, { message: '$property must be at most 5' })
  starRating: number;

  @RequiredField()
  @Type(() => Number)
  @IsNumber({}, { message: '$property must be a number' })
  @Min(20, { message: '$property must be at least 20' })
  basePrice: number;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MinLength(20, { message: '$property must be at least 20 characters' })
  @MaxLength(800, { message: '$property must be at most 800 characters' })
  description: string;

  @OptionalField()
  @IsArray({ message: '$property must be a list' })
  highlights?: string[];

  @OptionalField()
  @IsArray({ message: '$property must be a list' })
  tags?: string[];

  @OptionalField()
  @IsArray({ message: '$property must be a list' })
  amenities?: string[];

  @OptionalField()
  @IsBoolean({ message: '$property must be true or false' })
  featured?: boolean;
}

/**
 * Every field is optional — this doubles as the allow-list, so anything the
 * client invents (ids, ratings, room inventory) is dropped by the whitelisting
 * validation pipe rather than written into the record.
 */
export class UpdateHotelDto {
  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MinLength(2, { message: '$property must be at least 2 characters' })
  @MaxLength(120, { message: '$property must be at most 120 characters' })
  name?: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  city?: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  country?: string;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MaxLength(40, { message: '$property must be at most 40 characters' })
  continent?: string;

  @OptionalField()
  @IsIn(HOTEL_CATEGORIES, { message: `$property must be one of: ${HOTEL_CATEGORIES.join(', ')}` })
  category?: string;

  @OptionalField()
  @Type(() => Number)
  @IsInt({ message: '$property must be a whole number' })
  @Min(1, { message: '$property must be at least 1' })
  @Max(5, { message: '$property must be at most 5' })
  starRating?: number;

  @OptionalField()
  @Type(() => Number)
  @IsNumber({}, { message: '$property must be a number' })
  @Min(20, { message: '$property must be at least 20' })
  basePrice?: number;

  @OptionalField()
  @IsString({ message: '$property must be text' })
  @MinLength(20, { message: '$property must be at least 20 characters' })
  @MaxLength(800, { message: '$property must be at most 800 characters' })
  description?: string;

  @OptionalField()
  @IsArray({ message: '$property must be a list' })
  highlights?: string[];

  @OptionalField()
  @IsArray({ message: '$property must be a list' })
  tags?: string[];

  @OptionalField()
  @IsArray({ message: '$property must be a list' })
  amenities?: string[];

  @OptionalField()
  @IsArray({ message: '$property must be a list' })
  images?: string[];

  @OptionalField()
  @IsObject({ message: '$property must be an object' })
  policies?: Record<string, string>;

  @OptionalField()
  @IsBoolean({ message: '$property must be true or false' })
  featured?: boolean;

  @OptionalField()
  @IsBoolean({ message: '$property must be true or false' })
  active?: boolean;
}

export class CreateReviewDto {
  @RequiredField()
  @Type(() => Number)
  @IsInt({ message: '$property must be a whole number' })
  @Min(1, { message: '$property must be at least 1' })
  @Max(5, { message: '$property must be at most 5' })
  rating: number;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MaxLength(80, { message: '$property must be at most 80 characters' })
  title: string;

  @RequiredField()
  @IsString({ message: '$property must be text' })
  @MinLength(10, { message: '$property must be at least 10 characters' })
  @MaxLength(800, { message: '$property must be at most 800 characters' })
  comment: string;
}

export interface HotelListQuery {
  q?: string;
  continent?: string;
  country?: string;
  category?: string;
  stars?: string;
  amenities?: string;
  minPrice?: string;
  maxPrice?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  sort?: string;
  page?: string;
  limit?: string;
  featured?: string;
}

export interface HotelDetailQuery {
  checkIn?: string;
  checkOut?: string;
  guests?: string;
}
