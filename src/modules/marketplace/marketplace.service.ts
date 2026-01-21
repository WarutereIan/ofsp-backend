import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { generateBatchTraceability } from '../../common/utils/traceability.util';
import {
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  CreateRFQDto,
  CreateRFQResponseDto,
  CreateSourcingRequestDto,
  CreateSupplierOfferDto,
  CreateNegotiationDto,
  SendNegotiationMessageDto,
} from './dto';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private notificationHelperService: NotificationHelperService,
    private activityLogService: ActivityLogService,
  ) {}

  // Helper to convert DTO variety enum to Prisma enum format
  private convertVarietyToPrismaEnum(variety: string): string {
    const mapping: Record<string, string> = {
      'Kenya': 'KENYA',
      'SPK004': 'SPK004',
      'Kakamega': 'KAKAMEGA',
      'Kabode': 'KABODE',
      'Other': 'OTHER',
    };
    return mapping[variety] || variety.toUpperCase();
  }

  // Valid status transitions
  private readonly validStatusTransitions: Record<string, string[]> = {
    ORDER_PLACED: ['ORDER_ACCEPTED', 'ORDER_REJECTED', 'CANCELLED'],
    ORDER_ACCEPTED: ['PAYMENT_SECURED', 'ORDER_REJECTED', 'CANCELLED'],
    PAYMENT_SECURED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['AT_AGGREGATION', 'CANCELLED'],
    AT_AGGREGATION: ['QUALITY_CHECKED', 'CANCELLED'],
    QUALITY_CHECKED: ['QUALITY_APPROVED', 'QUALITY_REJECTED'],
    QUALITY_APPROVED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
    QUALITY_REJECTED: ['CANCELLED', 'REFUNDED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['COMPLETED', 'DISPUTED'],
    COMPLETED: [],
    ORDER_REJECTED: [],
    CANCELLED: [],
    REFUNDED: [],
    DISPUTED: [],
  };

  // ============ Produce Listings ============

  async getListings(filters?: {
    farmerId?: string;
    variety?: string;
    county?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const where: any = {};

    if (filters?.farmerId) {
      where.farmerId = filters.farmerId;
    }
    if (filters?.variety) {
      where.variety = filters.variety;
    }
    if (filters?.county) {
      where.county = filters.county;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.minPrice || filters?.maxPrice) {
      where.pricePerKg = {};
      if (filters.minPrice) {
        where.pricePerKg.gte = filters.minPrice;
      }
      if (filters.maxPrice) {
        where.pricePerKg.lte = filters.maxPrice;
      }
    }

    return this.prisma.produceListing.findMany({
      where,
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
        negotiations: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getListingById(id: string) {
    const listing = await this.prisma.produceListing.findUnique({
      where: { id },
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
        negotiations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    return listing;
  }

  async createListing(data: CreateListingDto, farmerId: string) {
    return this.prisma.produceListing.create({
      data: {
        farmerId,
        variety: data.variety as any,
        quantity: data.quantity,
        availableQuantity: data.quantity, // Initially same as quantity
        pricePerKg: data.pricePerKg,
        qualityGrade: data.qualityGrade as any,
        harvestDate: data.harvestDate ? new Date(data.harvestDate) : new Date(),
        county: data.county,
        subCounty: data.subcounty,
        location: data.location || data.county,
        description: data.description,
        photos: data.photos || [],
        batchId: data.batchId,
      },
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async updateListing(id: string, data: UpdateListingDto, farmerId: string) {
    const listing = await this.getListingById(id);

    if (listing.farmerId !== farmerId) {
      throw new BadRequestException('You can only update your own listings');
    }

    return this.prisma.produceListing.update({
      where: { id },
      data: {
        ...(data.variety && { variety: data.variety as any }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.availableQuantity !== undefined && { availableQuantity: data.availableQuantity }),
        ...(data.qualityGrade && { qualityGrade: data.qualityGrade as any }),
        ...(data.pricePerKg !== undefined && { pricePerKg: data.pricePerKg }),
        ...(data.county && { county: data.county }),
        ...(data.subcounty && { subCounty: data.subcounty }),
        ...(data.ward && { ward: data.ward }),
        ...(data.location && { location: data.location }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.photos && { photos: data.photos }),
        ...(data.status && { status: data.status as any }),
      },
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async deleteListing(id: string, farmerId: string) {
    const listing = await this.getListingById(id);

    if (listing.farmerId !== farmerId) {
      throw new BadRequestException('You can only delete your own listings');
    }

    return this.prisma.produceListing.delete({
      where: { id },
    });
  }

  // ============ Marketplace Orders ============

  async getOrders(filters?: {
    buyerId?: string;
    farmerId?: string;
    status?: string;
    listingId?: string;
  }) {
    const where: any = {};

    if (filters?.buyerId) {
      where.buyerId = filters.buyerId;
    }
    if (filters?.farmerId) {
      where.farmerId = filters.farmerId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.listingId) {
      where.listingId = filters.listingId;
    }

    return this.prisma.marketplaceOrder.findMany({
      where,
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
        listing: true,
        payment: true,
        escrow: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(id: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
        listing: true,
        payment: true,
        escrow: true,
        rfq: true,
        rfqResponse: true,
        sourcingRequest: true,
        supplierOffer: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async createOrder(data: CreateOrderDto, buyerId: string) {
    // Generate order number using database function
    const orderNumber = await this.prisma.$queryRaw<Array<{ generate_order_number: string }>>`
      SELECT generate_order_number() as generate_order_number
    `;

    // Generate batch ID and QR code for traceability
    const { batchId, qrCode } = generateBatchTraceability();

    const totalAmount = data.quantity * data.pricePerKg;

    // Get buyer and farmer info for notifications
    const [buyer, farmer] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: buyerId },
        include: { profile: true },
      }),
      this.prisma.user.findUnique({
        where: { id: data.farmerId },
        include: { profile: true },
      }),
    ]);

    // Create order
    const order = await this.prisma.marketplaceOrder.create({
      data: {
        buyerId,
        farmerId: data.farmerId,
        orderNumber: orderNumber[0].generate_order_number,
        listingId: data.listingId,
        variety: data.variety as any,
        quantity: data.quantity,
        pricePerKg: data.pricePerKg,
        totalAmount,
        deliveryAddress: data.deliveryAddress || '',
        deliveryCounty: data.deliveryCounty,
        deliveryNotes: data.notes,
        rfqResponseId: data.rfqResponseId,
        supplierOfferId: data.supplierOfferId,
        batchId,
        qrCode,
        status: 'ORDER_PLACED',
      },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
        listing: true,
      },
    });

    // Update negotiation status if order created from negotiation
    if (data.negotiationId) {
      await this.prisma.negotiation.update({
        where: { id: data.negotiationId },
        data: {
          status: 'CONVERTED',
          orderId: order.id,
        },
      });
    }

    // Update RFQ response status if order created from RFQ response
    if (data.rfqResponseId) {
      await this.prisma.rFQResponse.update({
        where: { id: data.rfqResponseId },
        data: { status: 'AWARDED' },
      });
    }

    // Update supplier offer status and link to order if order created from supplier offer
    if (data.supplierOfferId) {
      await this.prisma.supplierOffer.update({
        where: { id: data.supplierOfferId },
        data: { 
          status: 'converted',
          orderId: order.id,
        },
      });
      
      // Update sourcing request fulfilled quantity
      const offer = await this.prisma.supplierOffer.findUnique({
        where: { id: data.supplierOfferId },
        include: { sourcingRequest: true },
      });
      
      if (offer) {
        const newFulfilled = (offer.sourcingRequest.fulfilled || 0) + offer.quantity;
        const isFullyFulfilled = newFulfilled >= offer.sourcingRequest.quantity;
        
        await this.prisma.sourcingRequest.update({
          where: { id: offer.sourcingRequest.id },
          data: {
            fulfilled: newFulfilled,
            status: isFullyFulfilled ? 'FULFILLED' : offer.sourcingRequest.status,
          },
        });
      }
    }

    // Create notifications
    await this.notificationHelperService.notifyOrderPlaced(order, buyer, farmer);

    // Create activity logs
    await Promise.all([
      this.activityLogService.logOrderCreated(order, buyerId, { source: 'marketplace' }),
      this.activityLogService.logOrderCreated(order, data.farmerId, { source: 'marketplace' }),
    ]);

    return order;
  }

  async updateOrderStatus(id: string, data: UpdateOrderStatusDto, userId: string) {
    const order = await this.getOrderById(id);
    const oldStatus = order.status;
    const newStatus = data.status;

    // Verify user has permission to update
    // Allow buyer, farmer, aggregation managers, and admins
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isBuyerOrFarmer = order.buyerId === userId || order.farmerId === userId;
    const isSystemUser = user?.role === 'AGGREGATION_MANAGER' || user?.role === 'ADMIN' || user?.role === 'STAFF';
    const isTransportProvider = user?.role === 'TRANSPORT_PROVIDER';

    if (!isBuyerOrFarmer && !isSystemUser && !isTransportProvider) {
      throw new BadRequestException('You can only update your own orders');
    }

    // Validate status transition
    // System users (aggregation managers, admins, staff) and transport providers can bypass normal transition rules
    const validTransitions = this.validStatusTransitions[oldStatus] || [];
    if (!validTransitions.includes(newStatus) && !isSystemUser && !isTransportProvider) {
      throw new BadRequestException(
        `Invalid status transition from ${oldStatus} to ${newStatus}. Valid transitions: ${validTransitions.join(', ')}`,
      );
    }

    // Status-specific logic
    const updateData: any = { status: newStatus as any };

    // Update status history
    const statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      changedBy: userId,
    });
    updateData.statusHistory = statusHistory;

    // Handle status-specific actions
    if (newStatus === 'ORDER_ACCEPTED') {
      // Escrow will be created when payment is made, not here
      // But we can prepare for it
    } else if (newStatus === 'DELIVERED') {
      updateData.actualDeliveryDate = new Date();
    } else if (newStatus === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    // Update order
    const updatedOrder = await this.prisma.marketplaceOrder.update({
      where: { id },
      data: updateData,
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
        listing: true,
        payment: true,
        escrow: true,
      },
    });

    // Create notifications
    await this.notificationHelperService.notifyOrderStatusChange(updatedOrder, newStatus, { id: userId });

    // Create activity log
    await this.activityLogService.logOrderStatusChange(updatedOrder, oldStatus, newStatus, userId);

    return updatedOrder;
  }

  // ============ RFQs ============

  async getRFQs(filters?: {
    buyerId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.buyerId) {
      where.buyerId = filters.buyerId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.rFQ.findMany({
      where,
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        responses: {
          include: {
            supplier: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRFQById(id: string) {
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        responses: {
          include: {
            supplier: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!rfq) {
      throw new NotFoundException(`RFQ with ID ${id} not found`);
    }

    return rfq;
  }

  async createRFQ(data: CreateRFQDto, buyerId: string) {
    // Generate RFQ number
    const rfqNumber = await this.prisma.$queryRaw<Array<{ generate_rfq_number: string }>>`
      SELECT generate_rfq_number() as generate_rfq_number
    `;

    // Auto-generate title if not provided
    const title = data.title || `RFQ for ${data.variety} - ${data.quantity}${data.unit || 'kg'}`;
    const unit = data.unit || 'kg';

    const rfq = await this.prisma.rFQ.create({
      data: {
        buyerId,
        rfqNumber: rfqNumber[0].generate_rfq_number,
        title,
        productType: data.productType as any,
        variety: data.variety as any,
        quantity: data.quantity,
        unit,
        qualityGrade: data.qualityGrade as any,
        deadline: new Date(data.deliveryDate),
        quoteDeadline: data.quoteDeadline ? new Date(data.quoteDeadline) : new Date(data.deliveryDate),
        deliveryLocation: data.deliveryLocation,
        additionalRequirements: data.description,
        status: 'DRAFT',
      },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create notifications (per lifecycle: buyer)
    try {
      await this.notificationHelperService.createNotification({
        userId: buyerId,
        type: 'RFQ',
        title: 'RFQ Draft Saved',
        message: `RFQ draft saved: ${title}`,
        priority: 'LOW',
        entityType: 'RFQ',
        entityId: rfq.id,
        actionUrl: `/rfqs/${rfq.id}`,
        actionLabel: 'View RFQ',
        metadata: { rfqNumber: rfq.rfqNumber },
      });
    } catch (error) {
      console.error('Failed to create notification for RFQ creation:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'RFQ_CREATED',
        entityType: 'RFQ',
        entityId: rfq.id,
        metadata: { rfqNumber: rfq.rfqNumber, status: 'DRAFT' },
      });
    } catch (error) {
      console.error('Failed to create activity log for RFQ creation:', error);
    }

    return rfq;
  }

  async updateRFQ(id: string, data: Partial<CreateRFQDto>, buyerId: string) {
    const rfq = await this.getRFQById(id);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only update your own RFQs');
    }

    return this.prisma.rFQ.update({
      where: { id },
      data: {
        ...(data.variety && { variety: data.variety as any }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.qualityGrade && { qualityGrade: data.qualityGrade as any }),
        ...(data.deliveryDate && { deadline: new Date(data.deliveryDate) }),
        ...(data.quoteDeadline && { quoteDeadline: new Date(data.quoteDeadline) }),
        ...(data.deliveryLocation && { deliveryLocation: data.deliveryLocation }),
        ...(data.description && { description: data.description }),
      },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async publishRFQ(id: string, buyerId: string) {
    const rfq = await this.getRFQById(id);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only publish your own RFQs');
    }

    const updatedRFQ = await this.prisma.rFQ.update({
      where: { id },
      data: { 
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Create notifications (per lifecycle: buyer, and potentially suppliers)
    try {
      await this.notificationHelperService.createNotification({
        userId: buyerId,
        type: 'RFQ',
        title: 'RFQ Published',
        message: `RFQ #${rfq.rfqNumber} published successfully`,
        priority: 'MEDIUM',
        entityType: 'RFQ',
        entityId: id,
        actionUrl: `/rfqs/${id}`,
        actionLabel: 'View RFQ',
        metadata: { rfqNumber: rfq.rfqNumber },
      });
      // Note: Supplier notifications would typically be sent via a notification service
      // that broadcasts to all relevant suppliers based on their preferences
    } catch (error) {
      console.error('Failed to create notification for RFQ publish:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'RFQ_PUBLISHED',
        entityType: 'RFQ',
        entityId: id,
        metadata: { rfqNumber: rfq.rfqNumber },
      });
    } catch (error) {
      console.error('Failed to create activity log for RFQ publish:', error);
    }

    return updatedRFQ;
  }

  async closeRFQ(id: string, buyerId: string) {
    const rfq = await this.getRFQById(id);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only close your own RFQs');
    }

    const updatedRFQ = await this.prisma.rFQ.update({
      where: { id },
      data: { 
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    // Create notifications (per lifecycle: buyer, and potentially suppliers)
    try {
      await this.notificationHelperService.createNotification({
        userId: buyerId,
        type: 'RFQ',
        title: 'RFQ Closed',
        message: `RFQ #${rfq.rfqNumber} closed`,
        priority: 'MEDIUM',
        entityType: 'RFQ',
        entityId: id,
        actionUrl: `/rfqs/${id}`,
        actionLabel: 'View RFQ',
        metadata: { rfqNumber: rfq.rfqNumber },
      });
      // Note: Supplier notifications would typically be sent to all suppliers who submitted responses
    } catch (error) {
      console.error('Failed to create notification for RFQ close:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'RFQ_CLOSED',
        entityType: 'RFQ',
        entityId: id,
        metadata: { rfqNumber: rfq.rfqNumber },
      });
    } catch (error) {
      console.error('Failed to create activity log for RFQ close:', error);
    }

    return updatedRFQ;
  }

  // ============ RFQ Responses ============

  async getRFQResponses(filters?: {
    rfqId?: string;
    supplierId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.rfqId) {
      where.rfqId = filters.rfqId;
    }
    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.rFQResponse.findMany({
      where,
      include: {
        rfq: {
          include: {
            buyer: {
              include: {
                profile: true,
              },
            },
          },
        },
        supplier: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRFQResponseById(id: string) {
    const response = await this.prisma.rFQResponse.findUnique({
      where: { id },
      include: {
        rfq: {
          include: {
            buyer: {
              include: {
                profile: true,
              },
            },
          },
        },
        supplier: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!response) {
      throw new NotFoundException(`RFQ Response with ID ${id} not found`);
    }

    return response;
  }

  async submitRFQResponse(data: CreateRFQResponseDto, supplierId: string) {
    const rfq = await this.getRFQById(data.rfqId);
    
    // Validate RFQ is published
    if (rfq.status !== 'PUBLISHED') {
      throw new BadRequestException('RFQ must be published to accept responses');
    }
    
    // Check if quote deadline has passed
    if (rfq.quoteDeadline && new Date(rfq.quoteDeadline) < new Date()) {
      throw new BadRequestException('Quote submission deadline has passed');
    }
    
    const totalAmount = rfq.quantity * data.pricePerKg;
    const submittedAt = new Date();
    
    // Create response and update RFQ in a transaction
    const [response] = await Promise.all([
      this.prisma.rFQResponse.create({
        data: {
          rfqId: data.rfqId,
          supplierId,
          quantity: rfq.quantity,
          quantityUnit: rfq.unit,
          pricePerUnit: data.pricePerKg,
          priceUnit: 'kg',
          totalAmount,
          qualityGrade: rfq.qualityGrade || 'A' as any,
          deliveryTime: data.deliveryDate,
          deliveryLocation: rfq.deliveryLocation,
          notes: data.notes,
          status: 'SUBMITTED',
          submittedAt,
        },
        include: {
          rfq: true,
          supplier: {
            include: {
              profile: true,
            },
          },
        },
      }),
      // Increment totalResponses on RFQ
      this.prisma.rFQ.update({
        where: { id: data.rfqId },
        data: {
          totalResponses: {
            increment: 1,
          },
        },
      }),
    ]);
    
    // Create notifications (per lifecycle: buyer, supplier)
    try {
      // To Buyer
      await this.notificationHelperService.createNotification({
        userId: rfq.buyerId,
        type: 'RFQ',
        title: 'New Quote Received',
        message: `New quote received for RFQ #${rfq.rfqNumber} from ${response.supplier.profile?.firstName || 'Supplier'}`,
        priority: 'MEDIUM',
        entityType: 'RFQ',
        entityId: rfq.id,
        actionUrl: `/rfqs/${rfq.id}/responses`,
        actionLabel: 'View Response',
        metadata: { rfqNumber: rfq.rfqNumber, responseId: response.id },
      });
      
      // To Supplier
      await this.notificationHelperService.createNotification({
        userId: supplierId,
        type: 'RFQ_RESPONSE',
        title: 'Quote Submitted',
        message: `Your quote for RFQ #${rfq.rfqNumber} has been submitted successfully`,
        priority: 'LOW',
        entityType: 'RFQ_RESPONSE',
        entityId: response.id,
        actionUrl: `/rfqs/${rfq.id}/responses/${response.id}`,
        actionLabel: 'View Response',
        metadata: { rfqNumber: rfq.rfqNumber },
      });
    } catch (error) {
      console.error('Failed to create notifications for RFQ response:', error);
    }
    
    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: supplierId,
          action: 'RFQ_RESPONSE_SUBMITTED',
          entityType: 'RFQ_RESPONSE',
          entityId: response.id,
          metadata: { rfqId: rfq.id, rfqNumber: rfq.rfqNumber },
        }),
        this.activityLogService.createActivityLog({
          userId: rfq.buyerId,
          action: 'RFQ_RESPONSE_RECEIVED',
          entityType: 'RFQ',
          entityId: rfq.id,
          metadata: { responseId: response.id, supplierId },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for RFQ response:', error);
    }
    
    return response;
  }

  async updateRFQResponseStatus(id: string, status: string, buyerId: string) {
    const response = await this.getRFQResponseById(id);

    // Verify buyer owns the RFQ
    const rfq = await this.getRFQById(response.rfqId);
    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only update responses to your own RFQs');
    }

    return this.prisma.rFQResponse.update({
      where: { id },
      data: { status: status as any },
      include: {
        rfq: true,
        supplier: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async awardRFQ(rfqId: string, responseId: string, buyerId: string) {
    const rfq = await this.getRFQById(rfqId);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only award your own RFQs');
    }

    // Update response status to AWARDED
    const response = await this.prisma.rFQResponse.update({
      where: { id: responseId },
      data: { status: 'AWARDED' },
    });

    // Update RFQ status
    await this.prisma.rFQ.update({
      where: { id: rfqId },
      data: { status: 'AWARDED' },
    });

    return response;
  }

  // ============ Sourcing Requests ============

  async getSourcingRequests(filters?: {
    buyerId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.buyerId) {
      where.buyerId = filters.buyerId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.sourcingRequest.findMany({
      where,
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        offers: {
          include: {
            farmer: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSourcingRequestById(id: string) {
    const request = await this.prisma.sourcingRequest.findUnique({
      where: { id },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
        offers: {
          include: {
            farmer: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Sourcing Request with ID ${id} not found`);
    }

    return request;
  }

  async createSourcingRequest(data: CreateSourcingRequestDto, buyerId: string) {
    // Generate sourcing request ID
    const requestId = await this.prisma.$queryRaw<Array<{ generate_sourcing_request_id: string }>>`
      SELECT generate_sourcing_request_id() as generate_sourcing_request_id
    `;

    // Auto-generate title if not provided
    const title = data.title || `Sourcing Request for ${data.variety} - ${data.quantity}${data.unit || 'kg'}`;
    const unit = data.unit || 'kg';

    const sourcingRequest = await this.prisma.sourcingRequest.create({
      data: {
        buyerId,
        requestId: requestId[0].generate_sourcing_request_id,
        title,
        productType: data.productType as any,
        variety: data.variety as any,
        quantity: data.quantity,
        unit,
        qualityGrade: data.qualityGrade as any,
        deadline: new Date(data.deliveryDate),
        deliveryRegion: data.deliveryLocation,
        additionalRequirements: data.description,
        status: 'DRAFT',
      },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create notifications (per lifecycle: buyer)
    try {
      await this.notificationHelperService.createNotification({
        userId: buyerId,
        type: 'SOURCING_REQUEST',
        title: 'Sourcing Request Draft Saved',
        message: `Sourcing request draft saved: ${title}`,
        priority: 'LOW',
        entityType: 'SOURCING_REQUEST',
        entityId: sourcingRequest.id,
        actionUrl: `/sourcing-requests/${sourcingRequest.id}`,
        actionLabel: 'View Request',
        metadata: { requestId: sourcingRequest.requestId },
      });
    } catch (error) {
      console.error('Failed to create notification for sourcing request creation:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'SOURCING_REQUEST_CREATED',
        entityType: 'SOURCING_REQUEST',
        entityId: sourcingRequest.id,
        metadata: { requestId: sourcingRequest.requestId, status: 'DRAFT' },
      });
    } catch (error) {
      console.error('Failed to create activity log for sourcing request creation:', error);
    }

    return sourcingRequest;
  }

  async publishSourcingRequest(id: string, buyerId: string) {
    const request = await this.getSourcingRequestById(id);

    if (request.buyerId !== buyerId) {
      throw new BadRequestException('You can only publish your own sourcing requests');
    }

    const updatedRequest = await this.prisma.sourcingRequest.update({
      where: { id },
      data: { 
        status: 'OPEN',
      },
    });

    // Create notifications (per lifecycle: buyer, and potentially suppliers)
    try {
      await this.notificationHelperService.createNotification({
        userId: buyerId,
        type: 'SOURCING_REQUEST',
        title: 'Sourcing Request Published',
        message: `Sourcing request #${request.requestId} published successfully`,
        priority: 'MEDIUM',
        entityType: 'SOURCING_REQUEST',
        entityId: id,
        actionUrl: `/sourcing-requests/${id}`,
        actionLabel: 'View Request',
        metadata: { requestId: request.requestId },
      });
      // Note: Supplier notifications would typically be sent via a notification service
      // that broadcasts to all relevant suppliers based on their preferences
    } catch (error) {
      console.error('Failed to create notification for sourcing request publish:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'SOURCING_REQUEST_PUBLISHED',
        entityType: 'SOURCING_REQUEST',
        entityId: id,
        metadata: { requestId: request.requestId },
      });
    } catch (error) {
      console.error('Failed to create activity log for sourcing request publish:', error);
    }

    return updatedRequest;
  }

  async closeSourcingRequest(id: string, buyerId: string) {
    const request = await this.getSourcingRequestById(id);

    if (request.buyerId !== buyerId) {
      throw new BadRequestException('You can only close your own sourcing requests');
    }

    const updatedRequest = await this.prisma.sourcingRequest.update({
      where: { id },
      data: { 
        status: 'CLOSED',
      },
    });

    // Create notifications (per lifecycle: buyer, and potentially suppliers)
    try {
      await this.notificationHelperService.createNotification({
        userId: buyerId,
        type: 'SOURCING_REQUEST',
        title: 'Sourcing Request Closed',
        message: `Sourcing request #${request.requestId} closed`,
        priority: 'MEDIUM',
        entityType: 'SOURCING_REQUEST',
        entityId: id,
        actionUrl: `/sourcing-requests/${id}`,
        actionLabel: 'View Request',
        metadata: { requestId: request.requestId },
      });
      // Note: Supplier notifications would typically be sent to all suppliers who submitted offers
    } catch (error) {
      console.error('Failed to create notification for sourcing request close:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'SOURCING_REQUEST_CLOSED',
        entityType: 'SOURCING_REQUEST',
        entityId: id,
        metadata: { requestId: request.requestId },
      });
    } catch (error) {
      console.error('Failed to create activity log for sourcing request close:', error);
    }

    return updatedRequest;
  }

  async submitSupplierOffer(data: CreateSupplierOfferDto, farmerId: string) {
    const request = await this.getSourcingRequestById(data.sourcingRequestId);
    
    // Validate request is open
    if (request.status !== 'OPEN') {
      throw new BadRequestException('Sourcing request must be open to accept offers');
    }
    
    // Check if deadline has passed
    if (request.deadline && new Date(request.deadline) < new Date()) {
      throw new BadRequestException('Sourcing request deadline has passed');
    }

    const offer = await this.prisma.supplierOffer.create({
      data: {
        sourcingRequestId: data.sourcingRequestId,
        farmerId,
        quantity: request.quantity,
        quantityUnit: request.unit,
        pricePerKg: data.pricePerKg,
        qualityGrade: request.qualityGrade || 'A' as any,
        status: 'pending',
      },
      include: {
        sourcingRequest: {
          include: {
            buyer: {
              include: {
                profile: true,
              },
            },
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Update sourcing request suppliers array
    await this.prisma.sourcingRequest.update({
      where: { id: data.sourcingRequestId },
      data: {
        suppliers: {
          push: farmerId,
        },
      },
    });

    // Create notifications (per lifecycle: buyer, supplier)
    try {
      await Promise.all([
        this.notificationHelperService.createNotification({
          userId: request.buyerId,
          type: 'SOURCING_REQUEST',
          title: 'New Offer Received',
          message: `New offer received for sourcing request #${request.requestId} from ${offer.farmer.profile?.firstName || 'Supplier'}`,
          priority: 'MEDIUM',
          entityType: 'SOURCING_REQUEST',
          entityId: request.id,
          actionUrl: `/sourcing-requests/${request.id}/offers`,
          actionLabel: 'View Offer',
          metadata: { requestId: request.requestId, offerId: offer.id },
        }),
        this.notificationHelperService.createNotification({
          userId: farmerId,
          type: 'SUPPLIER_OFFER',
          title: 'Offer Submitted',
          message: `Offer submitted successfully for sourcing request #${request.requestId}`,
          priority: 'LOW',
          entityType: 'SUPPLIER_OFFER',
          entityId: offer.id,
          actionUrl: `/sourcing-requests/${request.id}/offers/${offer.id}`,
          actionLabel: 'View Offer',
          metadata: { requestId: request.requestId },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for supplier offer:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: farmerId,
          action: 'SUPPLIER_OFFER_SUBMITTED',
          entityType: 'SUPPLIER_OFFER',
          entityId: offer.id,
          metadata: { sourcingRequestId: request.id, requestId: request.requestId },
        }),
        this.activityLogService.createActivityLog({
          userId: request.buyerId,
          action: 'SUPPLIER_OFFER_RECEIVED',
          entityType: 'SOURCING_REQUEST',
          entityId: request.id,
          metadata: { offerId: offer.id, supplierId: farmerId },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for supplier offer:', error);
    }

    return offer;
  }

  async acceptSupplierOffer(offerId: string, buyerId: string) {
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id: offerId },
      include: {
        sourcingRequest: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException(`Supplier Offer with ID ${offerId} not found`);
    }

    if (offer.sourcingRequest.buyerId !== buyerId) {
      throw new BadRequestException('You can only accept offers for your own sourcing requests');
    }

    const updatedOffer = await this.prisma.supplierOffer.update({
      where: { id: offerId },
      data: { status: 'accepted' },
      include: {
        sourcingRequest: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create notifications (per lifecycle: supplier, buyer)
    try {
      await Promise.all([
        this.notificationHelperService.createNotification({
          userId: offer.farmerId,
          type: 'SUPPLIER_OFFER',
          title: 'Offer Accepted',
          message: `Your offer for sourcing request #${offer.sourcingRequest.requestId} has been accepted`,
          priority: 'HIGH',
          entityType: 'SUPPLIER_OFFER',
          entityId: offerId,
          actionUrl: `/sourcing-requests/${offer.sourcingRequest.id}/offers/${offerId}`,
          actionLabel: 'View Offer',
          metadata: { requestId: offer.sourcingRequest.requestId },
        }),
        this.notificationHelperService.createNotification({
          userId: buyerId,
          type: 'SUPPLIER_OFFER',
          title: 'Offer Accepted',
          message: `Offer accepted. You can now convert to order`,
          priority: 'MEDIUM',
          entityType: 'SUPPLIER_OFFER',
          entityId: offerId,
          actionUrl: `/sourcing-requests/${offer.sourcingRequest.id}/offers/${offerId}`,
          actionLabel: 'Convert to Order',
          metadata: { requestId: offer.sourcingRequest.requestId },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for supplier offer acceptance:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: buyerId,
          action: 'SUPPLIER_OFFER_ACCEPTED',
          entityType: 'SUPPLIER_OFFER',
          entityId: offerId,
          metadata: { requestId: offer.sourcingRequest.requestId },
        }),
        this.activityLogService.createActivityLog({
          userId: offer.farmerId,
          action: 'SUPPLIER_OFFER_ACCEPTED',
          entityType: 'SUPPLIER_OFFER',
          entityId: offerId,
          metadata: { requestId: offer.sourcingRequest.requestId },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for supplier offer acceptance:', error);
    }

    return updatedOffer;
  }

  // ============ Negotiations ============

  async getNegotiations(filters?: {
    listingId?: string;
    buyerId?: string;
    farmerId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.listingId) {
      where.listingId = filters.listingId;
    }
    if (filters?.buyerId) {
      where.buyerId = filters.buyerId;
    }
    if (filters?.farmerId) {
      where.listing = {
        farmerId: filters.farmerId,
      };
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.negotiation.findMany({
      where,
      include: {
        listing: true,
        buyer: {
          include: {
            profile: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNegotiationById(id: string) {
    const negotiation = await this.prisma.negotiation.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            farmer: {
              include: {
                profile: true,
              },
            },
          },
        },
        buyer: {
          include: {
            profile: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!negotiation) {
      throw new NotFoundException(`Negotiation with ID ${id} not found`);
    }

    return negotiation;
  }

  async initiateNegotiation(data: CreateNegotiationDto, buyerId: string) {
    // Generate negotiation number
    const negotiationNumber = await this.prisma.$queryRaw<Array<{ generate_negotiation_number: string }>>`
      SELECT generate_negotiation_number() as generate_negotiation_number
    `;

    const listing = await this.getListingById(data.listingId);
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId }, include: { profile: true } });
    const farmer = await this.prisma.user.findUnique({ where: { id: listing.farmerId }, include: { profile: true } });
    
    const negotiation = await this.prisma.negotiation.create({
      data: {
        listingId: data.listingId,
        buyerId,
        farmerId: listing.farmerId,
        negotiationNumber: negotiationNumber[0].generate_negotiation_number,
        originalPricePerKg: listing.pricePerKg,
        originalQuantity: listing.availableQuantity,
        negotiatedPricePerKg: data.proposedPrice,
        negotiatedQuantity: data.proposedQuantity,
        status: 'PENDING',
      },
      include: {
        listing: true,
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create initial negotiation message
    if (data.message) {
      await this.prisma.negotiationMessage.create({
        data: {
          negotiationId: negotiation.id,
          senderId: buyerId,
          senderType: 'BUYER',
          message: data.message,
          pricePerKg: data.proposedPrice,
          quantity: data.proposedQuantity,
          totalAmount: data.proposedPrice * data.proposedQuantity,
          isCounterOffer: false,
        },
      });
    }

    // Create notifications (per lifecycle: farmer, buyer)
    try {
      await Promise.all([
        this.notificationHelperService.createNotification({
          userId: listing.farmerId,
          type: 'NEGOTIATION',
          title: 'New Negotiation Request',
          message: `New negotiation request from ${buyer.profile?.firstName || buyer.email || 'Buyer'} for ${listing.variety}`,
          priority: 'MEDIUM',
          entityType: 'NEGOTIATION',
          entityId: negotiation.id,
          actionUrl: `/negotiations/${negotiation.id}`,
          actionLabel: 'View Negotiation',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
        this.notificationHelperService.createNotification({
          userId: buyerId,
          type: 'NEGOTIATION',
          title: 'Negotiation Initiated',
          message: `Negotiation initiated. Waiting for farmer response`,
          priority: 'LOW',
          entityType: 'NEGOTIATION',
          entityId: negotiation.id,
          actionUrl: `/negotiations/${negotiation.id}`,
          actionLabel: 'View Negotiation',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for negotiation:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: buyerId,
          action: 'NEGOTIATION_INITIATED',
          entityType: 'NEGOTIATION',
          entityId: negotiation.id,
          metadata: { listingId: listing.id, negotiationNumber: negotiation.negotiationNumber },
        }),
        this.activityLogService.createActivityLog({
          userId: listing.farmerId,
          action: 'NEGOTIATION_RECEIVED',
          entityType: 'NEGOTIATION',
          entityId: negotiation.id,
          metadata: { listingId: listing.id, negotiationNumber: negotiation.negotiationNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for negotiation:', error);
    }

    return negotiation;
  }

  async sendNegotiationMessage(
    negotiationId: string,
    data: SendNegotiationMessageDto,
    senderId: string,
  ) {
    const negotiation = await this.getNegotiationById(negotiationId);
    const senderType = negotiation.buyerId === senderId ? 'BUYER' : 'FARMER';
    const totalAmount = data.counterPrice && data.counterQuantity 
      ? data.counterPrice * data.counterQuantity 
      : null;
    const isCounterOffer = !!(data.counterPrice || data.counterQuantity);

    // Update negotiation if it's a counter offer
    let updatedNegotiation = negotiation;
    if (isCounterOffer) {
      updatedNegotiation = await this.prisma.negotiation.update({
        where: { id: negotiationId },
        data: {
          status: 'COUNTER_OFFER',
          negotiatedPricePerKg: data.counterPrice,
          negotiatedQuantity: data.counterQuantity,
          negotiatedTotalAmount: totalAmount,
          lastMessageAt: new Date(),
        },
      });
    }

    const message = await this.prisma.negotiationMessage.create({
      data: {
        negotiationId,
        senderId,
        senderType,
        message: data.message,
        pricePerKg: data.counterPrice,
        quantity: data.counterQuantity,
        totalAmount,
        isCounterOffer,
      },
    });

    // Create notifications (per lifecycle: counterparty, sender)
    try {
      const counterpartyId = negotiation.buyerId === senderId ? negotiation.farmerId : negotiation.buyerId;
      await Promise.all([
        this.notificationHelperService.createNotification({
          userId: counterpartyId,
          type: 'NEGOTIATION',
          title: 'New Counter Offer',
          message: `New counter offer received for negotiation #${negotiation.negotiationNumber}`,
          priority: 'MEDIUM',
          entityType: 'NEGOTIATION',
          entityId: negotiationId,
          actionUrl: `/negotiations/${negotiationId}`,
          actionLabel: 'View Negotiation',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
        this.notificationHelperService.createNotification({
          userId: senderId,
          type: 'NEGOTIATION',
          title: 'Counter Offer Sent',
          message: `Counter offer sent. Waiting for response`,
          priority: 'LOW',
          entityType: 'NEGOTIATION',
          entityId: negotiationId,
          actionUrl: `/negotiations/${negotiationId}`,
          actionLabel: 'View Negotiation',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for negotiation message:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: senderId,
        action: isCounterOffer ? 'NEGOTIATION_COUNTER_OFFER' : 'NEGOTIATION_MESSAGE',
        entityType: 'NEGOTIATION',
        entityId: negotiationId,
        metadata: { messageId: message.id, isCounterOffer },
      });
    } catch (error) {
      console.error('Failed to create activity log for negotiation message:', error);
    }

    return message;
  }

  async acceptNegotiation(id: string, userId: string) {
    const negotiation = await this.getNegotiationById(id);

    // Verify user is part of negotiation
    const listing = await this.getListingById(negotiation.listingId);
    if (negotiation.buyerId !== userId && listing.farmerId !== userId) {
      throw new BadRequestException('You are not part of this negotiation');
    }

    const updatedNegotiation = await this.prisma.negotiation.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    // Create notifications (per lifecycle: both parties)
    try {
      const counterpartyId = negotiation.buyerId === userId ? listing.farmerId : negotiation.buyerId;
      await Promise.all([
        this.notificationHelperService.createNotification({
          userId: counterpartyId,
          type: 'NEGOTIATION',
          title: 'Negotiation Accepted',
          message: `Your negotiation #${negotiation.negotiationNumber} has been accepted`,
          priority: 'HIGH',
          entityType: 'NEGOTIATION',
          entityId: id,
          actionUrl: `/negotiations/${id}`,
          actionLabel: 'View Negotiation',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
        this.notificationHelperService.createNotification({
          userId: userId,
          type: 'NEGOTIATION',
          title: 'Negotiation Accepted',
          message: `Negotiation accepted. You can now convert to order`,
          priority: 'MEDIUM',
          entityType: 'NEGOTIATION',
          entityId: id,
          actionUrl: `/negotiations/${id}`,
          actionLabel: 'Convert to Order',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for negotiation acceptance:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: userId,
          action: 'NEGOTIATION_ACCEPTED',
          entityType: 'NEGOTIATION',
          entityId: id,
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
        this.activityLogService.createActivityLog({
          userId: negotiation.buyerId === userId ? listing.farmerId : negotiation.buyerId,
          action: 'NEGOTIATION_ACCEPTED',
          entityType: 'NEGOTIATION',
          entityId: id,
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for negotiation acceptance:', error);
    }

    return updatedNegotiation;
  }

  async rejectNegotiation(id: string, userId: string) {
    const negotiation = await this.getNegotiationById(id);

    const listing = await this.getListingById(negotiation.listingId);
    if (negotiation.buyerId !== userId && listing.farmerId !== userId) {
      throw new BadRequestException('You are not part of this negotiation');
    }

    const updatedNegotiation = await this.prisma.negotiation.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    // Create notifications (per lifecycle: both parties)
    try {
      const counterpartyId = negotiation.buyerId === userId ? listing.farmerId : negotiation.buyerId;
      await Promise.all([
        this.notificationHelperService.createNotification({
          userId: counterpartyId,
          type: 'NEGOTIATION',
          title: 'Negotiation Rejected',
          message: `Negotiation #${negotiation.negotiationNumber} has been rejected`,
          priority: 'MEDIUM',
          entityType: 'NEGOTIATION',
          entityId: id,
          actionUrl: `/negotiations/${id}`,
          actionLabel: 'View Negotiation',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
        this.notificationHelperService.createNotification({
          userId: userId,
          type: 'NEGOTIATION',
          title: 'Negotiation Rejected',
          message: `Negotiation rejected`,
          priority: 'LOW',
          entityType: 'NEGOTIATION',
          entityId: id,
          actionUrl: `/negotiations/${id}`,
          actionLabel: 'View Negotiation',
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for negotiation rejection:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: userId,
          action: 'NEGOTIATION_REJECTED',
          entityType: 'NEGOTIATION',
          entityId: id,
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
        this.activityLogService.createActivityLog({
          userId: negotiation.buyerId === userId ? listing.farmerId : negotiation.buyerId,
          action: 'NEGOTIATION_REJECTED',
          entityType: 'NEGOTIATION',
          entityId: id,
          metadata: { negotiationNumber: negotiation.negotiationNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for negotiation rejection:', error);
    }

    return updatedNegotiation;
  }

  // ============ Statistics ============

  async getMarketplaceStats() {
    const [totalListings, totalOrders, totalRFQs, totalSourcingRequests] = await Promise.all([
      this.prisma.produceListing.count(),
      this.prisma.marketplaceOrder.count(),
      this.prisma.rFQ.count(),
      this.prisma.sourcingRequest.count(),
    ]);

    const ordersByStatus = await this.prisma.marketplaceOrder.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      totalListings,
      totalOrders,
      totalRFQs,
      totalSourcingRequests,
      ordersByStatus: ordersByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
    };
  }
}
