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
import { LocationsService } from './locations.service';
import {
  CreateCountyDto,
  UpdateCountyDto,
  CreateSubCountyDto,
  UpdateSubCountyDto,
  CreateWardDto,
  UpdateWardDto,
  CreateVillageDto,
  UpdateVillageDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ---------- Counties ----------
  @Post('counties')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Create a county (staff only)' })
  @ApiResponse({ status: 201, description: 'County created' })
  createCounty(@Body() dto: CreateCountyDto) {
    return this.locationsService.createCounty(dto);
  }

  @Get('counties')
  @ApiOperation({ summary: 'List all counties (for dropdowns and analytics)' })
  @ApiResponse({ status: 200, description: 'List of counties' })
  findAllCounties() {
    return this.locationsService.findAllCounties();
  }

  @Get('counties/:id')
  @ApiOperation({ summary: 'Get county by ID with sub-counties' })
  findCountyById(@Param('id') id: string) {
    return this.locationsService.findCountyById(id);
  }

  @Put('counties/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Update a county (staff only)' })
  updateCounty(@Param('id') id: string, @Body() dto: UpdateCountyDto) {
    return this.locationsService.updateCounty(id, dto);
  }

  @Delete('counties/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Delete a county (staff only)' })
  deleteCounty(@Param('id') id: string) {
    return this.locationsService.deleteCounty(id);
  }

  // ---------- SubCounties ----------
  @Post('subcounties')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Create a sub-county (staff only)' })
  @ApiResponse({ status: 201, description: 'SubCounty created' })
  createSubCounty(@Body() dto: CreateSubCountyDto) {
    return this.locationsService.createSubCounty(dto);
  }

  @Get('subcounties')
  @ApiOperation({ summary: 'List sub-counties, optionally by county' })
  @ApiQuery({ name: 'countyId', required: false, type: String, description: 'County ID (omit for all)' })
  @ApiResponse({ status: 200, description: 'List of sub-counties' })
  findSubCounties(@Query('countyId') countyId?: string) {
    return this.locationsService.findSubCountiesByCountyId(countyId);
  }

  @Get('subcounties/:id')
  @ApiOperation({ summary: 'Get sub-county by ID with wards' })
  findSubCountyById(@Param('id') id: string) {
    return this.locationsService.findSubCountyById(id);
  }

  @Put('subcounties/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Update a sub-county (staff only)' })
  updateSubCounty(@Param('id') id: string, @Body() dto: UpdateSubCountyDto) {
    return this.locationsService.updateSubCounty(id, dto);
  }

  @Delete('subcounties/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Delete a sub-county (staff only)' })
  deleteSubCounty(@Param('id') id: string) {
    return this.locationsService.deleteSubCounty(id);
  }

  // ---------- Wards ----------
  @Post('wards')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Create a ward (staff only)' })
  @ApiResponse({ status: 201, description: 'Ward created' })
  createWard(@Body() dto: CreateWardDto) {
    return this.locationsService.createWard(dto);
  }

  @Get('wards')
  @ApiOperation({ summary: 'List wards, optionally by sub-county' })
  @ApiQuery({ name: 'subCountyId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of wards' })
  findWards(@Query('subCountyId') subCountyId?: string) {
    return this.locationsService.findWardsBySubCountyId(subCountyId);
  }

  @Get('wards/:id')
  @ApiOperation({ summary: 'Get ward by ID with villages' })
  findWardById(@Param('id') id: string) {
    return this.locationsService.findWardById(id);
  }

  @Put('wards/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Update a ward (staff only)' })
  updateWard(@Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.locationsService.updateWard(id, dto);
  }

  @Delete('wards/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Delete a ward (staff only)' })
  deleteWard(@Param('id') id: string) {
    return this.locationsService.deleteWard(id);
  }

  // ---------- Villages ----------
  @Post('villages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Create a village (staff only)' })
  @ApiResponse({ status: 201, description: 'Village created' })
  createVillage(@Body() dto: CreateVillageDto) {
    return this.locationsService.createVillage(dto);
  }

  @Get('villages')
  @ApiOperation({ summary: 'List villages by ward' })
  @ApiQuery({ name: 'wardId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of villages' })
  findVillages(@Query('wardId') wardId?: string) {
    return this.locationsService.findVillagesByWardId(wardId);
  }

  @Get('villages/:id')
  @ApiOperation({ summary: 'Get village by ID' })
  findVillageById(@Param('id') id: string) {
    return this.locationsService.findVillageById(id);
  }

  @Put('villages/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Update a village (staff only)' })
  updateVillage(@Param('id') id: string, @Body() dto: UpdateVillageDto) {
    return this.locationsService.updateVillage(id, dto);
  }

  @Delete('villages/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Delete a village (staff only)' })
  deleteVillage(@Param('id') id: string) {
    return this.locationsService.deleteVillage(id);
  }
}
