import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateListingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'])
  variety?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  availableQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['A', 'B', 'C'])
  qualityGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  county?: string;

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
  village?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedReadyAt?: string; // ISO date string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aggregationCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quantityUnit?: string;

  @ApiPropertyOptional({
    enum: ['PENDING_LEAD_APPROVAL', 'REVISION_REQUESTED', 'ACTIVE', 'SOLD', 'INACTIVE', 'EXPIRED'],
    description: 'Farmer may set PENDING_LEAD_APPROVAL to resubmit after revision',
  })
  @IsOptional()
  @IsEnum(['PENDING_LEAD_APPROVAL', 'REVISION_REQUESTED', 'ACTIVE', 'SOLD', 'INACTIVE', 'EXPIRED', 'active', 'sold', 'inactive', 'pending'])
  status?: string;
}
