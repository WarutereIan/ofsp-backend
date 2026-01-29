import { IsOptional, IsString, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcounty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePicture?: string;

  // Assignment fields (for farmers, aggregation managers, and county staff)
  @ApiPropertyOptional({
    description: 'Farmer group ID (for farmers)',
  })
  @IsOptional()
  @IsString()
  farmerGroupId?: string;

  @ApiPropertyOptional({
    description: 'Aggregation center ID (for aggregation managers)',
  })
  @IsOptional()
  @IsString()
  aggregationCenterId?: string;

  @ApiPropertyOptional({
    description: 'Assigned county (for county staff)',
  })
  @IsOptional()
  @IsString()
  assignedCounty?: string;

  @ApiPropertyOptional({
    description: 'Assigned subcounty (for county staff)',
  })
  @IsOptional()
  @IsString()
  assignedSubCounty?: string;

  @ApiPropertyOptional({
    description: 'All access permission for all counties/subcounties (for county staff)',
  })
  @IsOptional()
  @IsBoolean()
  hasAllAccess?: boolean;
}
