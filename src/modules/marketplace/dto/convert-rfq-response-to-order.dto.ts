import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConvertRFQResponseToOrderDto {
  @ApiPropertyOptional({ description: 'Delivery address for the order' })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: 'Delivery county for the order' })
  @IsOptional()
  @IsString()
  deliveryCounty?: string;
}
