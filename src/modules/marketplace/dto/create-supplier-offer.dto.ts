import { IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourcingRequestId?: string; // Optional - comes from path parameter

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsString()
  quantityUnit: string; // "kg" | "tons" | "units"

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualityGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;
}
