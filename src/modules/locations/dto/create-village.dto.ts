import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateVillageDto {
  @ApiProperty({ example: 'Masinga Central' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ward-uuid', description: 'Ward ID' })
  @IsUUID()
  wardId: string;
}
