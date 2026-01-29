import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FarmerGroupsService } from './farmer-groups.service';
import { CreateFarmerGroupDto, UpdateFarmerGroupDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Farmer Groups')
@ApiBearerAuth()
@Controller('farmer-groups')
@UseGuards(JwtAuthGuard)
export class FarmerGroupsController {
  constructor(private farmerGroupsService: FarmerGroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Create a new farmer group' })
  @ApiResponse({ status: 201, description: 'Farmer group created successfully' })
  async create(@Body() createDto: CreateFarmerGroupDto) {
    return this.farmerGroupsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all farmer groups' })
  @ApiQuery({ name: 'county', required: false, type: String })
  @ApiQuery({ name: 'subCounty', required: false, type: String })
  @ApiQuery({ name: 'ward', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Farmer groups retrieved successfully' })
  async findAll(
    @Query('county') county?: string,
    @Query('subCounty') subCounty?: string,
    @Query('ward') ward?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.farmerGroupsService.findAll({
      county,
      subCounty,
      ward,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get farmer group by ID' })
  @ApiResponse({ status: 200, description: 'Farmer group retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Farmer group not found' })
  async findById(@Param('id') id: string) {
    return this.farmerGroupsService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Update farmer group' })
  @ApiResponse({ status: 200, description: 'Farmer group updated successfully' })
  @ApiResponse({ status: 404, description: 'Farmer group not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateFarmerGroupDto) {
    return this.farmerGroupsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Delete farmer group' })
  @ApiResponse({ status: 200, description: 'Farmer group deleted successfully' })
  @ApiResponse({ status: 404, description: 'Farmer group not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete group with members' })
  async delete(@Param('id') id: string) {
    return this.farmerGroupsService.delete(id);
  }
}
