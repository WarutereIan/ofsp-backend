import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

class CreateProfileDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'Nairobi', required: false })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({ example: 'Nairobi', required: false })
  @IsOptional()
  @IsString()
  subcounty?: string;

  @ApiProperty({ example: 'Dagoretti North', required: false })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ example: 'farmer-group-id', required: false, description: 'Farmer group ID (optional for farmers)' })
  @IsOptional()
  @IsString()
  farmerGroupId?: string;

  @ApiProperty({ example: 'aggregation-center-id', required: false, description: 'Aggregation center ID (mandatory for aggregation managers)' })
  @IsOptional()
  @IsString()
  aggregationCenterId?: string;

  @ApiProperty({ example: 'Machakos', required: false, description: 'Assigned county (for county staff)' })
  @IsOptional()
  @IsString()
  assignedCounty?: string;

  @ApiProperty({ 
    example: 'Kangundo', 
    required: false, 
    description: 'Assigned subcounty (for county staff). Valid subcounties: Kangundo, Kathiani, Masinga, Yatta' 
  })
  @IsOptional()
  @IsString()
  assignedSubCounty?: string;

  @ApiProperty({ example: false, required: false, description: 'All access permission for all counties/subcounties (for county staff)' })
  @IsOptional()
  hasAllAccess?: boolean;
}

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', required: false })
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+254712345678' })
  @IsPhoneNumber('KE')
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({ type: CreateProfileDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CreateProfileDto)
  profile: CreateProfileDto;
}
