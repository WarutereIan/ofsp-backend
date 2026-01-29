import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for Africa's Talking USSD webhook payload.
 * See: https://developers.africastalking.com/docs/ussd
 */
export class UssdRequestDto {
  @IsString()
  sessionId: string;

  @IsString()
  serviceCode: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  networkCode?: string;
}

