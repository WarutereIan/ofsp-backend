import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum TimeRange {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  ALL = 'all',
}

export enum TimePeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export enum EntityType {
  FARMER = 'farmer',
  BUYER = 'buyer',
  CENTER = 'center',
  TRANSPORT_PROVIDER = 'transport_provider',
  INPUT_PROVIDER = 'input_provider',
}

export class DateRangeDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  end?: string;
}

export class AnalyticsFiltersDto {
  @ApiPropertyOptional({ enum: TimeRange, description: 'Quick time range selector' })
  @IsOptional()
  @IsEnum(TimeRange)
  timeRange?: TimeRange;

  @ApiPropertyOptional({ type: DateRangeDto, description: 'Custom date range' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @ApiPropertyOptional({ enum: TimePeriod, description: 'Time period granularity' })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod;

  @ApiPropertyOptional({ description: 'Filter by specific entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ enum: EntityType, description: 'Filter by entity type' })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;
}
