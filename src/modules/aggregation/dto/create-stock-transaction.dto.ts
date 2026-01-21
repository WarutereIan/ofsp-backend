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
}
