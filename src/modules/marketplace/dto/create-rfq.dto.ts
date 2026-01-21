import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRFQDto {
  @ApiProperty({ enum: ['Kenya', 'SPK004', 'Kakamega', 'Kabode', 'Other'] })
  @IsEnum(['Kenya', 'SPK004', 'Kakamega', 'Kabode', 'Other'])
  variety: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

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
