import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateRatingDto, UpdateProfileDto } from './dto';

@ApiTags('Profiles')
@ApiBearerAuth()
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get all profiles with filters' })
  async findAll(
    @Query('role') role?: string,
    @Query('county') county?: string,
    @Query('subcounty') subcounty?: string,
    @Query('ward') ward?: string,
  ) {
    return this.profileService.findAll({ role, county, subcounty, ward });
  }

  @Get('farmers')
  @ApiOperation({ summary: 'Get all farmer profiles' })
  async findAllFarmers(
    @Query('county') county?: string,
    @Query('subcounty') subcounty?: string,
    @Query('ward') ward?: string,
  ) {
    return this.profileService.findAll({ role: 'FARMER', county, subcounty, ward });
  }

  @Get('buyers')
  @ApiOperation({ summary: 'Get all buyer profiles' })
  async findAllBuyers(
    @Query('county') county?: string,
    @Query('subcounty') subcounty?: string,
    @Query('ward') ward?: string,
  ) {
    return this.profileService.findAll({ role: 'BUYER', county, subcounty, ward });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get profile by ID' })
  async findById(@Param('id') id: string) {
    return this.profileService.findById(id);
  }

  @Get(':id/farmer')
  @ApiOperation({ summary: 'Get farmer profile' })
  async findFarmerProfile(@Param('id') id: string) {
    return this.profileService.findFarmerProfile(id);
  }

  @Get(':id/buyer')
  @ApiOperation({ summary: 'Get buyer profile' })
  async findBuyerProfile(@Param('id') id: string) {
    return this.profileService.findBuyerProfile(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update profile' })
  async update(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: any,
  ) {
    // Allow admin/staff to update any profile; others may only update their own
    const canUpdateOthers = user.role === 'ADMIN' || user.role === 'STAFF';
    if (!canUpdateOthers && user.id !== id) {
      throw new Error('Unauthorized to update this profile');
    }
    return this.profileService.update(id, updateProfileDto);
  }

  @Get(':id/ratings')
  @ApiOperation({ summary: 'Get ratings for a user' })
  async getRatings(
    @Param('id') id: string,
    @Query('minRating') minRating?: number,
    @Query('maxRating') maxRating?: number,
  ) {
    return this.profileService.getRatings({
      ratedUserId: id,
      minRating,
      maxRating,
    });
  }

  @Get(':id/ratings/summary')
  @ApiOperation({ summary: 'Get rating summary for a user' })
  async getRatingSummary(@Param('id') id: string) {
    return this.profileService.getRatingSummary(id);
  }

  @Post(':id/ratings')
  @ApiOperation({ summary: 'Create a rating' })
  async createRating(
    @Param('id') ratedUserId: string,
    @Body() createRatingDto: CreateRatingDto,
    @CurrentUser() user: any,
  ) {
    return this.profileService.createRating({
      raterUserId: user.id,
      ratedUserId,
      ...createRatingDto,
    });
  }
}
