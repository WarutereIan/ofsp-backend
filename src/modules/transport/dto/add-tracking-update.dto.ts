import { IsString, IsEnum, IsOptional } from 'class-validator';
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
}
