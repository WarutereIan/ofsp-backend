import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
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
import { generateBatchTraceability } from '../../common/utils/traceability.util';

@Injectable()
export class TransportService {
  constructor(
    private prisma: PrismaService,
    private notificationHelperService: NotificationHelperService,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => MarketplaceService))
    private marketplaceService: MarketplaceService,
  ) {}

  // ============ Transport Requests ============

  async getTransportRequests(filters?: {
    requesterId?: string;
    providerId?: string;
    status?: string;
    type?: string;
  }) {
    const where: any = {};

    if (filters?.requesterId) {
      where.requesterId = filters.requesterId;
    }
    if (filters?.providerId) {
      where.providerId = filters.providerId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.type) {
      where.type = filters.type;
    }

    return this.prisma.transportRequest.findMany({
      where,
      include: {
        requester: {
          include: {
            profile: true,
          },
        },
        provider: {
          include: {
            profile: true,
          },
        },
        order: true,
        pickupSchedule: true,
        pickupSlot: true,
        trackingUpdates: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransportRequestById(id: string) {
    const request = await this.prisma.transportRequest.findUnique({
      where: { id },
      include: {
        requester: {
          include: {
            profile: true,
          },
        },
        provider: {
          include: {
            profile: true,
          },
        },
        order: true,
        pickupSchedule: true,
        pickupSlot: true,
        trackingUpdates: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Transport Request with ID ${id} not found`);
    }

    return request;
  }

  async createTransportRequest(data: CreateTransportRequestDto, requesterId: string) {
    // Generate request number
    const requestNumber = await this.prisma.$queryRaw<Array<{ generate_transport_request_number: string }>>`
      SELECT generate_transport_request_number() as generate_transport_request_number
    `;

    const request = await this.prisma.transportRequest.create({
      data: {
        requesterId,
        requestNumber: requestNumber[0].generate_transport_request_number,
        type: data.type as any,
        description: data.description,
        requesterType: data.requesterType || 'farmer',
        pickupLocation: data.pickupLocation,
        pickupCounty: data.pickupCounty,
        pickupCoords: data.pickupCoordinates,
        deliveryLocation: data.deliveryLocation,
        deliveryCounty: data.deliveryCounty,
        deliveryCoords: data.deliveryCoordinates,
        distance: data.distance,
        cargoDescription: data.description || 'Transport request',
        estimatedWeight: data.weight || 0,
        scheduledPickup: data.requestedPickupDate ? new Date(data.requestedPickupDate) : null,
        scheduledDelivery: data.requestedDeliveryDate ? new Date(data.requestedDeliveryDate) : null,
        orderId: data.orderId,
        pickupScheduleId: data.pickupScheduleId,
        pickupSlotId: data.pickupSlotId,
      },
      include: {
        requester: {
          include: {
            profile: true,
          },
        },
        order: true,
      },
    });

    // Create activity log
    await this.activityLogService.logTransportCreated(request, requesterId);

    return request;
  }

  async updateTransportRequestStatus(
    id: string,
    data: UpdateTransportRequestStatusDto,
    userId: string,
  ) {
    const request = await this.getTransportRequestById(id);
    const oldStatus = request.status;
    const newStatus = data.status;

    // Verify user has permission
    // Allow: requester or assigned provider
    const isRequester = request.requesterId === userId;
    const isAssignedProvider = request.providerId === userId;
    
    // If no provider assigned yet, only requester can update (except for accept action which is handled separately)
    if (!request.providerId && !isRequester) {
      throw new BadRequestException('Only the requester can update unassigned transport requests');
    }
    
    // If provider is assigned, only requester or assigned provider can update
    if (request.providerId && !isRequester && !isAssignedProvider) {
      throw new BadRequestException('You can only update your own transport requests');
    }

    const updateData: any = {
      status: newStatus as any,
      ...(data.providerId && { providerId: data.providerId }),
    };

    // Set timestamps based on status
    if ((newStatus === 'IN_TRANSIT_PICKUP' || newStatus === 'IN_TRANSIT_DELIVERY') && 
        oldStatus !== 'IN_TRANSIT_PICKUP' && oldStatus !== 'IN_TRANSIT_DELIVERY') {
      updateData.actualPickup = new Date();
    }
    if (newStatus === 'DELIVERED' && oldStatus !== 'DELIVERED') {
      updateData.actualDelivery = new Date();
    }

    const updatedRequest = await this.prisma.transportRequest.update({
      where: { id },
      data: updateData,
      include: {
        requester: {
          include: {
            profile: true,
          },
        },
        provider: {
          include: {
            profile: true,
          },
        },
        order: true,
      },
    });

    // Update marketplace order status if transport is linked to an order
    if (request.orderId && request.type === 'PRODUCE_PICKUP') {
      try {
        if (newStatus === 'ACCEPTED' && oldStatus === 'PENDING') {
          // Transport accepted - order can move to IN_TRANSIT when pickup happens
        } else if ((newStatus === 'IN_TRANSIT_PICKUP' || newStatus === 'IN_TRANSIT_DELIVERY') && 
                   oldStatus !== 'IN_TRANSIT_PICKUP' && oldStatus !== 'IN_TRANSIT_DELIVERY') {
          await this.marketplaceService.updateOrderStatus(
            request.orderId,
            { status: 'IN_TRANSIT' },
            userId,
          );
        }
      } catch (error) {
        console.error('Failed to update order status:', error);
      }
    }
    
    // Update order status when delivery is completed
    if (request.orderId && request.type === 'PRODUCE_DELIVERY') {
      try {
        if (newStatus === 'DELIVERED' && oldStatus !== 'DELIVERED') {
          await this.marketplaceService.updateOrderStatus(
            request.orderId,
            { status: 'DELIVERED' },
            userId,
          );
        }
      } catch (error) {
        console.error('Failed to update order status for PRODUCE_DELIVERY:', error);
        // Don't re-throw - allow transport status to update even if order status update fails
        // This prevents transport delivery from being blocked by order status validation issues
      }
    }

    // Create notifications
    if (request.requesterId) {
      await this.notificationHelperService.createNotification({
        userId: request.requesterId,
        type: 'TRANSPORT',
        title: `Transport Request ${newStatus}`,
        message: `Transport request #${request.requestNumber} status updated to ${newStatus}`,
        priority: ['DELIVERED', 'CANCELLED'].includes(newStatus) ? 'HIGH' : 'MEDIUM',
        entityType: 'TRANSPORT',
        entityId: request.id,
        actionUrl: `/transport/${request.id}`,
        actionLabel: 'View Request',
        metadata: { requestNumber: request.requestNumber, status: newStatus },
      });
    }

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'TRANSPORT_STATUS_CHANGED',
      entityType: 'TRANSPORT',
      entityId: request.id,
      metadata: {
        requestNumber: request.requestNumber,
        oldStatus,
        newStatus,
        orderId: request.orderId,
      },
    });

    return updatedRequest;
  }

  async acceptTransportRequest(id: string, providerId: string) {
    const request = await this.getTransportRequestById(id);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be accepted');
    }

    const updatedRequest = await this.prisma.transportRequest.update({
      where: { id },
      data: {
        providerId,
        status: 'ACCEPTED',
      },
      include: {
        requester: {
          include: {
            profile: true,
          },
        },
        provider: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create notifications for requester and provider
    await this.notificationHelperService.createNotifications([
      {
        userId: request.requesterId,
        type: 'TRANSPORT',
        title: 'Transport Request Accepted',
        message: `Transport request #${request.requestNumber} has been accepted by a provider`,
        priority: 'HIGH',
        entityType: 'TRANSPORT',
        entityId: request.id,
        actionUrl: `/transport/${request.id}`,
        actionLabel: 'View Request',
        metadata: { requestNumber: request.requestNumber, providerId },
      },
      {
        userId: providerId,
        type: 'TRANSPORT',
        title: 'Transport Request Accepted',
        message: `You have accepted transport request #${request.requestNumber}`,
        priority: 'MEDIUM',
        entityType: 'TRANSPORT',
        entityId: request.id,
        actionUrl: `/transport/${request.id}`,
        actionLabel: 'View Request',
        metadata: { requestNumber: request.requestNumber },
      },
    ]);

    return updatedRequest;
  }

  // ============ Pickup Schedules ============

  async getPickupSchedules(filters?: {
    providerId?: string;
    centerId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};

    if (filters?.providerId) {
      where.providerId = filters.providerId;
    }
    if (filters?.centerId) {
      where.aggregationCenterId = filters.centerId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.scheduledDate = {};
      if (filters.dateFrom) {
        where.scheduledDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.scheduledDate.lte = new Date(filters.dateTo);
      }
    }

    return this.prisma.farmPickupSchedule.findMany({
      where,
      include: {
        aggregationCenter: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async getPickupScheduleById(id: string) {
    const schedule = await this.prisma.farmPickupSchedule.findUnique({
      where: { id },
      include: {
        aggregationCenter: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Pickup Schedule with ID ${id} not found`);
    }

    return schedule;
  }

  async createPickupSchedule(data: CreatePickupScheduleDto, providerId: string) {
    // Generate schedule number
    const scheduleNumber = await this.prisma.$queryRaw<Array<{ generate_pickup_schedule_number: string }>>`
      SELECT generate_pickup_schedule_number() as generate_pickup_schedule_number
    `;

    return this.prisma.farmPickupSchedule.create({
      data: {
        providerId,
        aggregationCenterId: data.aggregationCenterId,
        scheduleNumber: scheduleNumber[0].generate_pickup_schedule_number,
        route: data.route,
        scheduledDate: new Date(data.scheduledDate),
        scheduledTime: data.scheduledTime,
        totalCapacity: data.totalCapacity,
        vehicleId: data.vehicleId,
        vehicleType: data.vehicleType,
        driverId: data.driverId,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        pricePerKg: data.pricePerKg,
        fixedPrice: data.fixedPrice,
        notes: data.notes,
        availableCapacity: data.totalCapacity, // Initially same as total capacity
      },
      include: {
        aggregationCenter: true,
      },
    });
  }

  async updatePickupSchedule(
    id: string,
    data: UpdatePickupScheduleDto,
    providerId: string,
  ) {
    const schedule = await this.getPickupScheduleById(id);

    // Validate ownership
    if (schedule.providerId !== providerId) {
      throw new BadRequestException('You can only update your own pickup schedules');
    }

    // Only allow updates when in DRAFT status (per lifecycle: draft → published → active → completed/cancelled)
    if (schedule.status !== 'DRAFT') {
      throw new BadRequestException('Only draft pickup schedules can be updated');
    }

    // Build update data
    const updateData: any = {};

    if (data.route !== undefined) updateData.route = data.route;
    if (data.scheduledDate !== undefined) updateData.scheduledDate = new Date(data.scheduledDate);
    if (data.scheduledTime !== undefined) updateData.scheduledTime = data.scheduledTime;
    if (data.totalCapacity !== undefined) {
      updateData.totalCapacity = data.totalCapacity;
      // Recalculate available capacity
      updateData.availableCapacity = data.totalCapacity - schedule.usedCapacity;
    }
    if (data.vehicleId !== undefined) updateData.vehicleId = data.vehicleId;
    if (data.vehicleType !== undefined) updateData.vehicleType = data.vehicleType;
    if (data.driverId !== undefined) updateData.driverId = data.driverId;
    if (data.driverName !== undefined) updateData.driverName = data.driverName;
    if (data.driverPhone !== undefined) updateData.driverPhone = data.driverPhone;
    if (data.pricePerKg !== undefined) updateData.pricePerKg = data.pricePerKg;
    if (data.fixedPrice !== undefined) updateData.fixedPrice = data.fixedPrice;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Update the schedule
    const updatedSchedule = await this.prisma.farmPickupSchedule.update({
      where: { id },
      data: updateData,
      include: {
        aggregationCenter: true,
      },
    });

    // Create activity log (per lifecycle: updates tracked)
    try {
      await this.activityLogService.createActivityLog({
        userId: providerId,
        action: 'PICKUP_SCHEDULE_UPDATED',
        entityType: 'PICKUP_SCHEDULE',
        entityId: id,
        metadata: { scheduleNumber: schedule.scheduleNumber, updatedFields: Object.keys(updateData) },
      });
    } catch (error) {
      console.error('Failed to create activity log for pickup schedule update:', error);
    }

    return updatedSchedule;
  }

  async publishPickupSchedule(id: string, providerId: string) {
    const schedule = await this.getPickupScheduleById(id);

    // Validate ownership
    if (schedule.providerId !== providerId) {
      throw new BadRequestException('You can only publish your own pickup schedules');
    }

    // Only allow publishing when in DRAFT status (per lifecycle)
    if (schedule.status !== 'DRAFT') {
      throw new BadRequestException('Only draft pickup schedules can be published');
    }

    // Get aggregation center capacity (per lifecycle: sync with center capacity)
    const center = await this.prisma.aggregationCenter.findUnique({
      where: { id: schedule.aggregationCenterId },
      include: {
        inventory: {
          select: {
            quantity: true,
          },
        },
      },
    });

    if (!center) {
      throw new NotFoundException('Aggregation center not found');
    }

    // Calculate center capacity
    const usedCapacity = center.inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const availableCapacity = center.totalCapacity - usedCapacity;

    // Update schedule to PUBLISHED
    const updatedSchedule = await this.prisma.farmPickupSchedule.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
      include: {
        aggregationCenter: true,
      },
    });

    // Create notifications (per lifecycle: provider + farmers)
    try {
      // Notify provider
      await this.notificationHelperService.createNotification({
        userId: providerId,
        type: 'PICKUP_SCHEDULE',
        title: 'Pickup Schedule Published',
        message: `Schedule #${schedule.scheduleNumber} published successfully`,
        priority: 'MEDIUM',
        entityType: 'PICKUP_SCHEDULE',
        entityId: id,
        actionUrl: `/pickup-schedules/${id}`,
        actionLabel: 'View Schedule',
        metadata: { scheduleNumber: schedule.scheduleNumber },
      });

      // Note: In a real system, you would notify farmers who are subscribed to this route/center
      // For now, we'll just log that notifications would be sent
      // TODO: Implement farmer notification system based on subscriptions/preferences
    } catch (error) {
      console.error('Failed to create notification for pickup schedule publish:', error);
    }

    // Create activity log
    try {
      await this.activityLogService.createActivityLog({
        userId: providerId,
        action: 'PICKUP_SCHEDULE_PUBLISHED',
        entityType: 'PICKUP_SCHEDULE',
        entityId: id,
        metadata: {
          scheduleNumber: schedule.scheduleNumber,
          centerAvailableCapacity: availableCapacity,
          centerTotalCapacity: center.totalCapacity,
        },
      });
    } catch (error) {
      console.error('Failed to create activity log for pickup schedule publish:', error);
    }

    return {
      ...updatedSchedule,
      centerCapacity: {
        totalCapacity: center.totalCapacity,
        usedCapacity,
        availableCapacity,
      },
    };
  }

  async cancelPickupSchedule(id: string, providerId: string, reason?: string) {
    const schedule = await this.getPickupScheduleById(id);

    // Validate ownership
    if (schedule.providerId !== providerId) {
      throw new BadRequestException('You can only cancel your own pickup schedules');
    }

    // Cannot cancel if already completed or cancelled
    if (schedule.status === 'COMPLETED' || schedule.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel schedule with status ${schedule.status}`);
    }

    // Get all bookings for this schedule
    const bookings = await this.prisma.pickupSlotBooking.findMany({
      where: { scheduleId: id },
      include: {
        slot: true,
      },
    });

    // Cancel schedule and all bookings in a transaction (per lifecycle: all bookings cancelled)
    const result = await this.prisma.$transaction(async (tx) => {
      // Update schedule to CANCELLED
      const updatedSchedule = await tx.farmPickupSchedule.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      // Cancel all bookings and release capacity
      for (const booking of bookings) {
        // Update booking status
        await tx.pickupSlotBooking.update({
          where: { id: booking.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        });

        // Release slot capacity
        await tx.pickupSlot.update({
          where: { id: booking.slotId },
          data: {
            usedCapacity: { decrement: booking.quantity },
            availableCapacity: { increment: booking.quantity },
            status: 'AVAILABLE', // Reset to available
          },
        });
      }

      // Release schedule capacity
      const totalBookedQuantity = bookings.reduce((sum, b) => sum + b.quantity, 0);
      await tx.farmPickupSchedule.update({
        where: { id },
        data: {
          usedCapacity: { decrement: totalBookedQuantity },
          availableCapacity: { increment: totalBookedQuantity },
        },
      });

      return { schedule: updatedSchedule, cancelledBookings: bookings.length };
    });

    // Create notifications (per lifecycle: provider + all farmers with bookings)
    try {
      // Notify provider
      await this.notificationHelperService.createNotification({
        userId: providerId,
        type: 'PICKUP_SCHEDULE',
        title: 'Pickup Schedule Cancelled',
        message: `Schedule #${schedule.scheduleNumber} cancelled. ${result.cancelledBookings} bookings cancelled.`,
        priority: 'HIGH',
        entityType: 'PICKUP_SCHEDULE',
        entityId: id,
        actionUrl: `/pickup-schedules/${id}`,
        actionLabel: 'View Schedule',
        metadata: { scheduleNumber: schedule.scheduleNumber, reason },
      });

      // Notify all farmers with bookings
      const farmerIds = [...new Set(bookings.map(b => b.farmerId))];
      await this.notificationHelperService.createNotifications(
        farmerIds.map(farmerId => ({
          userId: farmerId,
          type: 'PICKUP_SCHEDULE',
          title: 'Pickup Schedule Cancelled',
          message: `Pickup schedule ${schedule.route} has been cancelled`,
          priority: 'HIGH',
          entityType: 'PICKUP_SCHEDULE',
          entityId: id,
          actionUrl: `/pickup-schedules/${id}`,
          actionLabel: 'View Schedule',
          metadata: { scheduleNumber: schedule.scheduleNumber, reason },
        })),
      );
    } catch (error) {
      console.error('Failed to create notifications for pickup schedule cancellation:', error);
    }

    // Create activity log
    try {
      await this.activityLogService.createActivityLog({
        userId: providerId,
        action: 'PICKUP_SCHEDULE_CANCELLED',
        entityType: 'PICKUP_SCHEDULE',
        entityId: id,
        metadata: {
          scheduleNumber: schedule.scheduleNumber,
          cancelledBookings: result.cancelledBookings,
          reason,
        },
      });
    } catch (error) {
      console.error('Failed to create activity log for pickup schedule cancellation:', error);
    }

    return result.schedule;
  }

  // ============ Pickup Slots ============

  async getPickupSlots(filters?: {
    scheduleId?: string;
    locationId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.scheduleId) {
      where.scheduleId = filters.scheduleId;
    }
    if (filters?.locationId) {
      where.locationId = filters.locationId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.pickupSlot.findMany({
      where,
      include: {
        schedule: true,
        location: true,
        bookings: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async createPickupSlot(data: CreatePickupSlotDto) {
    return this.prisma.pickupSlot.create({
      data: {
        scheduleId: data.scheduleId,
        locationId: data.locationId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        capacity: data.capacity,
        availableCapacity: data.capacity, // Initially same as capacity
      },
      include: {
        schedule: true,
        location: true,
      },
    });
  }

  async bookPickupSlot(slotId: string, data: BookPickupSlotDto, farmerId: string) {
    const slot = await this.prisma.pickupSlot.findUnique({
      where: { id: slotId },
      include: {
        bookings: true,
        schedule: true,
      },
    });

    if (!slot) {
      throw new NotFoundException(`Pickup Slot with ID ${slotId} not found`);
    }

    // Check slot capacity
    const totalBooked = slot.bookings.reduce((sum, b) => sum + b.quantity, 0);
    if (totalBooked + data.quantity > slot.capacity) {
      throw new BadRequestException('Insufficient capacity in this slot');
    }

    // Check schedule capacity
    if (slot.schedule.usedCapacity + data.quantity > slot.schedule.totalCapacity) {
      throw new BadRequestException('Insufficient capacity in schedule');
    }

    // Create booking and update capacities in a transaction
    const booking = await this.prisma.$transaction(async (tx) => {
      // Create booking
      const newBooking = await tx.pickupSlotBooking.create({
        data: {
          slotId,
          scheduleId: slot.scheduleId,
          farmerId,
          quantity: data.quantity,
          location: data.location,
          coordinates: data.coordinates,
          contactPhone: data.contactPhone,
          notes: data.notes,
          variety: data.variety,
          qualityGrade: data.qualityGrade as any,
          photos: data.photos || [],
        },
      });

      // Update slot capacity
      await tx.pickupSlot.update({
        where: { id: slotId },
        data: {
          usedCapacity: { increment: data.quantity },
          availableCapacity: { decrement: data.quantity },
          status: slot.capacity - totalBooked - data.quantity <= 0 ? 'FULL' : 'BOOKED',
        },
      });

      // Update schedule capacity
      await tx.farmPickupSchedule.update({
        where: { id: slot.scheduleId },
        data: {
          usedCapacity: { increment: data.quantity },
          availableCapacity: { decrement: data.quantity },
        },
      });

      return newBooking;
    });

    return this.prisma.pickupSlotBooking.findUnique({
      where: { id: booking.id },
      include: {
        slot: {
          include: {
            schedule: true,
          },
        },
      },
    });
  }

  async cancelPickupSlotBooking(bookingId: string, farmerId: string) {
    const booking = await this.prisma.pickupSlotBooking.findUnique({
      where: { id: bookingId },
      include: {
        slot: {
          include: {
            schedule: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Pickup slot booking with ID ${bookingId} not found`);
    }

    // Validate ownership
    if (booking.farmerId !== farmerId) {
      throw new BadRequestException('You can only cancel your own bookings');
    }

    // Cannot cancel if already picked up or completed
    if (booking.status === 'picked_up' || booking.status === 'completed') {
      throw new BadRequestException(`Cannot cancel booking with status ${booking.status}`);
    }

    // Cancel booking and release capacity in a transaction
    const cancelledBooking = await this.prisma.$transaction(async (tx) => {
      // Update booking status
      const updatedBooking = await tx.pickupSlotBooking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      // Release slot capacity
      await tx.pickupSlot.update({
        where: { id: booking.slotId },
        data: {
          usedCapacity: { decrement: booking.quantity },
          availableCapacity: { increment: booking.quantity },
          status: booking.slot.status === 'FULL' ? 'BOOKED' : booking.slot.status,
        },
      });

      // Release schedule capacity
      await tx.farmPickupSchedule.update({
        where: { id: booking.scheduleId },
        data: {
          usedCapacity: { decrement: booking.quantity },
          availableCapacity: { increment: booking.quantity },
        },
      });

      return updatedBooking;
    });

    // Create notifications (per lifecycle: farmer + provider)
    try {
      await this.notificationHelperService.createNotifications([
        {
          userId: farmerId,
          type: 'PICKUP_BOOKING',
          title: 'Booking Cancelled',
          message: `Your pickup slot booking has been cancelled`,
          priority: 'MEDIUM',
          entityType: 'PICKUP_BOOKING',
          entityId: bookingId,
          actionUrl: `/pickup-bookings/${bookingId}`,
          actionLabel: 'View Booking',
          metadata: { scheduleId: booking.scheduleId },
        },
        {
          userId: booking.slot.schedule.providerId,
          type: 'PICKUP_BOOKING',
          title: 'Booking Cancelled',
          message: `A booking on schedule #${booking.slot.schedule.scheduleNumber} has been cancelled`,
          priority: 'MEDIUM',
          entityType: 'PICKUP_BOOKING',
          entityId: bookingId,
          actionUrl: `/pickup-schedules/${booking.scheduleId}`,
          actionLabel: 'View Schedule',
          metadata: { scheduleId: booking.scheduleId },
        },
      ]);
    } catch (error) {
      console.error('Failed to create notifications for booking cancellation:', error);
    }

    // Create activity log
    try {
      await this.activityLogService.createActivityLog({
        userId: farmerId,
        action: 'PICKUP_BOOKING_CANCELLED',
        entityType: 'PICKUP_BOOKING',
        entityId: bookingId,
        metadata: { scheduleId: booking.scheduleId, quantity: booking.quantity },
      });
    } catch (error) {
      console.error('Failed to create activity log for booking cancellation:', error);
    }

    return cancelledBooking;
  }

  async confirmPickup(bookingId: string, data: ConfirmPickupDto, farmerId: string) {
    const booking = await this.prisma.pickupSlotBooking.findUnique({
      where: { id: bookingId },
      include: {
        slot: {
          include: {
            schedule: {
              include: {
                aggregationCenter: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Pickup slot booking with ID ${bookingId} not found`);
    }

    // Validate ownership
    if (booking.farmerId !== farmerId) {
      throw new BadRequestException('You can only confirm your own pickups');
    }

    // Cannot confirm if already confirmed or cancelled
    if (booking.pickupConfirmed) {
      throw new BadRequestException('Pickup already confirmed');
    }
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Cannot confirm cancelled booking');
    }

    // Generate batch ID and QR code (per lifecycle: batch traceability starts)
    const { batchId: generatedBatchId, qrCode: generatedQRCode } = generateBatchTraceability();
    const batchId = data.batchId || generatedBatchId;
    // QR code should be based on the actual batchId used
    const qrCode = data.batchId ? `QR-${data.batchId}` : generatedQRCode;

    // Generate receipt number
    const receiptNumber = await this.prisma.$queryRaw<Array<{ generate_pickup_receipt_number: string }>>`
      SELECT generate_pickup_receipt_number() as generate_pickup_receipt_number
    `;

    // Create receipt and update booking in a transaction (per lifecycle: receipt + batch created)
    const result = await this.prisma.$transaction(async (tx) => {
      // Create pickup receipt
      const receipt = await tx.pickupReceipt.create({
        data: {
          receiptNumber: receiptNumber[0].generate_pickup_receipt_number,
          bookingId,
          scheduleId: booking.scheduleId,
          farmerId: booking.farmerId,
          providerId: booking.slot.schedule.providerId,
          aggregationCenterId: booking.slot.schedule.aggregationCenterId,
          batchId,
          qrCode,
          quantity: booking.quantity,
          variety: data.variety as any,
          qualityGrade: data.qualityGrade as any,
          pickupLocation: booking.location,
          pickupDate: new Date(),
          pickupTime: new Date().toTimeString().slice(0, 5), // HH:mm format
          scheduledDeliveryDate: booking.slot.schedule.scheduledDate,
          photos: data.photos || [],
          notes: data.notes,
          createdBy: farmerId,
        },
      });

      // Update booking with confirmation data
      const updatedBooking = await tx.pickupSlotBooking.update({
        where: { id: bookingId },
        data: {
          batchId,
          qrCode,
          pickupConfirmed: true,
          pickupConfirmedAt: new Date(),
          pickupConfirmedBy: farmerId,
          pickupReceiptId: receipt.id,
          variety: data.variety,
          qualityGrade: data.qualityGrade as any,
          photos: data.photos || [],
          notes: data.notes,
          status: 'picked_up',
        },
        include: {
          slot: {
            include: {
              schedule: {
                include: {
                  aggregationCenter: true,
                },
              },
            },
          },
          pickupReceipt: true,
        },
      });

      return { booking: updatedBooking, receipt };
    });

    // Create notifications (per lifecycle: farmer + provider + aggregation center manager)
    try {
      const centerManagerId = booking.slot.schedule.aggregationCenter.managerId;
      await this.notificationHelperService.createNotifications([
        {
          userId: farmerId,
          type: 'PICKUP_BOOKING',
          title: 'Pickup Confirmed!',
          message: `Pickup confirmed! Receipt generated. Batch ID: ${batchId}`,
          priority: 'HIGH',
          entityType: 'PICKUP_BOOKING',
          entityId: bookingId,
          actionUrl: `/pickup-bookings/${bookingId}`,
          actionLabel: 'View Receipt',
          metadata: { batchId, receiptNumber: receiptNumber[0].generate_pickup_receipt_number },
        },
        {
          userId: booking.slot.schedule.providerId,
          type: 'PICKUP_BOOKING',
          title: 'Pickup Confirmed',
          message: `Pickup confirmed by farmer. Batch ID: ${batchId}`,
          priority: 'MEDIUM',
          entityType: 'PICKUP_BOOKING',
          entityId: bookingId,
          actionUrl: `/pickup-schedules/${booking.scheduleId}`,
          actionLabel: 'View Schedule',
          metadata: { batchId, scheduleId: booking.scheduleId },
        },
        ...(centerManagerId ? [{
          userId: centerManagerId,
          type: 'PICKUP_BOOKING',
          title: 'Incoming Delivery',
          message: `Incoming delivery with batch ${batchId} from ${booking.slot.schedule.route}`,
          priority: 'MEDIUM' as const,
          entityType: 'PICKUP_BOOKING',
          entityId: bookingId,
          actionUrl: `/pickup-schedules/${booking.scheduleId}`,
          actionLabel: 'View Schedule',
          metadata: { batchId, scheduleId: booking.scheduleId },
        }] : []),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for pickup confirmation:', error);
    }

    // Create activity log
    try {
      await this.activityLogService.createActivityLog({
        userId: farmerId,
        action: 'PICKUP_CONFIRMED',
        entityType: 'PICKUP_BOOKING',
        entityId: bookingId,
        metadata: {
          batchId,
          receiptNumber: receiptNumber[0].generate_pickup_receipt_number,
          scheduleId: booking.scheduleId,
          quantity: booking.quantity,
        },
      });
    } catch (error) {
      console.error('Failed to create activity log for pickup confirmation:', error);
    }

    return result.booking;
  }

  async getPickupReceiptById(receiptId: string) {
    const receipt = await this.prisma.pickupReceipt.findUnique({
      where: { id: receiptId },
      include: {
        booking: {
          include: {
            slot: {
              include: {
                schedule: {
                  include: {
                    aggregationCenter: true,
                  },
                },
              },
            },
          },
        },
        aggregationCenter: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Pickup receipt with ID ${receiptId} not found`);
    }

    return receipt;
  }

  async getPickupReceiptByBookingId(bookingId: string) {
    const receipt = await this.prisma.pickupReceipt.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            slot: {
              include: {
                schedule: {
                  include: {
                    aggregationCenter: true,
                  },
                },
              },
            },
          },
        },
        aggregationCenter: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Pickup receipt for booking ${bookingId} not found`);
    }

    return receipt;
  }

  async getFarmerPickupBookings(farmerId: string, filters?: {
    status?: string;
    scheduleId?: string;
  }) {
    const where: any = {
      farmerId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.scheduleId) {
      where.scheduleId = filters.scheduleId;
    }

    return this.prisma.pickupSlotBooking.findMany({
      where,
      include: {
        slot: {
          include: {
            schedule: {
              include: {
                aggregationCenter: true,
              },
            },
          },
        },
        pickupReceipt: true,
      },
      orderBy: { bookedAt: 'desc' },
    });
  }

  // ============ Tracking Updates ============

  async getTrackingUpdates(requestId: string) {
    return this.prisma.trackingUpdate.findMany({
      where: { requestId: requestId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addTrackingUpdate(requestId: string, data: AddTrackingUpdateDto, userId: string) {
    const request = await this.getTransportRequestById(requestId);

    // Verify user is provider
    if (request.providerId !== userId) {
      throw new BadRequestException('Only the transport provider can add tracking updates');
    }

    const trackingUpdate = await this.prisma.trackingUpdate.create({
      data: {
        requestId: requestId,
        location: data.location,
        coordinates: data.coordinates,
        status: data.status,
        notes: data.notes,
        updatedBy: userId,
      },
    });

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'TRANSPORT_TRACKING_UPDATE',
      entityType: 'TRANSPORT',
      entityId: requestId,
      metadata: {
        requestNumber: request.requestNumber,
        location: data.location,
        status: data.status,
        trackingUpdateId: trackingUpdate.id,
      },
    });

    return trackingUpdate;
  }

  // ============ Active Deliveries ============

  async getActiveDeliveries(filters?: {
    providerId?: string;
    requesterId?: string;
  }) {
    const where: any = {
      OR: [
        { status: 'ACCEPTED' as any },
        { status: 'IN_TRANSIT_PICKUP' as any },
        { status: 'IN_TRANSIT_DELIVERY' as any },
      ],
    };

    if (filters?.providerId) {
      where.providerId = filters.providerId;
    }
    if (filters?.requesterId) {
      where.requesterId = filters.requesterId;
    }

    return this.prisma.transportRequest.findMany({
      where,
      include: {
        requester: {
          include: {
            profile: true,
          },
        },
        provider: {
          include: {
            profile: true,
          },
        },
        order: true,
        pickupSchedule: true,
        pickupSlot: true,
        trackingUpdates: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Latest 5 tracking updates
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============ Statistics ============

  async getTransportStats(providerId?: string) {
    const where = providerId ? { providerId } : {};

    const [totalRequests, requestsByStatus, activeDeliveries] = await Promise.all([
      this.prisma.transportRequest.count({ where }),
      this.prisma.transportRequest.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.transportRequest.count({
        where: {
          ...where,
          OR: [
            { status: 'IN_TRANSIT_PICKUP' as any },
            { status: 'IN_TRANSIT_DELIVERY' as any },
          ],
        },
      }),
    ]);

    return {
      totalRequests,
      activeDeliveries,
      requestsByStatus: requestsByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
    };
  }
}
