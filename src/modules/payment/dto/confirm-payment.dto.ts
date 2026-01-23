import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ConfirmPaymentDto {
  @ApiProperty({ enum: ['MPESA', 'BANK_TRANSFER', 'CASH', 'CREDIT'] })
  @IsEnum(['MPESA', 'BANK_TRANSFER', 'CASH', 'CREDIT'])
  method: string;

  @ApiProperty()
  @IsString()
  transactionReference: string; // Transaction ID, M-Pesa code, reference number

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty()
  @IsDateString()
  paymentDate: string; // ISO 8601 date string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentDetails?: string; // Optional text notes about payment

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentEvidence?: string; // Image URL (receipt, screenshot, proof of payment)

  @ApiProperty()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  confirmed: boolean; // Buyer confirmation checkbox
}
