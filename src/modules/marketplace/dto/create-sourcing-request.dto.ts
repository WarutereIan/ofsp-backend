import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSourcingRequestDto {
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

  @ApiProperty()
  @IsString()
  deliveryLocation: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
