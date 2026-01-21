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
    if (order.buyerId !== userId && order.farmerId !== userId) {
      throw new BadRequestException('You can only update your own orders');
    }

    // Validate status transition
    const validTransitions = this.validStatusTransitions[oldStatus] || [];
    if (!validTransitions.includes(newStatus)) {
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
      updateData.deliveredAt = new Date();
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

    return this.prisma.rFQ.create({
      data: {
        buyerId,
        rfqNumber: rfqNumber[0].generate_rfq_number,
        title: `RFQ for ${data.variety} - ${data.quantity}kg`,
        productType: 'OFSP' as any,
        variety: data.variety as any,
        quantity: data.quantity,
        unit: 'kg',
        qualityGrade: data.qualityGrade as any,
        deadline: new Date(data.deliveryDate),
        quoteDeadline: data.quoteDeadline ? new Date(data.quoteDeadline) : new Date(data.deliveryDate),
        deliveryLocation: data.deliveryLocation,
        additionalRequirements: data.description,
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

    return this.prisma.rFQ.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
  }

  async closeRFQ(id: string, buyerId: string) {
    const rfq = await this.getRFQById(id);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only close your own RFQs');
    }

    return this.prisma.rFQ.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
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
    const totalAmount = rfq.quantity * data.pricePerKg;
    return this.prisma.rFQResponse.create({
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
      },
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

    return this.prisma.sourcingRequest.create({
      data: {
        buyerId,
        requestId: requestId[0].generate_sourcing_request_id,
        title: `Sourcing Request for ${data.variety} - ${data.quantity}kg`,
        productType: 'OFSP' as any,
        variety: data.variety as any,
        quantity: data.quantity,
        unit: 'kg',
        qualityGrade: data.qualityGrade as any,
        deadline: new Date(data.deliveryDate),
        deliveryRegion: data.deliveryLocation,
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

  async submitSupplierOffer(data: CreateSupplierOfferDto, farmerId: string) {
    const request = await this.getSourcingRequestById(data.sourcingRequestId);
    return this.prisma.supplierOffer.create({
      data: {
        sourcingRequestId: data.sourcingRequestId,
        farmerId,
        quantity: request.quantity,
        quantityUnit: request.unit,
        pricePerKg: data.pricePerKg,
        qualityGrade: request.qualityGrade || 'A' as any,
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
  }

  async acceptSupplierOffer(offerId: string, buyerId: string) {
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id: offerId },
      include: {
        sourcingRequest: true,
      },
    });

    if (!offer) {
      throw new NotFoundException(`Supplier Offer with ID ${offerId} not found`);
    }

    if (offer.sourcingRequest.buyerId !== buyerId) {
      throw new BadRequestException('You can only accept offers for your own sourcing requests');
    }

    return this.prisma.supplierOffer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTED' },
      include: {
        sourcingRequest: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });
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
    return this.prisma.negotiation.create({
      data: {
        listingId: data.listingId,
        buyerId,
        farmerId: listing.farmerId,
        negotiationNumber: negotiationNumber[0].generate_negotiation_number,
        originalPricePerKg: listing.pricePerKg,
        originalQuantity: listing.availableQuantity,
        negotiatedPricePerKg: data.proposedPrice,
        negotiatedQuantity: data.proposedQuantity,
      },
      include: {
        listing: true,
        buyer: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async sendNegotiationMessage(
    negotiationId: string,
    data: SendNegotiationMessageDto,
    senderId: string,
  ) {
    const negotiation = await this.getNegotiationById(negotiationId);
    const senderType = negotiation.buyerId === senderId ? 'buyer' : 'farmer';
    const totalAmount = data.counterPrice && data.counterQuantity 
      ? data.counterPrice * data.counterQuantity 
      : null;

    return this.prisma.negotiationMessage.create({
      data: {
        negotiationId,
        senderId,
        senderType,
        message: data.message,
        pricePerKg: data.counterPrice,
        quantity: data.counterQuantity,
        totalAmount,
        isCounterOffer: !!(data.counterPrice || data.counterQuantity),
      },
    });
  }

  async acceptNegotiation(id: string, userId: string) {
    const negotiation = await this.getNegotiationById(id);

    // Verify user is part of negotiation
    const listing = await this.getListingById(negotiation.listingId);
    if (negotiation.buyerId !== userId && listing.farmerId !== userId) {
      throw new BadRequestException('You are not part of this negotiation');
    }

    return this.prisma.negotiation.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });
  }

  async rejectNegotiation(id: string, userId: string) {
    const negotiation = await this.getNegotiationById(id);

    const listing = await this.getListingById(negotiation.listingId);
    if (negotiation.buyerId !== userId && listing.farmerId !== userId) {
      throw new BadRequestException('You are not part of this negotiation');
    }

    return this.prisma.negotiation.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
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
