import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class GenerateReportDto {
  @ApiProperty({ description: 'Report template ID' })
  @IsString()
  templateId: string;

  @ApiPropertyOptional({ description: 'Report parameters (timeRange, format, etc.)' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}
