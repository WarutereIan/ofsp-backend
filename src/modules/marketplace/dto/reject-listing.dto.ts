import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectListingDto {
  @ApiPropertyOptional({ description: 'Comments on what needs correction' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
