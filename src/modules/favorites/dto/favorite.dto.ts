import { IsString } from 'class-validator';
import { RequiredField } from '../../../common/validation';

export class AddFavoriteDto {
  @RequiredField()
  @IsString({ message: '$property must be text' })
  hotelId: string;
}
