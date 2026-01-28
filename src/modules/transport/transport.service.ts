import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PickupScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService, CreateNotificationDto } from '../../common/services/notification.service';
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
  private readonly logger = new Logger(TransportService.name);

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
    } else if (filters?.status === 'PENDING') {
      // For pending requests, show only unassigned requests (providerId is null)
      where.providerId = null;
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
    try {
      console.log(`[TRANSPORT_SERVICE] createTransportRequest called:`, {
        type: data.type,
        orderId: data.orderId,
        requesterId,
        pickupLocation: data.pickupLocation,
        deliveryLocation: data.deliveryLocation,
        weight: data.weight,
      });

      // Check if transport request already exists for this order (prevent duplicates)
      if (data.orderId) {
        console.log(`[TRANSPORT_SERVICE] Checking for existing transport request for order ${data.orderId}...`);
        const existingRequest = await this.prisma.transportRequest.findFirst({
          where: { 
            orderId: data.orderId,
            // Only check for non-cancelled requests
            status: {
              not: 'CANCELLED',
            },
          },
          select: {
            id: true,
            requestNumber: true,
            status: true,
          },
        });

        if (existingRequest) {
          console.log(`[TRANSPORT_SERVICE] Existing transport request found:`, {
            requestId: existingRequest.id,
            requestNumber: existingRequest.requestNumber,
            status: existingRequest.status,
          });
          throw new BadRequestException(
            `A transport request already exists for this order. Request #${existingRequest.requestNumber} (Status: ${existingRequest.status})`
          );
        } else {
          console.log(`[TRANSPORT_SERVICE] No existing transport request found. Proceeding with creation.`);
        }
      }

      // Generate request number
      console.log(`[TRANSPORT_SERVICE] Generating transport request number...`);
      const requestNumber = await this.prisma.$queryRaw<Array<{ generate_transport_request_number: string }>>`
        SELECT generate_transport_request_number() as generate_transport_request_number
      `;
      console.log(`[TRANSPORT_SERVICE] Generated request number: ${requestNumber[0].generate_transport_request_number}`);

      console.log(`[TRANSPORT_SERVICE] Creating transport request in database...`);
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

      console.log(`[TRANSPORT_SERVICE] Transport request created successfully:`, {
        requestId: request.id,
        requestNumber: request.requestNumber,
        type: request.type,
        status: request.status,
        orderId: request.orderId,
      });

      // Create activity log
      console.log(`[TRANSPORT_SERVICE] Creating activity log for transport request ${request.requestNumber}...`);
      await this.activityLogService.logTransportCreated(request, requesterId);
      console.log(`[TRANSPORT_SERVICE] Activity log created successfully`);

      // Update order fulfillment type and delivery details if transport request is linked to an order
      if (data.orderId) {
        try {
          console.log(`[TRANSPORT_SERVICE] Updating order ${data.orderId} fulfillment type and delivery details...`);
          const orderUpdateData: any = { fulfillmentType: 'request_transport' };
          
          // Update delivery address and county if provided in transport request
          // This is especially important for orders past processing stage where fulfillment type is being changed
          if (data.deliveryLocation) {
            orderUpdateData.deliveryAddress = data.deliveryLocation;
          }
          if (data.deliveryCounty) {
            orderUpdateData.deliveryCounty = data.deliveryCounty;
          }
          if (data.deliveryCoordinates) {
            orderUpdateData.deliveryCoordinates = data.deliveryCoordinates;
          }

          await this.prisma.marketplaceOrder.update({
            where: { id: data.orderId },
            data: orderUpdateData,
          });
          console.log(`[TRANSPORT_SERVICE] Order ${data.orderId} updated successfully with fulfillment type: request_transport`);
        } catch (error) {
          this.logger.warn(`[TRANSPORT_SERVICE] Failed to update order fulfillment type for order ${data.orderId}:`, error);
        }
      }

      // Create notifications based on transport type
      try {
        console.log(`[TRANSPORT_SERVICE] Creating notifications for transport request ${request.requestNumber}...`);
        if (data.type === 'ORDER_DELIVERY' && request.order) {
          // Notify buyer (requester) that transport request was created
          console.log(`[TRANSPORT_SERVICE] Sending ORDER_DELIVERY notification to buyer (requesterId: ${requesterId})...`);
          await this.notificationHelperService.createNotification({
            userId: requesterId,
            type: 'TRANSPORT',
            title: 'Delivery Arranged',
            message: `Transport request #${request.requestNumber} created for order #${request.order.orderNumber}. Waiting for provider assignment.`,
            priority: 'MEDIUM',
            entityType: 'TRANSPORT',
            entityId: request.id,
            actionUrl: `/transport/${request.id}`,
            actionLabel: 'View Request',
            metadata: {
              requestNumber: request.requestNumber,
              orderNumber: request.order.orderNumber,
              orderId: request.order.id,
              type: 'ORDER_DELIVERY',
            },
          });
          console.log(`[TRANSPORT_SERVICE] Notification sent successfully to buyer`);

          // Notify all transport providers about new ORDER_DELIVERY request
          // Note: In a real implementation, you might want to fetch active providers
          // For now, providers will see it in their pending requests list
          console.log(`[TRANSPORT_SERVICE] Transport providers will see request in pending requests list`);
        } else {
          // For other transport types, notify requester
          console.log(`[TRANSPORT_SERVICE] Sending notification for ${data.type} transport request...`);
          await this.notificationHelperService.createNotification({
            userId: requesterId,
            type: 'TRANSPORT',
            title: 'Transport Request Created',
            message: `Transport request #${request.requestNumber} has been created. Waiting for provider assignment.`,
            priority: 'MEDIUM',
            entityType: 'TRANSPORT',
            entityId: request.id,
            actionUrl: `/transport/${request.id}`,
            actionLabel: 'View Request',
            metadata: {
              requestNumber: request.requestNumber,
              type: data.type,
            },
          });
          console.log(`[TRANSPORT_SERVICE] Notification sent successfully`);
        }
      } catch (error) {
        this.logger.warn(`[TRANSPORT_SERVICE] Failed to create notification for transport request ${request.id}:`, error);
        // Don't throw - notification failures shouldn't block request creation
      }

      console.log(`[TRANSPORT_SERVICE] createTransportRequest completed successfully for request ${request.requestNumber}`);
      return request;
    } catch (error) {
      console.error(`[TRANSPORT_SERVICE] ERROR: createTransportRequest failed:`, {
        requesterId,
        orderId: data.orderId ?? 'none',
        type: data.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.logger.error(
        `createTransportRequest failed (requesterId=${requesterId}, orderId=${data.orderId ?? 'none'})`,
        (error as Error)?.stack ?? String(error),
      );
      throw error;
    }
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

    // For ORDER_DELIVERY requests, verify order is in RELEASED status before allowing collection
    // This ensures stock out has been recorded by aggregation officer before transport provider can collect
    if (request.orderId && request.type === 'ORDER_DELIVERY' && 
        (newStatus === 'IN_TRANSIT_PICKUP' || newStatus === 'IN_TRANSIT_DELIVERY') &&
        oldStatus !== 'IN_TRANSIT_PICKUP' && oldStatus !== 'IN_TRANSIT_DELIVERY') {
      // Fetch order to check status if not already loaded
      const order = request.order || await this.prisma.marketplaceOrder.findUnique({
        where: { id: request.orderId },
        select: { id: true, status: true, orderNumber: true },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${request.orderId} not found`);
      }

      if (order.status !== 'RELEASED') {
        throw new BadRequestException(
          `Cannot mark order as collected. Order #${order.orderNumber} must be in RELEASED status (stock out must be recorded first by aggregation officer). Current order status: ${order.status}`
        );
      }
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

    let updatedRequest;
    try {
      updatedRequest = await this.prisma.transportRequest.update({
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
    } catch (error) {
      this.logger.error(
        `updateTransportRequestStatus failed (requestId=${id}, userId=${userId}, newStatus=${newStatus})`,
        (error as Error)?.stack ?? String(error),
      );
      throw error;
    }

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
        this.logger.error(
          `Failed to update order status (requestId=${id}, orderId=${request.orderId}, newStatus=${newStatus})`,
          (error as Error)?.stack ?? String(error),
        );
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
        this.logger.error(
          `Failed to update order status for PRODUCE_DELIVERY (requestId=${id}, orderId=${request.orderId})`,
          (error as Error)?.stack ?? String(error),
        );
        // Don't re-throw - allow transport status to update even if order status update fails
        // This prevents transport delivery from being blocked by order status validation issues
      }
    }

    // Update order status for ORDER_DELIVERY type
    if (request.orderId && request.type === 'ORDER_DELIVERY') {
      try {
        if (newStatus === 'ACCEPTED' && oldStatus === 'PENDING') {
          // Transport accepted - order can move to IN_TRANSIT when pickup/delivery starts
          // For now, we'll update when transport goes in transit
        } else if ((newStatus === 'IN_TRANSIT_PICKUP' || newStatus === 'IN_TRANSIT_DELIVERY') && 
                   oldStatus !== 'IN_TRANSIT_PICKUP' && oldStatus !== 'IN_TRANSIT_DELIVERY') {
          // Order status validation (RELEASED check) already done at the beginning of the function
          // Transport in transit - update order to IN_TRANSIT
          await this.marketplaceService.updateOrderStatus(
            request.orderId,
            { status: 'IN_TRANSIT' },
            userId,
          );
        } else if (newStatus === 'DELIVERED' && oldStatus !== 'DELIVERED') {
          // Transport delivered - update order to DELIVERED
          await this.marketplaceService.updateOrderStatus(
            request.orderId,
            { status: 'DELIVERED' },
            userId,
          );
        }
      } catch (error) {
        // Re-throw BadRequestException (validation errors) to show proper error message
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(
          `Failed to update order status for ORDER_DELIVERY (requestId=${id}, orderId=${request.orderId}, newStatus=${newStatus})`,
          (error as Error)?.stack ?? String(error),
        );
        // Don't re-throw other errors - allow transport status to update even if order status update fails
      }
    }

    // Create notifications based on status and transport type
    try {
      const notifications: CreateNotificationDto[] = [];

      // Notify requester
      if (request.requesterId) {
        let title = `Transport Request ${newStatus}`;
        let message = `Transport request #${request.requestNumber} status updated to ${newStatus}`;

        // Customize messages for ORDER_DELIVERY
        if (request.type === 'ORDER_DELIVERY' && request.order) {
          if (newStatus === 'ACCEPTED') {
            title = 'Delivery Provider Assigned';
            message = `A transport provider has been assigned for order #${request.order.orderNumber}. Delivery will begin soon.`;
          } else if (newStatus === 'IN_TRANSIT_PICKUP' || newStatus === 'IN_TRANSIT_DELIVERY') {
            title = 'Order In Transit';
            message = `Your order #${request.order.orderNumber} is now in transit. Track delivery in real-time.`;
          } else if (newStatus === 'DELIVERED') {
            title = 'Order Delivered';
            message = `Your order #${request.order.orderNumber} has been delivered successfully.`;
          } else if (newStatus === 'COMPLETED') {
            title = 'Delivery Completed';
            message = `Delivery for order #${request.order.orderNumber} has been completed.`;
          }
        }

        notifications.push({
          userId: request.requesterId,
          type: 'TRANSPORT',
          title,
          message,
          priority: ['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(newStatus) ? 'HIGH' : 'MEDIUM',
          entityType: 'TRANSPORT',
          entityId: request.id,
          actionUrl: `/transport/${request.id}`,
          actionLabel: 'View Request',
          metadata: {
            requestNumber: request.requestNumber,
            status: newStatus,
            orderId: request.orderId,
            orderNumber: request.order?.orderNumber,
            type: request.type,
          },
        });
      }

      // Notify provider if assigned
      if (request.providerId && (newStatus === 'IN_TRANSIT_PICKUP' || newStatus === 'IN_TRANSIT_DELIVERY' || newStatus === 'DELIVERED')) {
        let providerMessage = `Transport request #${request.requestNumber} status updated to ${newStatus}`;
        
        if (request.type === 'ORDER_DELIVERY' && request.order) {
          if (newStatus === 'IN_TRANSIT_PICKUP' || newStatus === 'IN_TRANSIT_DELIVERY') {
            providerMessage = `Order #${request.order.orderNumber} is in transit. Continue tracking and updating location.`;
          } else if (newStatus === 'DELIVERED') {
            providerMessage = `Order #${request.order.orderNumber} has been delivered. Mark as complete when confirmed.`;
          }
        }

        notifications.push({
          userId: request.providerId,
          type: 'TRANSPORT',
          title: `Transport Status: ${newStatus}`,
          message: providerMessage,
          priority: newStatus === 'DELIVERED' ? 'HIGH' : 'MEDIUM',
          entityType: 'TRANSPORT',
          entityId: request.id,
          actionUrl: `/transport/${request.id}`,
          actionLabel: 'View Request',
          metadata: {
            requestNumber: request.requestNumber,
            status: newStatus,
            orderId: request.orderId,
            orderNumber: request.order?.orderNumber,
            type: request.type,
          },
        });
      }

      if (notifications.length > 0) {
        await this.notificationHelperService.createNotifications(notifications);
      }
    } catch (error) {
      this.logger.warn(`Failed to create notifications for transport status update (requestId=${id}):`, error);
      // Don't throw - notification failures shouldn't block status update
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

    // Update marketplace order status if transport is linked to an order
    if (request.orderId) {
      try {
        // For ORDER_DELIVERY, we can optionally update order status when transport is accepted
        // For now, we'll wait until transport goes in transit to update order status
        // This keeps the order status more accurate to actual delivery progress
        if (request.type === 'ORDER_DELIVERY') {
          // Order will be updated to IN_TRANSIT when transport goes in transit
          // and to DELIVERED when transport is delivered
        } else if (request.type === 'PRODUCE_PICKUP') {
          // For produce pickup, order will be updated when transport goes in transit
        } else if (request.type === 'PRODUCE_DELIVERY') {
          // For produce delivery, order will be updated when transport is delivered
        }
      } catch (error) {
        this.logger.error(
          `Failed to handle order update on transport accept (requestId=${id}, orderId=${request.orderId})`,
          (error as Error)?.stack ?? String(error),
        );
        // Don't re-throw - allow transport acceptance even if order update logic fails
      }
    }

    // Create notifications for requester and provider
    const notifications: CreateNotificationDto[] = [];

    // Customize notification for ORDER_DELIVERY
    if (request.type === 'ORDER_DELIVERY' && request.order) {
      notifications.push({
        userId: request.requesterId,
        type: 'TRANSPORT',
        title: 'Delivery Provider Assigned',
        message: `A transport provider has been assigned for order #${request.order.orderNumber}. They will collect and deliver your order.`,
        priority: 'HIGH',
        entityType: 'TRANSPORT',
        entityId: request.id,
        actionUrl: `/transport/${request.id}`,
        actionLabel: 'Track Delivery',
        metadata: {
          requestNumber: request.requestNumber,
          providerId,
          orderId: request.orderId,
          orderNumber: request.order.orderNumber,
          type: 'ORDER_DELIVERY',
        },
      });
    } else {
      notifications.push({
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
      });
    }

    // Add provider notification
    if (request.type === 'ORDER_DELIVERY' && request.order) {
      notifications.push({
        userId: providerId,
        type: 'TRANSPORT',
        title: 'Order Delivery Assigned',
        message: `You have been assigned to deliver order #${request.order.orderNumber}. Collect from aggregation center and deliver to buyer.`,
        priority: 'HIGH',
        entityType: 'TRANSPORT',
        entityId: request.id,
        actionUrl: `/transport/${request.id}`,
        actionLabel: 'View Request',
        metadata: {
          requestNumber: request.requestNumber,
          orderId: request.orderId,
          orderNumber: request.order.orderNumber,
          type: 'ORDER_DELIVERY',
        },
      });
    } else {
      notifications.push({
        userId: providerId,
        type: 'TRANSPORT',
        title: 'Request Accepted',
        message: `You have accepted transport request #${request.requestNumber}. Proceed to pickup`,
        priority: 'HIGH',
        entityType: 'TRANSPORT',
        entityId: request.id,
        actionUrl: `/transport/${request.id}`,
        actionLabel: 'View Request',
        metadata: { requestNumber: request.requestNumber },
      });
    }

    await this.notificationHelperService.createNotifications(notifications);

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
    try {
      const where: any = {};

      if (filters?.providerId) {
        where.providerId = filters.providerId;
      }
      if (filters?.centerId) {
        where.aggregationCenterId = filters.centerId;
      }
      if (filters?.status) {
        const statusUpper = filters.status.toUpperCase();
        if (Object.values(PickupScheduleStatus).includes(statusUpper as PickupScheduleStatus)) {
          where.status = statusUpper;
        }
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

      return await this.prisma.farmPickupSchedule.findMany({
        where,
        include: {
          aggregationCenter: true,
        },
        orderBy: { scheduledDate: 'asc' },
      });
    } catch (error) {
      this.logger.error(
        `getPickupSchedules failed (filters=${JSON.stringify(filters)})`,
        (error as Error)?.stack ?? String(error),
      );
      throw error;
    }
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
      this.logger.error(
        `Failed to create activity log for pickup schedule update (scheduleId=${id})`,
        (error as Error)?.stack ?? String(error),
      );
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
      this.logger.error(
        `Failed to create notification for pickup schedule publish (scheduleId=${id})`,
        (error as Error)?.stack ?? String(error),
      );
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
      this.logger.error(
        `Failed to create activity log for pickup schedule publish (scheduleId=${id})`,
        (error as Error)?.stack ?? String(error),
      );
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
    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
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
    } catch (error) {
      this.logger.error(
        `cancelPickupSchedule failed (scheduleId=${id}, providerId=${providerId})`,
        (error as Error)?.stack ?? String(error),
      );
      throw error;
    }

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
      this.logger.error(
        `Failed to create notifications for pickup schedule cancellation (scheduleId=${id})`,
        (error as Error)?.stack ?? String(error),
      );
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
      this.logger.error(
        `Failed to create activity log for pickup schedule cancellation (scheduleId=${id})`,
        (error as Error)?.stack ?? String(error),
      );
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

  async bookPickupSlot(scheduleId: string, data: BookPickupSlotDto, farmerId: string) {
    // Get the schedule
    const schedule = await this.getPickupScheduleById(scheduleId);

    // Check if schedule is published and has capacity
    if (schedule.status !== 'PUBLISHED' && schedule.status !== 'ACTIVE') {
      throw new BadRequestException('Can only book slots in published or active schedules');
    }

    // Check schedule capacity
    if (schedule.usedCapacity + data.quantity > schedule.totalCapacity) {
      throw new BadRequestException('Insufficient capacity in schedule');
    }

    // Create slot and booking in a transaction
    let booking;
    try {
      booking = await this.prisma.$transaction(async (tx) => {
        // Create a new slot for this booking
        // Use the schedule's scheduled date/time as the slot time window
        const scheduledDateTime = new Date(schedule.scheduledDate);
        const [hours, minutes] = schedule.scheduledTime.split(':').map(Number);
        scheduledDateTime.setHours(hours || 0, minutes || 0, 0, 0);
        
        // Default slot duration: 2 hours
        const slotEndTime = new Date(scheduledDateTime);
        slotEndTime.setHours(slotEndTime.getHours() + 2);

        // Use first pickup location if available, otherwise null
        const pickupLocations = await tx.pickupLocation.findMany({
          where: { scheduleId },
          orderBy: { order: 'asc' },
          take: 1,
        });
        const firstLocation = pickupLocations.length > 0 ? pickupLocations[0].id : null;

        // Create the slot with capacity matching the booking quantity
        // Each booking gets its own slot, so the slot capacity equals the booking quantity
        const slotCapacity = data.quantity;
        
        const newSlot = await tx.pickupSlot.create({
          data: {
            scheduleId,
            locationId: firstLocation,
            startTime: scheduledDateTime,
            endTime: slotEndTime,
            capacity: slotCapacity,
            availableCapacity: 0, // Fully booked by this booking
            usedCapacity: data.quantity,
            status: 'FULL', // Slot is full since it's created for this specific booking
          },
        });

        // Create booking
        const newBooking = await tx.pickupSlotBooking.create({
          data: {
            slotId: newSlot.id,
            scheduleId,
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

        // Update schedule capacity
        await tx.farmPickupSchedule.update({
          where: { id: scheduleId },
          data: {
            usedCapacity: { increment: data.quantity },
            availableCapacity: { decrement: data.quantity },
          },
        });

        return newBooking;
      });
    } catch (error) {
      this.logger.error(
        `bookPickupSlot failed (scheduleId=${scheduleId}, farmerId=${farmerId}, quantity=${data.quantity})`,
        (error as Error)?.stack ?? String(error),
      );
      throw error;
    }

    return this.prisma.pickupSlotBooking.findUnique({
      where: { id: booking.id },
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
      this.logger.error(
        `Failed to create notifications for booking cancellation (bookingId=${bookingId})`,
        (error as Error)?.stack ?? String(error),
      );
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
      this.logger.error(
        `Failed to create activity log for booking cancellation (bookingId=${bookingId})`,
        (error as Error)?.stack ?? String(error),
      );
    }

    return cancelledBooking;
  }

  async confirmPickup(bookingId: string, data: ConfirmPickupDto, farmerId: string) {
    this.logger.log(
      `confirmPickup called: bookingId=${bookingId}, farmerId=${farmerId}, variety=${data.variety}, qualityGrade=${data.qualityGrade}`,
    );

    let booking;
    try {
      booking = await this.prisma.pickupSlotBooking.findUnique({
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
    } catch (error) {
      this.logger.error(
        `Failed to fetch booking for pickup confirmation: bookingId=${bookingId}, farmerId=${farmerId}`,
        (error as Error)?.stack ?? String(error),
      );
      throw new BadRequestException(`Failed to fetch booking: ${(error as Error)?.message ?? String(error)}`);
    }

    if (!booking) {
      this.logger.warn(
        `Pickup booking not found: bookingId=${bookingId}, farmerId=${farmerId}`,
      );
      throw new NotFoundException(`Pickup slot booking with ID ${bookingId} not found`);
    }

    // Validate ownership
    if (booking.farmerId !== farmerId) {
      this.logger.warn(
        `Unauthorized pickup confirmation attempt: bookingId=${bookingId}, bookingFarmerId=${booking.farmerId}, requestingFarmerId=${farmerId}`,
      );
      throw new BadRequestException('You can only confirm your own pickups');
    }

    // Cannot confirm if already confirmed or cancelled
    if (booking.pickupConfirmed) {
      this.logger.warn(
        `Attempt to confirm already confirmed pickup: bookingId=${bookingId}, farmerId=${farmerId}, confirmedAt=${booking.pickupConfirmedAt}`,
      );
      throw new BadRequestException('Pickup already confirmed');
    }
    if (booking.status === 'cancelled') {
      this.logger.warn(
        `Attempt to confirm cancelled booking: bookingId=${bookingId}, farmerId=${farmerId}, status=${booking.status}`,
      );
      throw new BadRequestException('Cannot confirm cancelled booking');
    }

    // Validate that scheduled pickup time has arrived
    const schedule = booking.slot?.schedule;
    
    if (schedule) {
      const scheduledDate = schedule.scheduledDate;
      const scheduledTime = schedule.scheduledTime;
      
      if (scheduledDate && scheduledTime) {
        try {
          // Parse scheduled date and time
          let scheduledDateTime: Date;
          
          // scheduledTime might be in ISO format or HH:mm format
          if (scheduledTime.includes('T')) {
            // Full ISO datetime string
            scheduledDateTime = new Date(scheduledTime);
          } else if (scheduledTime.includes(':') && scheduledTime.length === 5) {
            // HH:mm format, combine with scheduledDate
            const dateStr = scheduledDate instanceof Date 
              ? scheduledDate.toISOString().split('T')[0]
              : scheduledDate.toString().split('T')[0];
            scheduledDateTime = new Date(`${dateStr}T${scheduledTime}`);
          } else {
            // Fallback: use scheduledDate only
            scheduledDateTime = scheduledDate instanceof Date 
              ? scheduledDate 
              : new Date(scheduledDate);
          }
          
          const now = new Date();
          
          if (scheduledDateTime > now) {
            this.logger.warn(
              `Attempt to confirm pickup before scheduled time: bookingId=${bookingId}, farmerId=${farmerId}, scheduledDateTime=${scheduledDateTime.toISOString()}, now=${now.toISOString()}`,
            );
            throw new BadRequestException(
              `Cannot confirm pickup before the scheduled time. Scheduled time: ${scheduledDateTime.toLocaleString()}`
            );
          }
        } catch (error) {
          if (error instanceof BadRequestException) {
            throw error;
          }
          this.logger.error(
            `Error parsing scheduled time for pickup confirmation: bookingId=${bookingId}, farmerId=${farmerId}`,
            (error as Error)?.stack ?? String(error),
          );
          // Don't block confirmation if there's an error parsing the time
        }
      }
    }

    // Generate batch ID and QR code (per lifecycle: batch traceability starts)
    let batchId: string;
    let qrCode: string;
    try {
      const { batchId: generatedBatchId, qrCode: generatedQRCode } = generateBatchTraceability();
      batchId = data.batchId || generatedBatchId;
      // QR code should be based on the actual batchId used
      qrCode = data.batchId ? `QR-${data.batchId}` : generatedQRCode;
      this.logger.debug(
        `Batch traceability generated: bookingId=${bookingId}, batchId=${batchId}, qrCode=${qrCode}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate batch traceability: bookingId=${bookingId}, farmerId=${farmerId}`,
        (error as Error)?.stack ?? String(error),
      );
      throw new BadRequestException(`Failed to generate batch ID: ${(error as Error)?.message ?? String(error)}`);
    }

    // Generate receipt number
    let receiptNumber: Array<{ generate_pickup_receipt_number: string }>;
    try {
      receiptNumber = await this.prisma.$queryRaw<Array<{ generate_pickup_receipt_number: string }>>`
        SELECT generate_pickup_receipt_number() as generate_pickup_receipt_number
      `;
      this.logger.debug(
        `Receipt number generated: bookingId=${bookingId}, receiptNumber=${receiptNumber[0]?.generate_pickup_receipt_number}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate receipt number: bookingId=${bookingId}, farmerId=${farmerId}`,
        (error as Error)?.stack ?? String(error),
      );
      throw new BadRequestException(`Failed to generate receipt number: ${(error as Error)?.message ?? String(error)}`);
    }

    // Create receipt and update booking in a transaction (per lifecycle: receipt + batch created)
    let result;
    try {
      this.logger.debug(
        `Starting transaction for pickup confirmation: bookingId=${bookingId}, batchId=${batchId}, receiptNumber=${receiptNumber[0]?.generate_pickup_receipt_number}`,
      );
      result = await this.prisma.$transaction(async (tx) => {
        // Create pickup receipt
        let receipt;
        try {
          receipt = await tx.pickupReceipt.create({
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
          this.logger.debug(
            `Pickup receipt created: receiptId=${receipt.id}, bookingId=${bookingId}, batchId=${batchId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to create pickup receipt in transaction: bookingId=${bookingId}, batchId=${batchId}, providerId=${booking.slot.schedule.providerId}, aggregationCenterId=${booking.slot.schedule.aggregationCenterId}`,
            (error as Error)?.stack ?? String(error),
          );
          throw error;
        }

        // Create stock transaction with PENDING_CONFIRMATION status
        // This starts the stock/inventory lifecycle at pickup confirmation
        let stockTransaction;
        try {
          // Generate transaction number
          const transactionNumber = await tx.$queryRaw<Array<{ generate_stock_transaction_number: string }>>`
            SELECT generate_stock_transaction_number() as generate_stock_transaction_number
          `;

          // Get farmer name from profile
          const farmerProfile = await tx.profile.findUnique({
            where: { userId: booking.farmerId },
            select: { firstName: true, lastName: true },
          });
          const farmerName = farmerProfile 
            ? `${farmerProfile.firstName} ${farmerProfile.lastName}`
            : undefined;

          stockTransaction = await tx.stockTransaction.create({
            data: {
              transactionNumber: transactionNumber[0].generate_stock_transaction_number,
              centerId: booking.slot.schedule.aggregationCenterId,
              centerName: booking.slot.schedule.aggregationCenter.name,
              type: 'STOCK_IN',
              variety: data.variety,
              quantity: booking.quantity,
              qualityGrade: data.qualityGrade as any,
              farmerId: booking.farmerId,
              farmerName: farmerName,
              batchId: batchId,
              qrCode: qrCode,
              photos: data.photos || [],
              notes: data.notes || `Created from pickup confirmation. Booking ID: ${bookingId}`,
              status: 'PENDING_CONFIRMATION', // Awaiting aggregation center confirmation
              createdBy: farmerId,
            },
          });
          this.logger.debug(
            `Stock transaction created: transactionId=${stockTransaction.id}, batchId=${batchId}, status=PENDING_CONFIRMATION`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to create stock transaction in transaction: bookingId=${bookingId}, batchId=${batchId}, centerId=${booking.slot.schedule.aggregationCenterId}`,
            (error as Error)?.stack ?? String(error),
          );
          throw error;
        }

        // Update booking with confirmation data
        let updatedBooking;
        try {
          updatedBooking = await tx.pickupSlotBooking.update({
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
                      provider: {
                        include: {
                          profile: true,
                        },
                      },
                    },
                  },
                },
              },
              pickupReceipt: {
                include: {
                  aggregationCenter: true,
                },
              },
              farmer: {
                include: {
                  profile: true,
                },
              },
            },
          });
          this.logger.debug(
            `Booking updated with confirmation: bookingId=${bookingId}, receiptId=${receipt.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update booking in transaction: bookingId=${bookingId}, receiptId=${receipt.id}`,
            (error as Error)?.stack ?? String(error),
          );
          throw error;
        }

        return { booking: updatedBooking, receipt, stockTransaction };
      });
      this.logger.log(
        `Pickup confirmation transaction completed successfully: bookingId=${bookingId}, batchId=${batchId}, receiptId=${result.receipt.id}, receiptNumber=${receiptNumber[0]?.generate_pickup_receipt_number}`,
      );
    } catch (error) {
      this.logger.error(
        `confirmPickup transaction failed: bookingId=${bookingId}, farmerId=${farmerId}, batchId=${batchId}, receiptNumber=${receiptNumber[0]?.generate_pickup_receipt_number}, error=${(error as Error)?.message ?? String(error)}`,
        (error as Error)?.stack ?? String(error),
      );
      throw error;
    }

    // Create notifications (per lifecycle: farmer + provider + aggregation center manager)
    try {
      const centerManagerId = booking.slot.schedule.aggregationCenter.managerId;
      const notificationCount = centerManagerId ? 3 : 2;
      this.logger.debug(
        `Creating ${notificationCount} notifications for pickup confirmation: bookingId=${bookingId}, farmerId=${farmerId}, providerId=${booking.slot.schedule.providerId}, centerManagerId=${centerManagerId || 'none'}`,
      );
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
      this.logger.debug(
        `Notifications created successfully: bookingId=${bookingId}, notificationCount=${notificationCount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create notifications for pickup confirmation: bookingId=${bookingId}, farmerId=${farmerId}, providerId=${booking.slot.schedule.providerId}, batchId=${batchId}`,
        (error as Error)?.stack ?? String(error),
      );
      // Don't throw - notifications are non-critical
    }

    // Create activity log
    try {
      this.logger.debug(
        `Creating activity log for pickup confirmation: bookingId=${bookingId}, farmerId=${farmerId}`,
      );
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
      this.logger.debug(
        `Activity log created successfully: bookingId=${bookingId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create activity log for pickup confirmation: bookingId=${bookingId}, farmerId=${farmerId}, batchId=${batchId}`,
        (error as Error)?.stack ?? String(error),
      );
      // Don't throw - activity logs are non-critical
    }

    this.logger.log(
      `Pickup confirmation completed successfully: bookingId=${bookingId}, farmerId=${farmerId}, batchId=${batchId}, receiptId=${result.receipt.id}, receiptNumber=${receiptNumber[0]?.generate_pickup_receipt_number}`,
    );

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

  async getScheduleBookings(scheduleId: string, filters?: {
    status?: string;
  }) {
    // Verify schedule exists and get provider info
    const schedule = await this.getPickupScheduleById(scheduleId);
    
    const where: any = {
      scheduleId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    const bookings = await this.prisma.pickupSlotBooking.findMany({
      where,
      include: {
        farmer: {
          select: {
            id: true,
            email: true,
            phone: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        slot: {
          include: {
            location: true,
          },
        },
        pickupReceipt: true,
      },
      orderBy: { bookedAt: 'desc' },
    });

    // Transform to include farmer name
    return bookings.map(booking => ({
      ...booking,
      farmerName: booking.farmer.profile
        ? `${booking.farmer.profile.firstName} ${booking.farmer.profile.lastName}`
        : booking.farmer.email || booking.farmer.phone,
    }));
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

    try {
      // Use provided timestamp if available, otherwise use current time
      const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
      
      const trackingUpdate = await this.prisma.trackingUpdate.create({
        data: {
          requestId: requestId,
          location: data.location,
          coordinates: data.coordinates,
          status: data.status,
          notes: data.notes,
          updatedBy: userId,
          createdAt: timestamp, // Use captured timestamp
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
          coordinates: data.coordinates,
          orderId: request.orderId,
          orderNumber: request.order?.orderNumber,
          type: request.type,
        },
      });

      // Create notification for requester (buyer) about location update
      try {
        if (request.requesterId) {
          let message = `Transport request #${request.requestNumber} location updated: ${data.location}`;
          
          if (request.type === 'ORDER_DELIVERY' && request.order) {
            message = `Order #${request.order.orderNumber} location update: ${data.location}`;
          }

          await this.notificationHelperService.createNotification({
            userId: request.requesterId,
            type: 'TRANSPORT',
            title: 'Location Update',
            message,
            priority: 'LOW',
            entityType: 'TRANSPORT',
            entityId: requestId,
            actionUrl: `/transport/${requestId}`,
            actionLabel: 'Track Delivery',
            metadata: {
              requestNumber: request.requestNumber,
              location: data.location,
              coordinates: data.coordinates,
              trackingUpdateId: trackingUpdate.id,
              orderId: request.orderId,
              orderNumber: request.order?.orderNumber,
              type: request.type,
            },
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to create notification for tracking update (requestId=${requestId}):`, error);
        // Don't throw - notification failures shouldn't block tracking update
      }

      return trackingUpdate;
    } catch (error) {
      this.logger.error(
        `addTrackingUpdate failed (requestId=${requestId}, userId=${userId})`,
        (error as Error)?.stack ?? String(error),
      );
      throw error;
    }
  }

  // ============ Active Deliveries ============

  async getActiveDeliveries(filters?: {
    providerId?: string;
    requesterId?: string;
  }) {
    const where: any = {
      OR: [
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
