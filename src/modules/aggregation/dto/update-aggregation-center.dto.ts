import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAggregationCenterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coordinates?: string;

  @ApiPropertyOptional({ enum: ['MAIN', 'SATELLITE'] })
  @IsOptional()
  @IsEnum(['MAIN', 'SATELLITE'])
  centerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mainCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerPhone?: string;

  @ApiPropertyOptional({ enum: ['OPERATIONAL', 'MAINTENANCE', 'CLOSED'] })
  @IsOptional()
  @IsEnum(['OPERATIONAL', 'MAINTENANCE', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
