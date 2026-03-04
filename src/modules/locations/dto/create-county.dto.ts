import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCountyDto {
  @ApiProperty({ example: 'Machakos' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MCK', required: false })
  @IsOptional()
  @IsString()
  code?: string;
}
