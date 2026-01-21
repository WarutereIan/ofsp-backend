import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transportId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inputOrderId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: ['MPESA', 'BANK_TRANSFER', 'CASH', 'CREDIT'] })
  @IsEnum(['MPESA', 'BANK_TRANSFER', 'CASH', 'CREDIT'])
  method: string;

  @ApiProperty()
  @IsString()
  payerId: string;

  @ApiProperty()
  @IsString()
  payeeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
