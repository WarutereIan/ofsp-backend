import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { VALID_SUBCOUNTIES } from '../../../common/constants/locations';

export class UpdateFarmerGroupDto {
  @ApiProperty({ example: 'Kangundo Farmers Cooperative', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Kangundo North Ward', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Machakos', required: false })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({ 
    example: 'Kangundo',
    enum: VALID_SUBCOUNTIES,
    required: false,
    description: 'Valid subcounties: ' + VALID_SUBCOUNTIES.join(', ')
  })
  @IsOptional()
  @IsString()
  @IsIn(VALID_SUBCOUNTIES, { message: `Subcounty must be one of: ${VALID_SUBCOUNTIES.join(', ')}` })
  subCounty?: string;

  @ApiProperty({ example: 'Kangundo North', required: false, description: 'Ward assignment is optional' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
