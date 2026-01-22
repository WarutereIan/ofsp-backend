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
import { Type } from 'class-transformer';

class ProfileDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'Nairobi' })
  @IsString()
  @IsNotEmpty()
  county: string;

  @ApiProperty({ example: 'Dagoretti North', required: false })
  @IsOptional()
  @IsString()
  ward?: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+254712345678' })
  @IsPhoneNumber('KE')
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ enum: ['FARMER', 'BUYER', 'TRANSPORT_PROVIDER', 'AGGREGATION_MANAGER', 'INPUT_PROVIDER', 'EXTENSION_OFFICER'] })
  @IsEnum(['FARMER', 'BUYER', 'TRANSPORT_PROVIDER', 'AGGREGATION_MANAGER', 'INPUT_PROVIDER', 'EXTENSION_OFFICER'])
  @IsNotEmpty()
  role: string;

  @ApiProperty({ type: ProfileDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ProfileDto)
  profile: ProfileDto;
}
