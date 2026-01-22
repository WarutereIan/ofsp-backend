import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum LeaderboardMetric {
  REVENUE = 'revenue',
  SALES = 'sales',
  ORDERS = 'orders',
  RATING = 'rating',
  QUALITY = 'quality',
}

export enum LeaderboardPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export class LeaderboardFiltersDto {
  @ApiPropertyOptional({ enum: LeaderboardMetric })
  @IsOptional()
  @IsEnum(LeaderboardMetric)
  metric?: LeaderboardMetric;

  @ApiPropertyOptional({ enum: LeaderboardPeriod })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period?: LeaderboardPeriod;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by sub-county' })
  @IsOptional()
  @IsString()
  subcounty?: string;

  @ApiPropertyOptional({ description: 'Filter by county' })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional({ description: 'Include user rank even if not in top N' })
  @IsOptional()
  @IsString()
  userId?: string;
}
