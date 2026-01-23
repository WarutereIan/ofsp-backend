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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateTransportRequestDto,
  UpdateTransportRequestStatusDto,
  CreatePickupScheduleDto,
  UpdatePickupScheduleDto,
  CreatePickupSlotDto,
  BookPickupSlotDto,
  ConfirmPickupDto,
  AddTrackingUpdateDto,
} from './dto';

@ApiTags('Transport')
@ApiBearerAuth()
@Controller('transport')
@UseGuards(JwtAuthGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  // ============ Transport Requests ============

  @Get('requests')
  @ApiOperation({ summary: 'Get all transport requests' })
  async getTransportRequests(
    @Query('requesterId') requesterId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.transportService.getTransportRequests({
      requesterId,
      providerId,
      status,
      type,
    });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get transport request by ID' })
  async getTransportRequestById(@Param('id') id: string) {
    return this.transportService.getTransportRequestById(id);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create a transport request' })
  async createTransportRequest(
    @Body() createTransportRequestDto: CreateTransportRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.createTransportRequest(
      createTransportRequestDto,
      user.id,
    );
  }

  @Put('requests/:id/status')
  @ApiOperation({ summary: 'Update transport request status' })
  async updateTransportRequestStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTransportRequestStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.updateTransportRequestStatus(
      id,
      updateStatusDto,
      user.id,
    );
  }

  @Put('requests/:id/accept')
  @ApiOperation({ summary: 'Accept a transport request' })
  async acceptTransportRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.transportService.acceptTransportRequest(id, user.id);
  }

  @Put('requests/:id/reject')
  @ApiOperation({ summary: 'Reject a transport request' })
  async rejectTransportRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.transportService.updateTransportRequestStatus(
      id,
      { status: 'REJECTED' },
      user.id,
    );
  }

  // ============ Pickup Schedules ============

  @Get('pickup-schedules')
  @ApiOperation({ summary: 'Get all pickup schedules' })
  async getPickupSchedules(
    @Query('providerId') providerId?: string,
    @Query('centerId') centerId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.transportService.getPickupSchedules({
      providerId,
      centerId,
      status,
      dateFrom,
      dateTo,
    });
  }

  @Get('pickup-schedules/:id')
  @ApiOperation({ summary: 'Get pickup schedule by ID' })
  async getPickupScheduleById(@Param('id') id: string) {
    return this.transportService.getPickupScheduleById(id);
  }

  @Post('pickup-schedules')
  @ApiOperation({ summary: 'Create a pickup schedule' })
  async createPickupSchedule(
    @Body() createPickupScheduleDto: CreatePickupScheduleDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.createPickupSchedule(
      createPickupScheduleDto,
      user.id,
    );
  }

  @Put('pickup-schedules/:id')
  @ApiOperation({ summary: 'Update a pickup schedule (only DRAFT status)' })
  async updatePickupSchedule(
    @Param('id') id: string,
    @Body() updatePickupScheduleDto: UpdatePickupScheduleDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.updatePickupSchedule(
      id,
      updatePickupScheduleDto,
      user.id,
    );
  }

  @Put('pickup-schedules/:id/publish')
  @ApiOperation({ summary: 'Publish a pickup schedule' })
  async publishPickupSchedule(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.transportService.publishPickupSchedule(id, user.id);
  }

  @Put('pickup-schedules/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pickup schedule' })
  async cancelPickupSchedule(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('reason') reason?: string,
  ) {
    return this.transportService.cancelPickupSchedule(id, user.id, reason);
  }

  // ============ Pickup Slots ============

  @Get('pickup-slots')
  @ApiOperation({ summary: 'Get all pickup slots' })
  async getPickupSlots(
    @Query('scheduleId') scheduleId?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
  ) {
    return this.transportService.getPickupSlots({
      scheduleId,
      locationId,
      status,
    });
  }

  @Post('pickup-slots')
  @ApiOperation({ summary: 'Create a pickup slot' })
  async createPickupSlot(
    @Body() createPickupSlotDto: CreatePickupSlotDto,
  ) {
    return this.transportService.createPickupSlot(createPickupSlotDto);
  }

  @Post('pickup-schedules/:scheduleId/book')
  @ApiOperation({ summary: 'Book a slot within a pickup schedule (creates slot dynamically)' })
  async bookPickupSlot(
    @Param('scheduleId') scheduleId: string,
    @Body() bookPickupSlotDto: BookPickupSlotDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.bookPickupSlot(scheduleId, bookPickupSlotDto, user.id);
  }

  @Delete('pickup-slots/bookings/:id')
  @ApiOperation({ summary: 'Cancel a pickup slot booking' })
  async cancelPickupSlotBooking(
    @Param('id') bookingId: string,
    @CurrentUser() user: any,
  ) {
    return this.transportService.cancelPickupSlotBooking(bookingId, user.id);
  }

  @Post('pickup-slots/bookings/:id/confirm')
  @ApiOperation({ summary: 'Confirm pickup and create batch' })
  async confirmPickup(
    @Param('id') bookingId: string,
    @Body() confirmPickupDto: ConfirmPickupDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.confirmPickup(bookingId, confirmPickupDto, user.id);
  }

  @Get('pickup-slots/bookings')
  @ApiOperation({ summary: "Get farmer's pickup bookings" })
  async getFarmerPickupBookings(
    @Query('farmerId') farmerId: string,
    @Query('status') status?: string,
    @Query('scheduleId') scheduleId?: string,
  ) {
    return this.transportService.getFarmerPickupBookings(farmerId, {
      status,
      scheduleId,
    });
  }

  // ============ Tracking ============

  @Get('tracking/:requestId')
  @ApiOperation({ summary: 'Get tracking updates for a transport request' })
  async getTrackingUpdates(@Param('requestId') requestId: string) {
    return this.transportService.getTrackingUpdates(requestId);
  }

  @Post('tracking/:requestId')
  @ApiOperation({ summary: 'Add tracking update' })
  async addTrackingUpdate(
    @Param('requestId') requestId: string,
    @Body() addTrackingUpdateDto: AddTrackingUpdateDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.addTrackingUpdate(
      requestId,
      addTrackingUpdateDto,
      user.id,
    );
  }

  // ============ Statistics ============

  @Get('deliveries')
  @ApiOperation({ summary: 'Get active deliveries' })
  async getActiveDeliveries(
    @Query('providerId') providerId?: string,
    @Query('requesterId') requesterId?: string,
  ) {
    return this.transportService.getActiveDeliveries({
      providerId,
      requesterId,
    });
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get pickup receipt by ID' })
  async getPickupReceiptById(@Param('id') id: string) {
    return this.transportService.getPickupReceiptById(id);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Get pickup receipt by booking ID' })
  async getPickupReceiptByBookingId(@Query('bookingId') bookingId: string) {
    return this.transportService.getPickupReceiptByBookingId(bookingId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transport statistics' })
  async getTransportStats(@Query('providerId') providerId?: string) {
    return this.transportService.getTransportStats(providerId);
  }
}
