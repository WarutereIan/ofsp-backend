import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateWardDto {
  @ApiProperty({ example: 'Kangundo North' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'subcounty-uuid', description: 'SubCounty ID' })
  @IsUUID()
  subCountyId: string;
}
