import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTrackingUpdateDto {
  @ApiProperty()
  @IsString()
  location: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coordinates?: string;

  @ApiProperty({
    enum: ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  })
  @IsEnum(['PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  timestamp?: string; // ISO 8601 timestamp when location was captured
}
