import { IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRFQResponseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rfqId?: string; // Optional - comes from path parameter

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiProperty({ description: 'Batch ID - required for traceability and aggregation center association' })
  @IsString()
  batchId: string; // Required - batch selection is mandatory
}
