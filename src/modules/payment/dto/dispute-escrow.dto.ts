import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DisputeEscrowDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
