import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ConfirmPaymentByFarmerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmationNotes?: string; // Optional notes from farmer about payment receipt

  @ApiProperty()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  confirmed: boolean; // Farmer confirmation checkbox
}
