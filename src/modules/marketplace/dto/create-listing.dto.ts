import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty({ enum: ['Kenya', 'SPK004', 'Kakamega', 'Kabode', 'Other'] })
  @IsEnum(['Kenya', 'SPK004', 'Kakamega', 'Kabode', 'Other'])
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
}
