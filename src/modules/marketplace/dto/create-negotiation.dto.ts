import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNegotiationDto {
  @ApiProperty()
  @IsString()
  listingId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  proposedPrice: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  proposedQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
