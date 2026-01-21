import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInputDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({
    enum: [
      'Planting Material',
      'Fertilizer',
      'Soil Amendment',
      'Tools & Equipment',
      'Training Materials',
    ],
  })
  @IsEnum([
    'Planting Material',
    'Fertilizer',
    'Soil Amendment',
    'Tools & Equipment',
    'Training Materials',
  ])
  category: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsString()
  unit: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty()
  @IsString()
  location: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['active', 'inactive', 'out_of_stock'])
  status?: string;
}
