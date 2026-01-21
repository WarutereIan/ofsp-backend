import { IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierOfferDto {
  @ApiProperty()
  @IsString()
  sourcingRequestId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;
}
