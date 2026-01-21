import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import {
  CreateTransportRequestDto,
  UpdateTransportRequestStatusDto,
  CreatePickupScheduleDto,
  CreatePickupSlotDto,
  BookPickupSlotDto,
  AddTrackingUpdateDto,
} from './dto';

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

    return this.prisma.transportRequest.update({
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

    return this.prisma.trackingUpdate.create({
      data: {
        requestId: requestId,
        location: data.location,
        coordinates: data.coordinates,
        status: data.status,
        notes: data.notes,
        updatedBy: userId,
      },
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
