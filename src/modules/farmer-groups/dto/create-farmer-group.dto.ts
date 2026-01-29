import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { VALID_SUBCOUNTIES } from '../../../common/constants/locations';

export class CreateFarmerGroupDto {
  @ApiProperty({ example: 'Kangundo Farmers Cooperative' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Kangundo North Ward', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Machakos' })
  @IsString()
  @IsNotEmpty()
  county: string;

  @ApiProperty({ 
    example: 'Kangundo',
    enum: VALID_SUBCOUNTIES,
    description: 'Valid subcounties: ' + VALID_SUBCOUNTIES.join(', ')
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_SUBCOUNTIES, { message: `Subcounty must be one of: ${VALID_SUBCOUNTIES.join(', ')}` })
  subCounty: string;

  @ApiProperty({ example: 'Kangundo North', required: false, description: 'Ward assignment is optional' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
