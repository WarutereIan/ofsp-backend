import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWastageEntryDto {
  @ApiProperty()
  @IsString()
  centerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inventoryItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

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

  @ApiProperty({ enum: ['SPOILAGE', 'DAMAGE', 'EXPIRED', 'OTHER'] })
  @IsEnum(['SPOILAGE', 'DAMAGE', 'EXPIRED', 'OTHER'])
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
