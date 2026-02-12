import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { generateBatchTraceability } from '../../common/utils/traceability.util';
import { BadgeService } from '../badge/badge.service';
import { TransportService } from '../transport/transport.service';
import {
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  CreateRFQDto,
  CreateRFQResponseDto,
  CreateSourcingRequestDto,
  UpdateSourcingRequestDto,
  CreateSupplierOfferDto,
  CreateNegotiationDto,
  SendNegotiationMessageDto,
  RejectListingDto,
} from './dto';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private notificationHelperService: NotificationHelperService,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => BadgeService))
    private badgeService?: BadgeService,
    @Inject(forwardRef(() => TransportService))
    private transportService?: TransportService,
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
    ORDER_PLACED: ['ORDER_ACCEPTED', 'PAYMENT_SECURED', 'ORDER_REJECTED', 'CANCELLED'], // Payment can be secured before order acceptance
    ORDER_ACCEPTED: ['PAYMENT_SECURED', 'ORDER_REJECTED', 'CANCELLED'],
    PAYMENT_SECURED: ['READY_TO_PROCESS', 'IN_TRANSIT', 'CANCELLED'],
    READY_TO_PROCESS: ['PROCESSING', 'CANCELLED'], // Aggregation center can start processing
    PROCESSING: ['READY_FOR_COLLECTION', 'CANCELLED'], // Processing complete, ready for buyer collection
    READY_FOR_COLLECTION: ['RELEASED', 'CANCELLED'], // Stock out can be recorded to release stock
    RELEASED: ['COLLECTED', 'CANCELLED'], // Stock released, buyer can collect order
    COLLECTED: ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'], // After collection: delivery if request_transport, or completed if self_pickup
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

  /** Normalize listing status to Prisma ListingStatus enum */
  private normalizeListingStatus(
    status: string,
  ): 'PENDING_LEAD_APPROVAL' | 'REVISION_REQUESTED' | 'ACTIVE' | 'SOLD' | 'INACTIVE' | 'EXPIRED' | null {
    const s = status?.toUpperCase();
    const valid = [
      'PENDING_LEAD_APPROVAL',
      'REVISION_REQUESTED',
      'ACTIVE',
      'SOLD',
      'INACTIVE',
      'EXPIRED',
    ] as const;
    if (valid.includes(s as any)) return s as any;
    if (s === 'PENDING') return 'EXPIRED'; // Frontend "pending" maps to backend EXPIRED
    return null;
  }

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
    const normalizedStatus = filters?.status ? this.normalizeListingStatus(filters.status) : null;
    if (normalizedStatus) {
      where.status = normalizedStatus;
    } else if (!filters?.farmerId) {
      // Buyer-facing marketplace: only show approved (ACTIVE) listings when not filtering by farmer
      where.status = 'ACTIVE';
    }
    // When farmerId is provided (farmer viewing own listings), no status filter = show all statuses
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
        aggregationCenter: true,
        approvedBy: { include: { profile: true } },
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
    const listing = await this.prisma.produceListing.create({
      data: {
        farmerId,
        variety: data.variety as any,
        quantity: data.quantity,
        availableQuantity: data.quantity,
        quantityUnit: data.quantityUnit || 'kg',
        pricePerKg: data.pricePerKg,
        qualityGrade: data.qualityGrade as any,
        harvestDate: data.harvestDate ? new Date(data.harvestDate) : new Date(),
        county: data.county,
        subCounty: data.subcounty,
        ward: data.ward,
        village: data.village,
        location: data.location || data.county,
        expectedReadyAt: data.expectedReadyAt ? new Date(data.expectedReadyAt) : undefined,
        aggregationCenterId: data.aggregationCenterId || undefined,
        description: data.description,
        photos: data.photos || [],
        batchId: data.batchId,
        status: 'PENDING_LEAD_APPROVAL', // Farmer self-post: requires lead farmer approval
      },
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
        aggregationCenter: true,
      },
    });

    // Notify lead farmers that a new listing awaits verification
    await this.notifyLeadFarmersNewListing(listing);

    return listing;
  }

  /** Notify lead farmers in the listing's area that a new commodity is pending approval */
  private async notifyLeadFarmersNewListing(listing: {
    id: string;
    variety: string;
    quantity: number;
    county: string;
    ward?: string | null;
    village?: string | null;
  }) {
    const leadFarmers = await this.prisma.user.findMany({
      where: { role: 'LEAD_FARMER', status: 'ACTIVE' },
      select: { id: true },
    });
    const locationDesc = [listing.village, listing.ward, listing.county].filter(Boolean).join(', ') || listing.county;
    for (const u of leadFarmers) {
      await this.notificationHelperService.createNotification({
        userId: u.id,
        type: 'LISTING_PENDING_APPROVAL',
        title: 'New commodity listing awaiting verification',
        message: `${listing.variety}, ${listing.quantity} kg at ${locationDesc} is pending your approval.`,
        priority: 'HIGH',
        entityType: 'ProduceListing',
        entityId: listing.id,
        actionUrl: `/listings/pending-approval`,
        actionLabel: 'Review',
      });
    }
  }

  async updateListing(id: string, data: UpdateListingDto, farmerId: string) {
    const listing = await this.getListingById(id);

    if (listing.farmerId !== farmerId) {
      throw new BadRequestException('You can only update your own listings');
    }

    // Resubmit: farmer can set status to PENDING_LEAD_APPROVAL only when current is REVISION_REQUESTED
    const normalizedStatus = data.status ? this.normalizeListingStatus(data.status) : null;
    const isResubmit =
      listing.status === 'REVISION_REQUESTED' && normalizedStatus === 'PENDING_LEAD_APPROVAL';
    const statusUpdate: any = {};
    if (isResubmit) {
      statusUpdate.status = 'PENDING_LEAD_APPROVAL';
      statusUpdate.rejectionReason = null;
    } else if (normalizedStatus && normalizedStatus !== 'ACTIVE') {
      // Allow other non-ACTIVE transitions (e.g. INACTIVE) but not self-approve
      statusUpdate.status = normalizedStatus;
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
        ...(data.village !== undefined && { village: data.village }),
        ...(data.location && { location: data.location }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.photos && { photos: data.photos }),
        ...(data.expectedReadyAt !== undefined && {
          expectedReadyAt: data.expectedReadyAt ? new Date(data.expectedReadyAt) : null,
        }),
        ...(data.aggregationCenterId !== undefined && {
          aggregationCenterId: data.aggregationCenterId || null,
        }),
        ...(data.quantityUnit && { quantityUnit: data.quantityUnit }),
        ...statusUpdate,
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

  /** Listings pending lead farmer approval (for lead farmer queue) */
  async getListingsPendingApproval(filters?: {
    county?: string;
    ward?: string;
    aggregationCenterId?: string;
  }) {
    const where: any = { status: 'PENDING_LEAD_APPROVAL' };
    if (filters?.county) where.county = filters.county;
    if (filters?.ward) where.ward = filters.ward;
    if (filters?.aggregationCenterId) where.aggregationCenterId = filters.aggregationCenterId;

    return this.prisma.produceListing.findMany({
      where,
      include: {
        farmer: { include: { profile: true } },
        aggregationCenter: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Lead farmer approves a listing → status ACTIVE, visible to buyers */
  async approveListing(listingId: string, leadFarmerId: string) {
    const listing = await this.getListingById(listingId);
    if (listing.status !== 'PENDING_LEAD_APPROVAL') {
      throw new BadRequestException(
        `Listing is not pending approval (current status: ${listing.status})`,
      );
    }
    const updated = await this.prisma.produceListing.update({
      where: { id: listingId },
      data: {
        status: 'ACTIVE',
        approvedById: leadFarmerId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        farmer: { include: { profile: true } },
        approvedBy: { include: { profile: true } },
        aggregationCenter: true,
      },
    });
    // Notify farmer that listing was approved
    await this.notificationHelperService.createNotification({
      userId: listing.farmerId,
      type: 'LISTING_APPROVED',
      title: 'Your commodity listing was approved',
      message: `Your listing (${listing.variety}, ${listing.quantity} ${listing.quantityUnit || 'kg'}) is now live on the marketplace.`,
      entityType: 'ProduceListing',
      entityId: listingId,
      actionUrl: `/listings/${listingId}`,
    });
    return updated;
  }

  /** Lead farmer rejects / returns for correction */
  async rejectListing(listingId: string, leadFarmerId: string, dto: RejectListingDto) {
    const listing = await this.getListingById(listingId);
    if (listing.status !== 'PENDING_LEAD_APPROVAL') {
      throw new BadRequestException(
        `Listing is not pending approval (current status: ${listing.status})`,
      );
    }
    const updated = await this.prisma.produceListing.update({
      where: { id: listingId },
      data: {
        status: 'REVISION_REQUESTED',
        rejectionReason: dto.reason ?? null,
        approvedById: null,
        approvedAt: null,
      },
      include: {
        farmer: { include: { profile: true } },
        aggregationCenter: true,
      },
    });
    await this.notificationHelperService.createNotification({
      userId: listing.farmerId,
      type: 'LISTING_REVISION_REQUESTED',
      title: 'Listing needs revision',
      message: dto.reason
        ? `Your listing was returned for correction: ${dto.reason}`
        : 'Your listing was returned for correction. Please update and resubmit.',
      entityType: 'ProduceListing',
      entityId: listingId,
      actionUrl: `/listings/${listingId}/edit`,
    });
    return updated;
  }

  // ============ Marketplace Orders ============

  async getOrders(filters?: {
    buyerId?: string;
    farmerId?: string;
    status?: string;
    listingId?: string;
    centerId?: string; // Filter orders by aggregation center (through stock transactions or listings)
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

    // If centerId is provided, filter orders that are associated with this center
    // Orders can be associated through:
    // 1. Direct stock transactions (for stock-out orders)
    // 2. Listing's batchId matching a stock transaction at this center (for orders in processing)
    // 3. Order's batchId matching an InventoryItem at this center (for supplier offer orders)
    if (filters?.centerId) {
      // Find batchIds from stock transactions at this center
      const stockTransactions = await this.prisma.stockTransaction.findMany({
        where: {
          centerId: filters.centerId,
          type: 'STOCK_IN', // Only STOCK_IN transactions create listings
        },
        select: {
          batchId: true,
        },
        distinct: ['batchId'],
      });

      const stockTransactionBatchIds = stockTransactions
        .map((st) => st.batchId)
        .filter((id): id is string => id !== null);

      // Find batchIds from inventory items at this center (for supplier offer orders)
      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where: {
          centerId: filters.centerId,
        },
        select: {
          batchId: true,
        },
      });

      const inventoryBatchIds = inventoryItems
        .map((item) => item.batchId)
        .filter((id): id is string => id !== null);

      // Combine all batchIds that are associated with this center
      const allCenterBatchIds = [...new Set([...stockTransactionBatchIds, ...inventoryBatchIds])];

      // Build OR condition for center association
      const centerConditions: any[] = [
        {
          stockTransactions: {
            some: {
              centerId: filters.centerId,
            },
          },
        },
      ];

      // Add listing batchId condition if we have batchIds from stock transactions
      if (stockTransactionBatchIds.length > 0) {
        centerConditions.push({
          listing: {
            batchId: {
              in: stockTransactionBatchIds,
            },
          },
        });
      }

      // Add order batchId condition if we have batchIds from inventory items
      // This covers orders created from supplier offers with batch selection
      if (inventoryBatchIds.length > 0) {
        centerConditions.push({
          batchId: {
            in: inventoryBatchIds,
          },
        });
      }

      // Combine existing where conditions with center filter using AND
      const existingConditions = { ...where };
      where.AND = [
        existingConditions,
        { OR: centerConditions },
      ];
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
        stockTransactions: filters?.centerId ? {
          where: { centerId: filters.centerId },
          include: {
            center: true, // Include center details
          },
          take: 1, // Just to verify association
        } : {
          include: {
            center: true, // Include center details for all stock transactions
          },
          take: 1, // Get the most recent stock transaction
          orderBy: { createdAt: 'desc' },
        },
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

    // Validate delivery fields if transport is requested
    const fulfillmentType = data.fulfillmentType || 'self_pickup';
    if (fulfillmentType === 'request_transport') {
      if (!data.deliveryAddress || !data.deliveryCounty) {
        throw new BadRequestException('Delivery address and county are required when requesting transport');
      }
    }

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
        fulfillmentType,
        deliveryAddress: data.deliveryAddress || null,
        deliveryCounty: data.deliveryCounty || null,
        deliveryCoordinates: data.deliveryCoordinates || null,
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

    // Create transport request if fulfillment type is request_transport
    if (fulfillmentType === 'request_transport' && data.deliveryAddress && data.deliveryCounty && this.transportService) {
      try {
        // Get aggregation center location from listing or use a default
        let pickupLocation = 'Aggregation Center';
        let pickupCounty = data.deliveryCounty; // Fallback, should be improved
        
        if (order.listing) {
          // Try to get center from listing's batchId -> stock transaction
          const stockTx = await this.prisma.stockTransaction.findFirst({
            where: {
              batchId: order.listing.batchId,
              type: 'STOCK_IN',
            },
            include: {
              center: true,
            },
            orderBy: { createdAt: 'desc' },
          });
          
          if (stockTx?.center) {
            pickupLocation = stockTx.center.location || stockTx.center.name;
            pickupCounty = stockTx.center.county;
          }
        }

        await this.transportService.createTransportRequest(
          {
            type: 'ORDER_DELIVERY',
            description: `Delivery for order #${order.orderNumber}`,
            requesterType: 'buyer',
            pickupLocation,
            pickupCounty,
            deliveryLocation: data.deliveryAddress,
            deliveryCounty: data.deliveryCounty,
            deliveryCoordinates: data.deliveryCoordinates,
            weight: data.quantity,
            orderId: order.id,
          },
          buyerId,
        );
      } catch (error) {
        // Log error but don't fail order creation
        console.error('Failed to create transport request for order:', error);
      }
    }

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
      
      // Update sourcing request fulfilled quantity (per lifecycle: Stage 5 - Converted to Order)
      const offer = await this.prisma.supplierOffer.findUnique({
        where: { id: data.supplierOfferId },
        include: { sourcingRequest: true },
      });
      
      if (offer) {
        // Convert offer quantity to the same unit as sourcing request for accurate calculation
        let offerQuantityInRequestUnit = offer.quantity;
        if (offer.quantityUnit !== offer.sourcingRequest.unit) {
          // Convert to kg first, then to request unit
          let quantityInKg = offer.quantity;
          if (offer.quantityUnit === 'tons') {
            quantityInKg = offer.quantity * 1000;
          } else if (offer.quantityUnit === 'units') {
            // Assume 1 unit = 50kg for bags (common for sweet potatoes)
            quantityInKg = offer.quantity * 50;
          }
          
          // Convert from kg to request unit
          if (offer.sourcingRequest.unit === 'tons') {
            offerQuantityInRequestUnit = quantityInKg / 1000;
          } else if (offer.sourcingRequest.unit === 'units') {
            offerQuantityInRequestUnit = quantityInKg / 50;
          } else {
            offerQuantityInRequestUnit = quantityInKg;
          }
        }

        const newFulfilled = (offer.sourcingRequest.fulfilled || 0) + offerQuantityInRequestUnit;
        const isFullyFulfilled = newFulfilled >= offer.sourcingRequest.quantity;
        const oldStatus = offer.sourcingRequest.status;
        
        await this.prisma.sourcingRequest.update({
          where: { id: offer.sourcingRequest.id },
          data: {
            fulfilled: newFulfilled,
            status: isFullyFulfilled ? 'FULFILLED' : offer.sourcingRequest.status,
          },
        });

        // Create activity log for sourcing request fulfillment status change (per lifecycle)
        if (isFullyFulfilled && oldStatus !== 'FULFILLED') {
          try {
            await this.activityLogService.createActivityLog({
              userId: buyerId,
              action: 'SOURCING_REQUEST_FULFILLED',
              entityType: 'SOURCING_REQUEST',
              entityId: offer.sourcingRequest.id,
              metadata: { 
                requestId: offer.sourcingRequest.requestId,
                orderId: order.id,
                offerId: offer.id,
                fulfilledQuantity: newFulfilled,
                totalQuantity: offer.sourcingRequest.quantity,
              },
            });
          } catch (error) {
            console.error('Failed to create activity log for sourcing request fulfillment:', error);
          }
        }

        // Create specific notifications for sourcing request conversion (per lifecycle: Stage 5)
        try {
          await Promise.all([
            // To Supplier: "Sourcing request #XXX converted to order #YYY"
            this.notificationHelperService.createNotification({
              userId: offer.farmerId,
              type: 'SUPPLIER_OFFER',
              title: 'Offer Converted to Order',
              message: `Sourcing request #${offer.sourcingRequest.requestId} converted to order #${order.orderNumber}`,
              priority: 'HIGH',
              entityType: 'MARKETPLACE_ORDER',
              entityId: order.id,
              actionUrl: `/orders/${order.id}`,
              actionLabel: 'View Order',
              metadata: { requestId: offer.sourcingRequest.requestId, orderNumber: order.orderNumber },
            }),
            // To Buyer: "Order #YYY created from sourcing request #XXX"
            this.notificationHelperService.createNotification({
              userId: buyerId,
              type: 'MARKETPLACE_ORDER',
              title: 'Order Created from Sourcing Request',
              message: `Order #${order.orderNumber} created from sourcing request #${offer.sourcingRequest.requestId}`,
              priority: 'MEDIUM',
              entityType: 'MARKETPLACE_ORDER',
              entityId: order.id,
              actionUrl: `/orders/${order.id}`,
              actionLabel: 'View Order',
              metadata: { requestId: offer.sourcingRequest.requestId, orderNumber: order.orderNumber },
            }),
          ]);
        } catch (error) {
          console.error('Failed to create notifications for sourcing request conversion:', error);
        }
      }
    }

    // Create general order notifications
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

    // Check if transitioning from PAYMENT_SECURED to IN_TRANSIT requires farmer confirmation
    if (oldStatus === 'PAYMENT_SECURED' && newStatus === 'IN_TRANSIT' && !isSystemUser) {
      const payment = await this.prisma.payment.findUnique({
        where: { orderId: id },
      });
      
      // Check if payment exists and has been confirmed by farmer
      // Using type assertion since Prisma types may not be updated yet after schema change
      const paymentData = payment as any;
      const paymentStatus = paymentData?.status as string;
      const farmerConfirmed = paymentData?.farmerConfirmedBy;
      
      if (!payment || paymentStatus !== 'CONFIRMED_BY_FARMER' || !farmerConfirmed) {
        throw new BadRequestException(
          'Cannot proceed to fulfillment. Payment must be confirmed by farmer first.'
        );
      }
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
    } else if (newStatus === 'PROCESSING') {
      // When order starts processing, deduct quantity from listing availableQuantity (for listing-based orders)
      if (order.listingId) {
        try {
          const listing = await this.prisma.produceListing.findUnique({
            where: { id: order.listingId },
          });
          if (listing) {
            const newAvailableQuantity = Math.max(0, listing.availableQuantity - order.quantity);
            await this.prisma.produceListing.update({
              where: { id: order.listingId },
              data: { availableQuantity: newAvailableQuantity },
            });
            console.log(`Deducted ${order.quantity} kg from listing ${order.listingId}. New available: ${newAvailableQuantity} kg`);
          }
        } catch (error) {
          console.error('Failed to update listing availableQuantity:', error);
          // Don't fail the order status update if listing update fails
        }
      }

      // When order starts processing, deduct quantity from batch (InventoryItem) for batch-based orders
      // This applies to orders from supplier offers and RFQ responses
      if (order.batchId) {
        try {
          const inventoryItem = await this.prisma.inventoryItem.findUnique({
            where: { batchId: order.batchId },
          });
          
          if (inventoryItem) {
            // Verify order quantity doesn't exceed available batch quantity
            if (order.quantity > inventoryItem.quantity) {
              throw new BadRequestException(
                `Order quantity (${order.quantity} kg) exceeds available batch quantity (${inventoryItem.quantity} kg) for batch ${order.batchId}`
              );
            }

            const newBatchQuantity = Math.max(0, inventoryItem.quantity - order.quantity);
            await this.prisma.inventoryItem.update({
              where: { batchId: order.batchId },
              data: { quantity: newBatchQuantity },
            });
            console.log(`Deducted ${order.quantity} kg from batch ${order.batchId}. New available: ${newBatchQuantity} kg`);
          } else {
            console.warn(`Batch ${order.batchId} not found in inventory when processing order ${order.orderNumber}`);
          }
        } catch (error) {
          console.error('Failed to update batch quantity:', error);
          // Re-throw if it's a validation error, otherwise log and continue
          if (error instanceof BadRequestException) {
            throw error;
          }
          // Don't fail the order status update if batch update fails (for non-critical errors)
        }
      }

      // Create transport request if fulfillment type is request_transport
      // This ensures transport providers can see the request once processing starts
      console.log(`[TRANSPORT_REQUEST_FLOW] Order ${order.orderNumber} (${id}) marked as PROCESSING. Checking transport request creation...`);
      console.log(`[TRANSPORT_REQUEST_FLOW] Order details:`, {
        fulfillmentType: order.fulfillmentType,
        deliveryAddress: order.deliveryAddress ? 'present' : 'missing',
        deliveryCounty: order.deliveryCounty ? 'present' : 'missing',
        deliveryCoordinates: order.deliveryCoordinates ? 'present' : 'missing',
        transportServiceAvailable: !!this.transportService,
      });

      if (order.fulfillmentType === 'request_transport' && order.deliveryAddress && order.deliveryCounty && this.transportService) {
        console.log(`[TRANSPORT_REQUEST_FLOW] Conditions met. Proceeding with transport request creation for order ${order.orderNumber}`);
        try {
          // Check if transport request already exists for this order
          console.log(`[TRANSPORT_REQUEST_FLOW] Checking for existing transport request for order ${order.orderNumber}...`);
          const existingRequest = await this.prisma.transportRequest.findFirst({
            where: { orderId: id },
          });

          if (existingRequest) {
            console.log(`[TRANSPORT_REQUEST_FLOW] Existing transport request found for order ${order.orderNumber}:`, {
              requestId: existingRequest.id,
              requestNumber: existingRequest.requestNumber,
              status: existingRequest.status,
            });
            console.log(`[TRANSPORT_REQUEST_FLOW] Skipping transport request creation - duplicate prevention`);
          } else {
            console.log(`[TRANSPORT_REQUEST_FLOW] No existing transport request found. Creating new one for order ${order.orderNumber}`);
            
            // Get aggregation center location from order's listing or stock transactions
            let pickupLocation = 'Aggregation Center';
            let pickupCounty = order.deliveryCounty; // Fallback

            console.log(`[TRANSPORT_REQUEST_FLOW] Looking up aggregation center location for order ${order.orderNumber}...`);

            // Try to get center from listing's batch
            if (order.listingId) {
              console.log(`[TRANSPORT_REQUEST_FLOW] Order has listingId: ${order.listingId}. Checking listing's batch...`);
              const listing = await this.prisma.produceListing.findUnique({
                where: { id: order.listingId },
                select: { batchId: true },
              });

              if (listing?.batchId) {
                console.log(`[TRANSPORT_REQUEST_FLOW] Listing has batchId: ${listing.batchId}. Querying stock transactions...`);
                // Query StockTransaction using the listing's batchId
                const stockTx = await this.prisma.stockTransaction.findFirst({
                  where: {
                    batchId: listing.batchId,
                    type: 'STOCK_IN',
                  },
                  include: {
                    center: true,
                  },
                  orderBy: { createdAt: 'desc' },
                });

                if (stockTx?.center) {
                  pickupLocation = stockTx.center.location || stockTx.center.name;
                  pickupCounty = stockTx.center.county;
                  console.log(`[TRANSPORT_REQUEST_FLOW] Found center from listing's batch:`, {
                    centerId: stockTx.center.id,
                    centerName: stockTx.center.name,
                    location: pickupLocation,
                    county: pickupCounty,
                  });
                } else {
                  console.log(`[TRANSPORT_REQUEST_FLOW] No stock transaction found for listing's batchId: ${listing.batchId}`);
                }
              } else {
                console.log(`[TRANSPORT_REQUEST_FLOW] Listing ${order.listingId} has no batchId`);
              }
            } else {
              console.log(`[TRANSPORT_REQUEST_FLOW] Order ${order.orderNumber} has no listingId`);
            }

            // If still no center found, try to get from order's stock transactions
            if (pickupLocation === 'Aggregation Center') {
              console.log(`[TRANSPORT_REQUEST_FLOW] Pickup location still default. Checking order's direct stock transactions...`);
              const stockTx = await this.prisma.stockTransaction.findFirst({
                where: {
                  orderId: id,
                  type: 'STOCK_IN',
                },
                include: {
                  center: true,
                },
                orderBy: { createdAt: 'desc' },
              });

              if (stockTx?.center) {
                pickupLocation = stockTx.center.location || stockTx.center.name;
                pickupCounty = stockTx.center.county;
                console.log(`[TRANSPORT_REQUEST_FLOW] Found center from order's stock transaction:`, {
                  centerId: stockTx.center.id,
                  centerName: stockTx.center.name,
                  location: pickupLocation,
                  county: pickupCounty,
                });
              } else {
                console.log(`[TRANSPORT_REQUEST_FLOW] No stock transaction found for order ${order.orderNumber}. Using fallback location.`);
              }
            }

            console.log(`[TRANSPORT_REQUEST_FLOW] Final pickup location determined:`, {
              pickupLocation,
              pickupCounty,
            });

            console.log(`[TRANSPORT_REQUEST_FLOW] Creating transport request with data:`, {
              type: 'ORDER_DELIVERY',
              orderId: order.id,
              orderNumber: order.orderNumber,
              requesterId: order.buyerId,
              pickupLocation,
              pickupCounty,
              deliveryLocation: order.deliveryAddress,
              deliveryCounty: order.deliveryCounty,
              weight: order.quantity,
            });

            const transportRequest = await this.transportService.createTransportRequest(
              {
                type: 'ORDER_DELIVERY',
                description: `Delivery for order #${order.orderNumber}`,
                requesterType: 'buyer',
                pickupLocation,
                pickupCounty,
                deliveryLocation: order.deliveryAddress,
                deliveryCounty: order.deliveryCounty,
                deliveryCoordinates: order.deliveryCoordinates || undefined,
                weight: order.quantity,
                orderId: order.id,
              },
              order.buyerId,
            );

            console.log(`[TRANSPORT_REQUEST_FLOW] Transport request created successfully:`, {
              requestId: transportRequest.id,
              requestNumber: transportRequest.requestNumber,
              orderId: order.id,
              orderNumber: order.orderNumber,
            });

            // Create activity log for ORDER_DELIVERY transport request creation
            try {
              console.log(`[TRANSPORT_REQUEST_FLOW] Creating activity log for transport request ${transportRequest.requestNumber}...`);
              await this.activityLogService.createActivityLog({
                userId: order.buyerId,
                action: 'ORDER_DELIVERY_TRANSPORT_CREATED',
                entityType: 'TRANSPORT',
                entityId: transportRequest.id,
                metadata: {
                  requestNumber: transportRequest.requestNumber,
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  type: 'ORDER_DELIVERY',
                  triggeredBy: 'ORDER_PROCESSING_STARTED',
                },
              });
              console.log(`[TRANSPORT_REQUEST_FLOW] Activity log created successfully`);
            } catch (logError) {
              console.error(`[TRANSPORT_REQUEST_FLOW] Failed to create activity log for ORDER_DELIVERY transport creation:`, logError);
              // Don't throw - activity log failures shouldn't block transport creation
            }
          }
        } catch (error) {
          // Log error but don't fail order status update
          console.error(`[TRANSPORT_REQUEST_FLOW] ERROR: Failed to create transport request when order processing started for order ${order.orderNumber}:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            orderId: id,
            orderNumber: order.orderNumber,
          });
        }
      } else {
        console.log(`[TRANSPORT_REQUEST_FLOW] Conditions NOT met for transport request creation. Skipping.`, {
          fulfillmentType: order.fulfillmentType,
          hasDeliveryAddress: !!order.deliveryAddress,
          hasDeliveryCounty: !!order.deliveryCounty,
          hasTransportService: !!this.transportService,
        });
      }
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

    // Check badges if order is completed or delivered
    if ((newStatus === 'COMPLETED' || newStatus === 'DELIVERED') && updatedOrder.farmerId) {
      // Check badges asynchronously (don't block order update)
      this.badgeService?.checkBadgesOnOrderCompletion(updatedOrder.farmerId, id).catch(error => {
        console.error('Error checking badges:', error);
      });
    }

    return updatedOrder;
  }

  /**
   * Mark order as started processing (by aggregation center)
   * This deducts the quantity from the listing's availableQuantity
   */
  async startOrderProcessing(id: string, userId: string) {
    const order = await this.getOrderById(id);

    // Verify user has permission (only aggregation managers, admins, staff)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isSystemUser = user?.role === 'AGGREGATION_MANAGER' || user?.role === 'ADMIN' || user?.role === 'STAFF';
    if (!isSystemUser) {
      throw new BadRequestException('Only aggregation center staff can start order processing');
    }

    // Verify order is ready to process
    if (order.status !== 'READY_TO_PROCESS') {
      throw new BadRequestException(`Order must be in READY_TO_PROCESS status. Current status: ${order.status}`);
    }

    // Update order status to PROCESSING
    // The listing availableQuantity will be deducted in updateOrderStatus when status is PROCESSING
    return this.updateOrderStatus(id, { status: 'PROCESSING' }, userId);
  }

  /**
   * Mark order as processed and ready for collection (by aggregation center)
   */
  async markOrderReadyForCollection(id: string, userId: string) {
    const order = await this.getOrderById(id);

    // Verify user has permission (only aggregation managers, admins, staff)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isSystemUser = user?.role === 'AGGREGATION_MANAGER' || user?.role === 'ADMIN' || user?.role === 'STAFF';
    if (!isSystemUser) {
      throw new BadRequestException('Only aggregation center staff can mark orders as ready for collection');
    }

    // Verify order is being processed
    if (order.status !== 'PROCESSING') {
      throw new BadRequestException(`Order must be in PROCESSING status. Current status: ${order.status}`);
    }

    // Update order status to READY_FOR_COLLECTION
    return this.updateOrderStatus(id, { status: 'READY_FOR_COLLECTION' }, userId);
  }

  async markOrderAsCollected(id: string, userId: string) {
    const order = await this.getOrderById(id);

    // Verify user has permission (only buyer can mark as collected)
    if (order.buyerId !== userId) {
      throw new BadRequestException('Only the buyer can mark this order as collected');
    }

    // Verify order is released (stock out recorded by aggregation officer)
    if (order.status !== 'RELEASED') {
      throw new BadRequestException(
        `Cannot mark order as collected. Order #${order.orderNumber} must be in RELEASED status (stock out must be recorded first by aggregation officer). Current order status: ${order.status}`
      );
    }

    // Update status history
    const statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    statusHistory.push({
      status: 'COLLECTED',
      timestamp: new Date().toISOString(),
      changedBy: userId,
    });

    // Update order status to COLLECTED and set collected flag
    const updatedOrder = await this.prisma.marketplaceOrder.update({
      where: { id },
      data: { 
        status: 'COLLECTED' as any,
        collected: true,
        statusHistory: statusHistory as any,
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
        payment: true,
        escrow: true,
      },
    });

    // Create notification
    await this.notificationHelperService.createNotification({
      userId: order.farmerId,
      type: 'ORDER',
      title: 'Order Collected',
      message: `Order #${order.orderNumber} has been collected by buyer`,
      priority: 'LOW',
      entityType: 'ORDER',
      entityId: id,
      actionUrl: `/orders/${id}`,
      actionLabel: 'View Order',
      metadata: { orderNumber: order.orderNumber },
    });

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'ORDER_COLLECTED',
      entityType: 'ORDER',
      entityId: id,
      metadata: {
        orderNumber: order.orderNumber,
        collectedAt: new Date().toISOString(),
      },
    });

    // Notify about status change
    await this.notificationHelperService.notifyOrderStatusChange(updatedOrder, 'COLLECTED', { id: userId });
    await this.activityLogService.logOrderStatusChange(updatedOrder, 'READY_FOR_COLLECTION', 'COLLECTED', userId);

    return updatedOrder;
  }

  async confirmDeliveryByBuyer(id: string, userId: string) {
    const order = await this.getOrderById(id);

    // Verify user has permission (only buyer can confirm delivery)
    if (order.buyerId !== userId) {
      throw new BadRequestException('Only the buyer can confirm delivery for this order');
    }

    // Verify order has request_transport fulfillment type
    if (order.fulfillmentType !== 'request_transport') {
      throw new BadRequestException(
        `Delivery confirmation is only available for orders with request_transport fulfillment type. Order #${order.orderNumber} has fulfillment type: ${order.fulfillmentType}`
      );
    }

    // Verify order is in DELIVERED status (driver must have confirmed delivery first)
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        `Cannot confirm delivery. Order #${order.orderNumber} must be in DELIVERED status (driver must confirm delivery first). Current order status: ${order.status}`
      );
    }

    // Update status history
    const statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    statusHistory.push({
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      changedBy: userId,
      note: 'Buyer confirmed delivery',
    });

    // Update order status to COMPLETED
    const updatedOrder = await this.prisma.marketplaceOrder.update({
      where: { id },
      data: { 
        status: 'COMPLETED' as any,
        completedAt: new Date(),
        statusHistory: statusHistory as any,
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
        payment: true,
        escrow: true,
      },
    });

    // Create notification for farmer
    await this.notificationHelperService.createNotification({
      userId: order.farmerId,
      type: 'ORDER',
      title: 'Order Completed',
      message: `Order #${order.orderNumber} has been completed. Buyer has confirmed delivery.`,
      priority: 'MEDIUM',
      entityType: 'ORDER',
      entityId: id,
      actionUrl: `/orders/${id}`,
      actionLabel: 'View Order',
      metadata: { orderNumber: order.orderNumber },
    });

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'ORDER_DELIVERY_CONFIRMED_BY_BUYER',
      entityType: 'ORDER',
      entityId: id,
      metadata: {
        orderNumber: order.orderNumber,
        previousStatus: 'DELIVERED',
        newStatus: 'COMPLETED',
      },
    });

    // Notify about status change
    await this.notificationHelperService.notifyOrderStatusChange(updatedOrder, 'COMPLETED', { id: userId });
    await this.activityLogService.logOrderStatusChange(updatedOrder, 'DELIVERED', 'COMPLETED', userId);

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

    if (rfq.status !== 'DRAFT') {
      throw new BadRequestException('Only draft RFQs can be published');
    }

    const updatedRFQ = await this.prisma.rFQ.update({
      where: { id },
      data: { 
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Get relevant suppliers (farmers) to notify
    // TODO: Enhance this to filter by location, preferences, etc. based on RFQ requirements
    // For now, we'll notify all active farmers
    let relevantSuppliers: Array<{ id: string }> = [];
    try {
      relevantSuppliers = await this.prisma.user.findMany({
        where: {
          role: 'FARMER',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    } catch (error) {
      console.error('Failed to fetch suppliers for RFQ notification:', error);
    }

    // Create notifications (per lifecycle: buyer, and all relevant suppliers)
    try {
      await Promise.all([
        // To Buyer
        this.notificationHelperService.createNotification({
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
        }),
        // To all relevant suppliers (per lifecycle requirements)
        ...relevantSuppliers.map(supplier =>
          this.notificationHelperService.createNotification({
            userId: supplier.id,
            type: 'RFQ',
            title: 'New RFQ Published',
            message: `New RFQ published: ${rfq.title || rfq.rfqNumber}`,
            priority: 'MEDIUM',
            entityType: 'RFQ',
            entityId: id,
            actionUrl: `/rfqs/${id}`,
            actionLabel: 'View RFQ',
            metadata: { rfqNumber: rfq.rfqNumber },
          })
        ),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for RFQ publish:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'RFQ_PUBLISHED',
        entityType: 'RFQ',
        entityId: id,
        metadata: { rfqNumber: rfq.rfqNumber, suppliersNotified: relevantSuppliers.length },
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

    if (rfq.status === 'CLOSED' || rfq.status === 'CANCELLED') {
      throw new BadRequestException(`RFQ is already ${rfq.status.toLowerCase()}`);
    }

    const updatedRFQ = await this.prisma.rFQ.update({
      where: { id },
      data: { 
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    // Get all suppliers who submitted responses for notifications
    const responses = await this.prisma.rFQResponse.findMany({
      where: { rfqId: id },
      select: { supplierId: true },
    });

    // Create notifications (per lifecycle: buyer, and all suppliers)
    try {
      await Promise.all([
        // To Buyer
        this.notificationHelperService.createNotification({
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
        }),
        // To all suppliers who submitted responses
        ...responses.map(response =>
          this.notificationHelperService.createNotification({
            userId: response.supplierId,
            type: 'RFQ',
            title: 'RFQ Closed',
            message: `RFQ #${rfq.rfqNumber} has been closed`,
            priority: 'MEDIUM',
            entityType: 'RFQ',
            entityId: id,
            actionUrl: `/rfqs/${id}`,
            actionLabel: 'View RFQ',
            metadata: { rfqNumber: rfq.rfqNumber },
          })
        ),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for RFQ close:', error);
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

  async cancelRFQ(id: string, buyerId: string, reason?: string) {
    const rfq = await this.getRFQById(id);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only cancel your own RFQs');
    }

    if (rfq.status === 'CLOSED' || rfq.status === 'CANCELLED' || rfq.status === 'AWARDED') {
      throw new BadRequestException(`Cannot cancel RFQ in ${rfq.status} status`);
    }

    // Update RFQ and all responses in a transaction
    const [updatedRFQ] = await Promise.all([
      this.prisma.rFQ.update({
        where: { id },
        data: { 
          status: 'CANCELLED',
          closedAt: new Date(),
        },
      }),
      // Mark all responses as withdrawn
      this.prisma.rFQResponse.updateMany({
        where: { rfqId: id, status: { not: 'WITHDRAWN' } },
        data: { status: 'WITHDRAWN' },
      }),
    ]);

    // Get all suppliers who submitted responses for notifications
    const responses = await this.prisma.rFQResponse.findMany({
      where: { rfqId: id },
      select: { supplierId: true },
    });

    // Create notifications (per lifecycle: buyer, and all suppliers)
    try {
      await Promise.all([
        // To Buyer
        this.notificationHelperService.createNotification({
          userId: buyerId,
          type: 'RFQ',
          title: 'RFQ Cancelled',
          message: `RFQ #${rfq.rfqNumber} cancelled`,
          priority: 'MEDIUM',
          entityType: 'RFQ',
          entityId: id,
          actionUrl: `/rfqs/${id}`,
          actionLabel: 'View RFQ',
          metadata: { rfqNumber: rfq.rfqNumber, reason },
        }),
        // To all suppliers who submitted responses
        ...responses.map(response =>
          this.notificationHelperService.createNotification({
            userId: response.supplierId,
            type: 'RFQ',
            title: 'RFQ Cancelled',
            message: `RFQ #${rfq.rfqNumber} has been cancelled`,
            priority: 'MEDIUM',
            entityType: 'RFQ',
            entityId: id,
            actionUrl: `/rfqs/${id}`,
            actionLabel: 'View RFQ',
            metadata: { rfqNumber: rfq.rfqNumber },
          })
        ),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for RFQ cancellation:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'RFQ_CANCELLED',
        entityType: 'RFQ',
        entityId: id,
        metadata: { rfqNumber: rfq.rfqNumber, reason },
      });
    } catch (error) {
      console.error('Failed to create activity log for RFQ cancellation:', error);
    }

    return updatedRFQ;
  }

  async setRFQEvaluating(id: string, buyerId: string) {
    const rfq = await this.getRFQById(id);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only update your own RFQs');
    }

    if (rfq.status !== 'PUBLISHED') {
      throw new BadRequestException('RFQ must be published to set evaluating status');
    }

    const updatedRFQ = await this.prisma.rFQ.update({
      where: { id },
      data: { 
        status: 'EVALUATING',
        evaluationDeadline: rfq.evaluationDeadline || null,
      },
    });

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'RFQ_EVALUATING',
        entityType: 'RFQ',
        entityId: id,
        metadata: { rfqNumber: rfq.rfqNumber },
      });
    } catch (error) {
      console.error('Failed to create activity log for RFQ evaluating:', error);
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
    if (!data.rfqId) {
      throw new BadRequestException('RFQ ID is required');
    }
    const rfq = await this.getRFQById(data.rfqId);
    
    // Validate RFQ is published
    if (rfq.status !== 'PUBLISHED') {
      throw new BadRequestException('RFQ must be published to accept responses');
    }
    
    // Check if quote deadline has passed
    if (rfq.quoteDeadline && new Date(rfq.quoteDeadline) < new Date()) {
      throw new BadRequestException('Quote submission deadline has passed');
    }

    // Validate batchId is provided (mandatory)
    if (!data.batchId) {
      throw new BadRequestException('Batch selection is required. Please select a batch when submitting a quote.');
    }

    // Verify batch exists in inventory
    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { batchId: data.batchId },
      include: {
        center: true, // Include aggregation center for relation access via batchId
      },
    });

    if (!inventoryItem) {
      throw new NotFoundException(`Batch ${data.batchId} not found in inventory`);
    }

    // Verify batch belongs to the supplier
    if (inventoryItem.farmerId !== supplierId) {
      throw new BadRequestException('Selected batch does not belong to you');
    }
    
    const totalAmount = rfq.quantity * data.pricePerKg;
    const submittedAt = new Date();
    
    // Create response and update RFQ in a transaction
    const [response] = await Promise.all([
      this.prisma.rFQResponse.create({
        data: {
          rfqId: data.rfqId!,
          supplierId,
          quantity: rfq.quantity,
          quantityUnit: rfq.unit,
          pricePerUnit: data.pricePerKg,
          priceUnit: 'kg',
          totalAmount,
          qualityGrade: rfq.qualityGrade || 'A' as any,
          batchId: data.batchId,
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
        where: { id: data.rfqId! },
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

    // Validate status transition
    const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'AWARDED', 'REJECTED', 'WITHDRAWN'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const updateData: any = { status: status as any };
    
    // Set timestamps based on status (using evaluatedAt for review-related statuses)
    if (status === 'UNDER_REVIEW' || status === 'SHORTLISTED' || status === 'REJECTED') {
      updateData.evaluatedAt = new Date();
    }

    const updatedResponse = await this.prisma.rFQResponse.update({
      where: { id },
      data: updateData,
      include: {
        rfq: true,
        supplier: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create notifications based on status (per lifecycle)
    try {
      const supplierName = updatedResponse.supplier.profile?.firstName || 'Supplier';
      
      if (status === 'SHORTLISTED') {
        await Promise.all([
          // To Supplier
          this.notificationHelperService.createNotification({
            userId: response.supplierId,
            type: 'RFQ_RESPONSE',
            title: 'Quote Shortlisted',
            message: `Your quote for RFQ #${rfq.rfqNumber} has been shortlisted`,
            priority: 'MEDIUM',
            entityType: 'RFQ_RESPONSE',
            entityId: id,
            actionUrl: `/rfqs/${rfq.id}/responses/${id}`,
            actionLabel: 'View Response',
            metadata: { rfqNumber: rfq.rfqNumber },
          }),
          // To Buyer
          this.notificationHelperService.createNotification({
            userId: buyerId,
            type: 'RFQ',
            title: 'Response Shortlisted',
            message: `Response from ${supplierName} shortlisted for RFQ #${rfq.rfqNumber}`,
            priority: 'LOW',
            entityType: 'RFQ',
            entityId: rfq.id,
            actionUrl: `/rfqs/${rfq.id}/responses`,
            actionLabel: 'View Responses',
            metadata: { rfqNumber: rfq.rfqNumber, responseId: id },
          }),
        ]);
      } else if (status === 'REJECTED') {
        await this.notificationHelperService.createNotification({
          userId: response.supplierId,
          type: 'RFQ_RESPONSE',
          title: 'Quote Rejected',
          message: `Your quote for RFQ #${rfq.rfqNumber} has been rejected`,
          priority: 'LOW',
          entityType: 'RFQ_RESPONSE',
          entityId: id,
          actionUrl: `/rfqs/${rfq.id}/responses/${id}`,
          actionLabel: 'View Response',
          metadata: { rfqNumber: rfq.rfqNumber },
        });
      }
    } catch (error) {
      console.error('Failed to create notifications for RFQ response status update:', error);
    }

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: `RFQ_RESPONSE_${status}`,
        entityType: 'RFQ_RESPONSE',
        entityId: id,
        metadata: { rfqId: rfq.id, rfqNumber: rfq.rfqNumber, supplierId: response.supplierId },
      });
    } catch (error) {
      console.error('Failed to create activity log for RFQ response status update:', error);
    }

    return updatedResponse;
  }

  async awardRFQ(rfqId: string, responseId: string, buyerId: string) {
    const rfq = await this.getRFQById(rfqId);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only award your own RFQs');
    }

    const response = await this.getRFQResponseById(responseId);
    if (response.rfqId !== rfqId) {
      throw new BadRequestException('Response does not belong to this RFQ');
    }

    // Get all responses to notify other suppliers
    const allResponses = await this.prisma.rFQResponse.findMany({
      where: { rfqId },
      select: { id: true, supplierId: true, status: true },
    });

    // Update response status to AWARDED and RFQ status
    const [updatedResponse, updatedRFQ] = await Promise.all([
      this.prisma.rFQResponse.update({
        where: { id: responseId },
        data: { 
          status: 'AWARDED',
          awardedAt: new Date(),
        },
        include: {
          supplier: {
            include: {
              profile: true,
            },
          },
        },
      }),
      this.prisma.rFQ.update({
        where: { id: rfqId },
        data: { 
          status: 'AWARDED',
          awardedAt: new Date(),
        },
      }),
    ]);

    // Create notifications (per lifecycle: buyer, awarded supplier, other suppliers)
    try {
      const supplierName = updatedResponse.supplier.profile?.firstName || 'Supplier';
      await Promise.all([
        // To Buyer
        this.notificationHelperService.createNotification({
          userId: buyerId,
          type: 'RFQ',
          title: 'RFQ Awarded',
          message: `RFQ #${rfq.rfqNumber} awarded to ${supplierName}`,
          priority: 'HIGH',
          entityType: 'RFQ',
          entityId: rfqId,
          actionUrl: `/rfqs/${rfqId}`,
          actionLabel: 'View RFQ',
          metadata: { rfqNumber: rfq.rfqNumber, responseId },
        }),
        // To Awarded Supplier
        this.notificationHelperService.createNotification({
          userId: response.supplierId,
          type: 'RFQ_RESPONSE',
          title: 'RFQ Awarded',
          message: `Congratulations! Your quote for RFQ #${rfq.rfqNumber} has been awarded`,
          priority: 'HIGH',
          entityType: 'RFQ_RESPONSE',
          entityId: responseId,
          actionUrl: `/rfqs/${rfqId}/responses/${responseId}`,
          actionLabel: 'View Response',
          metadata: { rfqNumber: rfq.rfqNumber },
        }),
        // To Other Suppliers
        ...allResponses
          .filter(r => r.id !== responseId && r.status !== 'WITHDRAWN')
          .map(r =>
            this.notificationHelperService.createNotification({
              userId: r.supplierId,
              type: 'RFQ',
              title: 'RFQ Awarded',
              message: `RFQ #${rfq.rfqNumber} has been awarded to another supplier`,
              priority: 'MEDIUM',
              entityType: 'RFQ',
              entityId: rfqId,
              actionUrl: `/rfqs/${rfqId}`,
              actionLabel: 'View RFQ',
              metadata: { rfqNumber: rfq.rfqNumber },
            })
          ),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for RFQ award:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: buyerId,
          action: 'RFQ_AWARDED',
          entityType: 'RFQ',
          entityId: rfqId,
          metadata: { rfqNumber: rfq.rfqNumber, responseId, supplierId: response.supplierId },
        }),
        this.activityLogService.createActivityLog({
          userId: response.supplierId,
          action: 'RFQ_RESPONSE_AWARDED',
          entityType: 'RFQ_RESPONSE',
          entityId: responseId,
          metadata: { rfqId, rfqNumber: rfq.rfqNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for RFQ award:', error);
    }

    return updatedResponse;
  }

  async convertRFQResponseToOrder(rfqId: string, responseId: string, buyerId: string, deliveryAddress?: string, deliveryCounty?: string) {
    const rfq = await this.getRFQById(rfqId);
    const response = await this.getRFQResponseById(responseId);

    if (rfq.buyerId !== buyerId) {
      throw new BadRequestException('You can only convert responses from your own RFQs');
    }

    if (response.rfqId !== rfqId) {
      throw new BadRequestException('Response does not belong to this RFQ');
    }

    if (response.status !== 'AWARDED') {
      throw new BadRequestException('Only awarded RFQ responses can be converted to orders');
    }

    // Generate order number
    const orderNumber = await this.prisma.$queryRaw<Array<{ generate_order_number: string }>>`
      SELECT generate_order_number() as generate_order_number
    `;

    // Use batchId from response (mandatory) and verify batch exists
    if (!response.batchId) {
      throw new BadRequestException('RFQ response must have a batchId. Batch selection is required when submitting a quote.');
    }

    // Get inventory item to verify batch exists and get aggregation center info
    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { batchId: response.batchId },
      include: {
        center: true, // Include aggregation center for relation access via batchId
      },
    });

    if (!inventoryItem) {
      throw new NotFoundException(`Batch ${response.batchId} not found in inventory`);
    }

    // Use batchId from response and QR code from response (or generate if not available)
    const batchId = response.batchId;
    const qrCode = response.qrCode || generateBatchTraceability().qrCode;

    const totalAmount = response.totalAmount;

    // Get buyer and supplier info
    const [buyer, supplier] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: buyerId },
        include: { profile: true },
      }),
      this.prisma.user.findUnique({
        where: { id: response.supplierId },
        include: { profile: true },
      }),
    ]);

    // Create order from RFQ response
    const order = await this.prisma.marketplaceOrder.create({
      data: {
        buyerId,
        farmerId: response.supplierId,
        orderNumber: orderNumber[0].generate_order_number,
        rfqId: rfqId,
        rfqResponseId: responseId,
        variety: rfq.variety!,
        quantity: response.quantity,
        pricePerKg: response.pricePerUnit,
        totalAmount,
        deliveryAddress: deliveryAddress || rfq.deliveryLocation || '',
        deliveryCounty: deliveryCounty || '',
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
        rfq: true,
        rfqResponse: true,
      },
    });

    // Update RFQ response to track conversion (if needed)
    // Note: Status remains AWARDED, but we link the order

    // Create notifications (per lifecycle: buyer, supplier)
    try {
      const supplierName = supplier?.profile?.firstName || 'Supplier';
      await Promise.all([
        // To Buyer
        this.notificationHelperService.createNotification({
          userId: buyerId,
          type: 'ORDER',
          title: 'Order Created from RFQ',
          message: `Order #${order.orderNumber} created from RFQ #${rfq.rfqNumber}`,
          priority: 'MEDIUM',
          entityType: 'ORDER',
          entityId: order.id,
          actionUrl: `/orders/${order.id}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: order.orderNumber, rfqNumber: rfq.rfqNumber },
        }),
        // To Supplier
        this.notificationHelperService.createNotification({
          userId: response.supplierId,
          type: 'ORDER',
          title: 'Order Created from RFQ',
          message: `RFQ #${rfq.rfqNumber} converted to order #${order.orderNumber}`,
          priority: 'HIGH',
          entityType: 'ORDER',
          entityId: order.id,
          actionUrl: `/orders/${order.id}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: order.orderNumber, rfqNumber: rfq.rfqNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for RFQ conversion:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: buyerId,
          action: 'RFQ_CONVERTED_TO_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, rfqId, rfqNumber: rfq.rfqNumber, responseId },
        }),
        this.activityLogService.createActivityLog({
          userId: response.supplierId,
          action: 'RFQ_RESPONSE_CONVERTED_TO_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, rfqId, rfqNumber: rfq.rfqNumber },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for RFQ conversion:', error);
    }

    return order;
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

    const isPublished = data.publishImmediately === true;
    const status = isPublished ? 'OPEN' : 'DRAFT';

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
        priceRangeMin: data.priceRangeMin,
        priceRangeMax: data.priceRangeMax,
        pricePerUnit: data.pricePerUnit,
        priceUnit: data.priceUnit,
        status,
      },
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
      },
    });

    try {
      await this.notificationHelperService.createNotification({
        userId: buyerId,
        type: 'SOURCING_REQUEST',
        title: isPublished ? 'Sourcing Request Published' : 'Sourcing Request Draft Saved',
        message: isPublished
          ? `Sourcing request #${sourcingRequest.requestId} published successfully`
          : `Sourcing request draft saved: ${title}`,
        priority: isPublished ? 'MEDIUM' : 'LOW',
        entityType: 'SOURCING_REQUEST',
        entityId: sourcingRequest.id,
        actionUrl: `/sourcing-requests/${sourcingRequest.id}`,
        actionLabel: 'View Request',
        metadata: { requestId: sourcingRequest.requestId },
      });
    } catch (error) {
      console.error('Failed to create notification for sourcing request creation:', error);
    }

    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: isPublished ? 'SOURCING_REQUEST_PUBLISHED' : 'SOURCING_REQUEST_CREATED',
        entityType: 'SOURCING_REQUEST',
        entityId: sourcingRequest.id,
        metadata: { requestId: sourcingRequest.requestId, status },
      });
    } catch (error) {
      console.error('Failed to create activity log for sourcing request creation:', error);
    }

    return sourcingRequest;
  }

  async updateSourcingRequest(
    id: string,
    data: UpdateSourcingRequestDto,
    buyerId: string,
  ) {
    const request = await this.getSourcingRequestById(id);

    // Validate ownership
    if (request.buyerId !== buyerId) {
      throw new BadRequestException('You can only update your own sourcing requests');
    }

    // Prevent updates to closed or fulfilled requests
    if (request.status === 'CLOSED' || request.status === 'FULFILLED') {
      throw new BadRequestException('Cannot update closed or fulfilled sourcing requests');
    }

    // Fields that can be updated for published requests (OPEN/URGENT)
    const allowedPublishedFields = ['deliveryDate', 'deliveryLocation', 'description'];
    const isPublishedRequest = request.status === 'OPEN' || request.status === 'URGENT';
    
    // Check if trying to update restricted fields on published request
    if (isPublishedRequest) {
      const restrictedFields = ['title', 'productType', 'variety', 'quantity', 'unit', 'qualityGrade', 'priceRangeMin', 'priceRangeMax', 'pricePerUnit', 'priceUnit'];
      const attemptedRestrictedFields = restrictedFields.filter(field => {
        return data[field] !== undefined;
      });
      
      if (attemptedRestrictedFields.length > 0) {
        throw new BadRequestException(
          `Cannot update ${attemptedRestrictedFields.join(', ')} on published requests. Only deliveryDate, deliveryLocation, and description can be updated.`
        );
      }
    }

    // Build update data
    const updateData: any = {};

    // Only allow these fields for draft requests
    if (request.status === 'DRAFT') {
      if (data.title !== undefined) {
        updateData.title = data.title;
      }
      if (data.productType !== undefined) {
        updateData.productType = data.productType as any;
      }
      if (data.variety !== undefined) {
        updateData.variety = data.variety as any;
      }
      if (data.quantity !== undefined) {
        updateData.quantity = data.quantity;
      }
      if (data.unit !== undefined) {
        updateData.unit = data.unit;
      }
      if (data.qualityGrade !== undefined) {
        updateData.qualityGrade = data.qualityGrade as any;
      }
      if (data.description !== undefined) {
        updateData.additionalRequirements = data.description;
      }
      // Price fields can only be updated for draft requests
      if (data.priceRangeMin !== undefined) {
        updateData.priceRangeMin = data.priceRangeMin;
      }
      if (data.priceRangeMax !== undefined) {
        updateData.priceRangeMax = data.priceRangeMax;
      }
      if (data.pricePerUnit !== undefined) {
        updateData.pricePerUnit = data.pricePerUnit;
      }
      if (data.priceUnit !== undefined) {
        updateData.priceUnit = data.priceUnit;
      }
    }

    // These fields can be updated for both draft and published requests
    if (data.deliveryDate !== undefined) {
      updateData.deadline = new Date(data.deliveryDate);
    }
    if (data.deliveryLocation !== undefined) {
      updateData.deliveryLocation = data.deliveryLocation;
    }
    if (data.description !== undefined) {
      updateData.additionalRequirements = data.description;
    }

    // Update the sourcing request
    const updatedRequest = await this.prisma.sourcingRequest.update({
      where: { id },
      data: updateData,
      include: {
        buyer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create activity log (per lifecycle: updates tracked)
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'SOURCING_REQUEST_UPDATED',
        entityType: 'SOURCING_REQUEST',
        entityId: id,
        metadata: { requestId: request.requestId, updatedFields: Object.keys(updateData) },
      });
    } catch (error) {
      console.error('Failed to create activity log for sourcing request update:', error);
    }

    return updatedRequest;
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
    if (!data.sourcingRequestId) {
      throw new BadRequestException('Sourcing request ID is required');
    }
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
        sourcingRequestId: data.sourcingRequestId!,
        farmerId,
        quantity: data.quantity,
        quantityUnit: data.quantityUnit,
        pricePerKg: data.pricePerKg,
        qualityGrade: (data.qualityGrade || request.qualityGrade || 'A') as any,
        batchId: data.batchId || null,
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

    if (offer.status === 'accepted') {
      throw new BadRequestException('This offer has already been accepted');
    }

    if (offer.status === 'rejected') {
      throw new BadRequestException('This offer has been rejected and cannot be accepted');
    }

    if (offer.status === 'converted') {
      throw new BadRequestException('This offer has already been converted to an order');
    }

    // Stage 4 & 5: Accept offer and automatically convert to order (per lifecycle)
    // Update offer status to accepted first
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

    // Stage 5: Automatically create order from accepted offer
    // Generate order number
    const orderNumber = await this.prisma.$queryRaw<Array<{ generate_order_number: string }>>`
      SELECT generate_order_number() as generate_order_number
    `;

    // Use batchId from offer (mandatory) and verify batch exists in inventory
    if (!offer.batchId) {
      throw new BadRequestException('Offer must have a batchId. Batch selection is required when submitting an offer.');
    }

    // Get inventory item to verify batch exists and get aggregation center info
    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { batchId: offer.batchId },
      include: {
        center: true, // Include aggregation center for relation access via batchId
      },
    });

    if (!inventoryItem) {
      throw new NotFoundException(`Batch ${offer.batchId} not found in inventory`);
    }

    // Use batchId from offer and QR code from offer (or generate if not available)
    const batchId = offer.batchId;
    const qrCode = offer.qrCode || generateBatchTraceability().qrCode;

    // Convert offer quantity to kg (orders store quantity in kg)
    let quantityInKg = offer.quantity;
    if (offer.quantityUnit === 'tons') {
      quantityInKg = offer.quantity * 1000;
    } else if (offer.quantityUnit === 'units') {
      // Assume 1 unit = 50kg for bags (common for sweet potatoes)
      quantityInKg = offer.quantity * 50;
    }

    const totalAmount = quantityInKg * offer.pricePerKg;

    // Get buyer and farmer info for notifications
    const [buyer, farmer] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: buyerId },
        include: { profile: true },
      }),
      this.prisma.user.findUnique({
        where: { id: offer.farmerId },
        include: { profile: true },
      }),
    ]);

    // Create order from supplier offer
    const order = await this.prisma.marketplaceOrder.create({
      data: {
        buyerId,
        farmerId: offer.farmerId,
        orderNumber: orderNumber[0].generate_order_number,
        supplierOfferId: offerId,
        sourcingRequestId: offer.sourcingRequestId,
        variety: offer.sourcingRequest.variety as any,
        quantity: quantityInKg,
        pricePerKg: offer.pricePerKg,
        totalAmount,
        deliveryAddress: offer.sourcingRequest.deliveryLocation || offer.sourcingRequest.deliveryRegion || '',
        deliveryCounty: offer.sourcingRequest.deliveryRegion || '',
        deliveryNotes: offer.sourcingRequest.additionalRequirements || null,
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
      },
    });

    // Update offer status to converted and link to order
    await this.prisma.supplierOffer.update({
      where: { id: offerId },
      data: { 
        status: 'converted',
        orderId: order.id,
      },
    });

    // Update sourcing request fulfilled quantity (per lifecycle: Stage 5 - Converted to Order)
    // Convert offer quantity to the same unit as sourcing request for accurate calculation
    let offerQuantityInRequestUnit = offer.quantity;
    if (offer.quantityUnit !== offer.sourcingRequest.unit) {
      // Convert to kg first, then to request unit
      let quantityInKgForRequest = offer.quantity;
      if (offer.quantityUnit === 'tons') {
        quantityInKgForRequest = offer.quantity * 1000;
      } else if (offer.quantityUnit === 'units') {
        // Assume 1 unit = 50kg for bags (common for sweet potatoes)
        quantityInKgForRequest = offer.quantity * 50;
      }
      
      // Convert from kg to request unit
      if (offer.sourcingRequest.unit === 'tons') {
        offerQuantityInRequestUnit = quantityInKgForRequest / 1000;
      } else if (offer.sourcingRequest.unit === 'units') {
        offerQuantityInRequestUnit = quantityInKgForRequest / 50;
      } else {
        offerQuantityInRequestUnit = quantityInKgForRequest;
      }
    }

    const newFulfilled = (offer.sourcingRequest.fulfilled || 0) + offerQuantityInRequestUnit;
    const isFullyFulfilled = newFulfilled >= offer.sourcingRequest.quantity;
    const oldStatus = offer.sourcingRequest.status;
    
    await this.prisma.sourcingRequest.update({
      where: { id: offer.sourcingRequest.id },
      data: {
        fulfilled: newFulfilled,
        status: isFullyFulfilled ? 'FULFILLED' : offer.sourcingRequest.status,
      },
    });

    // Create activity log for sourcing request fulfillment status change (per lifecycle)
    if (isFullyFulfilled && oldStatus !== 'FULFILLED') {
      try {
        await this.activityLogService.createActivityLog({
          userId: buyerId,
          action: 'SOURCING_REQUEST_FULFILLED',
          entityType: 'SOURCING_REQUEST',
          entityId: offer.sourcingRequest.id,
          metadata: { 
            requestId: offer.sourcingRequest.requestId,
            orderId: order.id,
            offerId: offer.id,
            fulfilledQuantity: newFulfilled,
            totalQuantity: offer.sourcingRequest.quantity,
          },
        });
      } catch (error) {
        console.error('Failed to create activity log for sourcing request fulfillment:', error);
      }
    }

    // Create activity logs for offer acceptance
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

    // Create general order activity logs
    try {
      await Promise.all([
        this.activityLogService.logOrderCreated(order, buyerId, { source: 'sourcing_request' }),
        this.activityLogService.logOrderCreated(order, offer.farmerId, { source: 'sourcing_request' }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for order creation:', error);
    }

    // Create notifications (per lifecycle: Stage 5 - Converted to Order)
    try {
      await Promise.all([
        // To Supplier: "Sourcing request #XXX converted to order #YYY"
        this.notificationHelperService.createNotification({
          userId: offer.farmerId,
          type: 'SUPPLIER_OFFER',
          title: 'Offer Converted to Order',
          message: `Sourcing request #${offer.sourcingRequest.requestId} converted to order #${order.orderNumber}`,
          priority: 'HIGH',
          entityType: 'MARKETPLACE_ORDER',
          entityId: order.id,
          actionUrl: `/orders/${order.id}`,
          actionLabel: 'View Order',
          metadata: { requestId: offer.sourcingRequest.requestId, orderNumber: order.orderNumber },
        }),
        // To Buyer: "Order #YYY created from sourcing request #XXX"
        this.notificationHelperService.createNotification({
          userId: buyerId,
          type: 'MARKETPLACE_ORDER',
          title: 'Order Created from Sourcing Request',
          message: `Order #${order.orderNumber} created from sourcing request #${offer.sourcingRequest.requestId}`,
          priority: 'MEDIUM',
          entityType: 'MARKETPLACE_ORDER',
          entityId: order.id,
          actionUrl: `/orders/${order.id}`,
          actionLabel: 'View Order',
          metadata: { requestId: offer.sourcingRequest.requestId, orderNumber: order.orderNumber },
        }),
        // General order placed notifications
        this.notificationHelperService.notifyOrderPlaced(order, buyer, farmer),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for supplier offer conversion:', error);
    }

    // Return updated offer with order information
    return await this.prisma.supplierOffer.findUnique({
      where: { id: offerId },
      include: {
        sourcingRequest: true,
        farmer: {
          include: {
            profile: true,
          },
        },
        order: true,
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
          message: `New negotiation request from ${negotiation.buyer?.profile?.firstName || negotiation.buyer?.email || 'Buyer'} for ${listing.variety}`,
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
      const updated = await this.prisma.negotiation.update({
        where: { id: negotiationId },
        data: {
          status: 'COUNTER_OFFER',
          negotiatedPricePerKg: data.counterPrice,
          negotiatedQuantity: data.counterQuantity,
          negotiatedTotalAmount: totalAmount,
          lastMessageAt: new Date(),
        },
        include: {
          buyer: {
            include: {
              profile: true,
            },
          },
          listing: {
            include: {
              farmer: {
                include: {
                  profile: true,
                },
              },
            },
          },
          messages: true,
        },
      });
      updatedNegotiation = updated;
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

  // ============ Recurring Orders ============

  async getRecurringOrders(filters?: {
    buyerId?: string;
    farmerId?: string;
    isActive?: boolean;
  }) {
    const where: any = {};

    if (filters?.buyerId) {
      where.buyerId = filters.buyerId;
    }
    if (filters?.farmerId) {
      where.farmerId = filters.farmerId;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.recurringOrder.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecurringOrderById(id: string) {
    const order = await this.prisma.recurringOrder.findUnique({
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
      },
    });

    if (!order) {
      throw new NotFoundException(`Recurring order with ID ${id} not found`);
    }

    return order;
  }

  async createRecurringOrder(data: {
    buyerId: string;
    farmerId: string;
    variety: string;
    quantity: number;
    qualityGrade: string;
    pricePerKg: number;
    frequency: string;
    startDate: string;
    endDate?: string;
    nextDeliveryDate: string;
  }, buyerId: string) {
    if (data.buyerId !== buyerId) {
      throw new BadRequestException('You can only create recurring orders for yourself');
    }

    const recurringOrder = await this.prisma.recurringOrder.create({
      data: {
        buyerId: data.buyerId,
        farmerId: data.farmerId,
        variety: data.variety as any,
        quantity: data.quantity,
        qualityGrade: data.qualityGrade as any,
        pricePerKg: data.pricePerKg,
        frequency: data.frequency as any,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextDeliveryDate: new Date(data.nextDeliveryDate),
        isActive: true,
        status: 'active',
      },
    });

    // Create notifications
    try {
      await Promise.all([
        this.notificationHelperService.createNotification({
          userId: data.buyerId,
          type: 'ORDER',
          title: 'Recurring Order Created',
          message: `Recurring order created with ${data.farmerId}`,
          priority: 'LOW',
          entityType: 'RECURRING_ORDER',
          entityId: recurringOrder.id,
          actionUrl: `/recurring-orders/${recurringOrder.id}`,
          actionLabel: 'View Order',
          metadata: { frequency: data.frequency },
        }),
        this.notificationHelperService.createNotification({
          userId: data.farmerId,
          type: 'ORDER',
          title: 'Recurring Order Created',
          message: `A recurring order has been created with you`,
          priority: 'MEDIUM',
          entityType: 'RECURRING_ORDER',
          entityId: recurringOrder.id,
          actionUrl: `/recurring-orders/${recurringOrder.id}`,
          actionLabel: 'View Order',
          metadata: { frequency: data.frequency },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create notifications for recurring order:', error);
    }

    // Create activity logs
    try {
      await Promise.all([
        this.activityLogService.createActivityLog({
          userId: data.buyerId,
          action: 'RECURRING_ORDER_CREATED',
          entityType: 'RECURRING_ORDER',
          entityId: recurringOrder.id,
          metadata: { frequency: data.frequency, farmerId: data.farmerId },
        }),
        this.activityLogService.createActivityLog({
          userId: data.farmerId,
          action: 'RECURRING_ORDER_RECEIVED',
          entityType: 'RECURRING_ORDER',
          entityId: recurringOrder.id,
          metadata: { frequency: data.frequency, buyerId: data.buyerId },
        }),
      ]);
    } catch (error) {
      console.error('Failed to create activity logs for recurring order:', error);
    }

    return recurringOrder;
  }

  async updateRecurringOrder(id: string, data: {
    quantity?: number;
    pricePerKg?: number;
    frequency?: string;
    nextDeliveryDate?: string;
    status?: string;
  }, userId: string) {
    const order = await this.getRecurringOrderById(id);

    // Verify user owns the order (buyer or farmer)
    if (order.buyerId !== userId && order.farmerId !== userId) {
      throw new BadRequestException('You can only update your own recurring orders');
    }

    const updateData: any = {};
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.pricePerKg !== undefined) updateData.pricePerKg = data.pricePerKg;
    if (data.frequency) updateData.frequency = data.frequency as any;
    if (data.nextDeliveryDate) updateData.nextDeliveryDate = new Date(data.nextDeliveryDate);
    if (data.status) {
      updateData.status = data.status;
      updateData.isActive = data.status === 'active';
    }

    const updatedOrder = await this.prisma.recurringOrder.update({
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
      },
    });

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId,
        action: 'RECURRING_ORDER_UPDATED',
        entityType: 'RECURRING_ORDER',
        entityId: id,
        metadata: { updates: data },
      });
    } catch (error) {
      console.error('Failed to create activity log for recurring order update:', error);
    }

    return updatedOrder;
  }

  async deleteRecurringOrder(id: string, userId: string) {
    const order = await this.getRecurringOrderById(id);

    // Verify user owns the order (buyer or farmer)
    if (order.buyerId !== userId && order.farmerId !== userId) {
      throw new BadRequestException('You can only delete your own recurring orders');
    }

    await this.prisma.recurringOrder.delete({
      where: { id },
    });

    // Create activity logs
    try {
      await this.activityLogService.createActivityLog({
        userId,
        action: 'RECURRING_ORDER_DELETED',
        entityType: 'RECURRING_ORDER',
        entityId: id,
        metadata: {},
      });
    } catch (error) {
      console.error('Failed to create activity log for recurring order deletion:', error);
    }

    return { message: 'Recurring order deleted successfully' };
  }

  // ============ Statistics ============

  async getMarketplaceStats() {
    const [totalListings, totalOrders, totalRFQs, totalSourcingRequests, totalRecurringOrders] = await Promise.all([
      this.prisma.produceListing.count(),
      this.prisma.marketplaceOrder.count(),
      this.prisma.rFQ.count(),
      this.prisma.sourcingRequest.count(),
      this.prisma.recurringOrder.count({ where: { isActive: true } }),
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
      totalRecurringOrders,
      ordersByStatus: ordersByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
    };
  }
}
