import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAggregationCenterDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiProperty()
  @IsString()
  county: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty()
  @IsString()
  coordinates: string; // lat,lng

  @ApiProperty({ enum: ['MAIN', 'SATELLITE'] })
  @IsEnum(['MAIN', 'SATELLITE'])
  centerType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mainCenterId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalCapacity: number;

  @ApiProperty()
  @IsString()
  managerId: string;

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
}
