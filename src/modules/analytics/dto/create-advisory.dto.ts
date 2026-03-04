import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsArray } from 'class-validator';

export type AdvisoryTargetAudience = 'all' | 'sub_county' | 'farmer_group' | 'individual';

export class CreateAdvisoryDto {
  @ApiProperty({ example: 'Harvest timing reminder' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Optimal harvest window for OFSP in your area is next 2 weeks. Store in cool, dry place.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ['QUALITY', 'PRICING', 'STORAGE', 'HARVESTING', 'MARKETING', 'GENERAL'], default: 'GENERAL' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'quality' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({
    description: 'Who receives the advisory',
    enum: ['all', 'sub_county', 'farmer_group', 'individual'],
  })
  @IsIn(['all', 'sub_county', 'farmer_group', 'individual'])
  targetAudience: AdvisoryTargetAudience;

  @ApiPropertyOptional({
    description: 'Sub-county name/slug, farmer group id/name, or user id/phone for individual',
  })
  @IsOptional()
  @IsString()
  targetValue?: string;
}
