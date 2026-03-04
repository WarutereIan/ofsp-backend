import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateSubCountyDto {
  @ApiProperty({ example: 'Kangundo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'county-uuid', description: 'County ID' })
  @IsUUID()
  countyId: string;
}
