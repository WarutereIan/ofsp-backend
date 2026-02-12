import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty({ enum: ['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'] })
  @IsEnum(['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'])
  variety: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  @IsEnum(['A', 'B', 'C'])
  qualityGrade: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @ApiProperty()
  @IsString()
  county: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcounty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  harvestDate?: string; // ISO date string

  @ApiPropertyOptional({ description: 'Expected date/time when commodity will be ready at aggregation centre' })
  @IsOptional()
  @IsString()
  expectedReadyAt?: string; // ISO date string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  village?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aggregationCenterId?: string;

  @ApiPropertyOptional({ description: 'Unit of measure', default: "kg" })
  @IsOptional()
  @IsString()
  quantityUnit?: string;
}
