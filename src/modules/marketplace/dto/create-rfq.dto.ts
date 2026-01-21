import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRFQDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string; // Optional - will be auto-generated if not provided

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  quoteDeadline?: string;
}
