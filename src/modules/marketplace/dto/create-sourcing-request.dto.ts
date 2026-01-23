import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateSourcingRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string; // Optional - will be auto-generated if not provided

  /** When true, create as OPEN (published) instead of DRAFT. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  publishImmediately?: boolean;

  @ApiProperty({ enum: ['FRESH_ROOTS', 'PROCESS_GRADE', 'PLANTING_VINES', 'OFSP'] })
  @IsEnum(['FRESH_ROOTS', 'PROCESS_GRADE', 'PLANTING_VINES', 'OFSP'])
  productType: string;

  @ApiProperty({ enum: ['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'] })
  @IsEnum(['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'])
  variety: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEnum(['kg', 'tons', 'units'])
  unit?: string; // Optional - defaults to 'kg'

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  @IsEnum(['A', 'B', 'C'])
  qualityGrade: string;

  @ApiProperty()
  @IsDateString()
  deliveryDate: string;

  @ApiProperty()
  @IsString()
  deliveryLocation: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceRangeMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceRangeMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerUnit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEnum(['kg', 'unit'])
  priceUnit?: string;
}
