import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiProperty()
  @IsString()
  farmerId: string;

  @ApiProperty({ enum: ['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'] })
  @IsEnum(['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'])
  variety: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  @IsEnum(['A', 'B', 'C'])
  qualityGrade: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rfqResponseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierOfferId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  negotiationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryCounty?: string;

  @ApiPropertyOptional({ enum: ['self_pickup', 'request_transport'], default: 'self_pickup' })
  @IsOptional()
  @IsEnum(['self_pickup', 'request_transport'])
  fulfillmentType?: 'self_pickup' | 'request_transport';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryCoordinates?: string;
}
