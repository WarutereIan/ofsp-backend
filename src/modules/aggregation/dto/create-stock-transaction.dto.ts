import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStockTransactionDto {
  @ApiProperty()
  @IsString()
  centerId: string;

  @ApiProperty()
  @IsString()
  variety: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  @IsEnum(['A', 'B', 'C'])
  qualityGrade: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceCenterId?: string; // For transfers from satellite to main center

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferTransactionId?: string; // Reference to the STOCK_OUT transaction at source center

  // Grading Matrix Criteria (for quality assessment)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weightRange?: string; // small, medium, large, extra_large

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  colorIntensity?: number; // 1-10 scale

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  physicalCondition?: string; // excellent, good, fair, poor

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  freshness?: string; // very_fresh, fresh, moderate, aging

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  daysSinceHarvest?: number;
}
