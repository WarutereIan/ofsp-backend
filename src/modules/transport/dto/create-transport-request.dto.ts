import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransportRequestDto {
  @ApiProperty({
    enum: ['MARKETPLACE_ORDER', 'INPUT_ORDER', 'PICKUP', 'DELIVERY'],
  })
  @IsEnum(['MARKETPLACE_ORDER', 'INPUT_ORDER', 'PICKUP', 'DELIVERY'])
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requesterType?: string;

  @ApiProperty()
  @IsString()
  pickupLocation: string;

  @ApiProperty()
  @IsString()
  pickupCounty: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupCoordinates?: string;

  @ApiProperty()
  @IsString()
  deliveryLocation: string;

  @ApiProperty()
  @IsString()
  deliveryCounty: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryCoordinates?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  distance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requestedPickupDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inputOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupScheduleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupSlotId?: string;
}
