import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import {
  CreateAggregationCenterDto,
  UpdateAggregationCenterDto,
  CreateStockTransactionDto,
  CreateQualityCheckDto,
  CreateWastageEntryDto,
} from './dto';

@Injectable()
export class AggregationService {
  constructor(
    private prisma: PrismaService,
    private notificationHelperService: NotificationHelperService,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => MarketplaceService))
    private marketplaceService: MarketplaceService,
  ) {}

  // ============ Aggregation Centers ============

  async getAggregationCenters(filters?: {
    centerType?: string;
    status?: string;
    county?: string;
  }) {
    const where: any = {};

    if (filters?.centerType) {
      where.centerType = filters.centerType;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.county) {
      where.county = filters.county;
    }

    return this.prisma.aggregationCenter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAggregationCenterById(id: string) {
    const center = await this.prisma.aggregationCenter.findUnique({
      where: { id },
      include: {
        manager: {
          include: {
            profile: true,
          },
        },
        mainCenter: true,
        satelliteCenters: true,
        inventory: {
          orderBy: { stockInDate: 'desc' },
        },
      },
    });

    if (!center) {
      throw new NotFoundException(`Aggregation Center with ID ${id} not found`);
    }

    return center;
  }

  async createAggregationCenter(data: CreateAggregationCenterDto) {
    // Generate center code (simple format: AC-YYYYMMDD-000001)
    const codePrefix = 'AC';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const centerCode = `${codePrefix}-${dateStr}-${randomSuffix}`;

    return this.prisma.aggregationCenter.create({
      data: {
        name: data.name,
        code: centerCode,
        location: data.location,
        county: data.county,
        subCounty: data.subCounty,
        ward: data.ward,
        coordinates: data.coordinates,
        centerType: data.centerType as any,
        mainCenterId: data.mainCenterId,
        totalCapacity: data.totalCapacity,
        managerId: data.managerId,
        managerName: data.managerName || '',
        managerPhone: data.managerPhone || '',
        status: (data.status as any) || 'OPERATIONAL',
      },
    });
  }

  async updateAggregationCenter(id: string, data: UpdateAggregationCenterDto) {
    return this.prisma.aggregationCenter.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.location && { location: data.location }),
        ...(data.county && { county: data.county }),
        ...(data.subCounty && { subCounty: data.subCounty }),
        ...(data.ward && { ward: data.ward }),
        ...(data.coordinates && { coordinates: data.coordinates }),
        ...(data.centerType && { centerType: data.centerType as any }),
        ...(data.mainCenterId && { mainCenterId: data.mainCenterId }),
        ...(data.totalCapacity !== undefined && { totalCapacity: data.totalCapacity }),
        ...(data.managerId && { managerId: data.managerId }),
        ...(data.managerName && { managerName: data.managerName }),
        ...(data.managerPhone && { managerPhone: data.managerPhone }),
        ...(data.status && { status: data.status as any }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  // ============ Stock Transactions ============

  async getStockTransactions(filters?: {
    centerId?: string;
    type?: string;
    variety?: string;
    dateFrom?: string;
    dateTo?: string;
    batchId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.centerId) {
      where.centerId = filters.centerId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.variety) {
      where.variety = filters.variety;
    }
    if (filters?.batchId) {
      where.batchId = { contains: filters.batchId, mode: 'insensitive' };
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    return this.prisma.stockTransaction.findMany({
      where,
      include: {
        center: true,
        order: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Search for batches using PostgreSQL full-text search
   * Searches by batchId, qrCode, and farmer name (from Profile table)
   * Uses tsvector and tsquery for efficient text search
   */
  async searchBatches(query: string, limit: number = 10) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Sanitize query for PostgreSQL full-text search
    // Replace special characters and prepare for tsquery
    const sanitizedQuery = query.trim().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' & ');
    const likeQuery = `%${query.trim()}%`;
    
    // Use PostgreSQL full-text search with ranking
    // Search by batchId, qrCode, and farmer name (from Profile table - firstName + lastName)
    // Using Prisma.sql for proper parameterization to prevent SQL injection
    const results = await this.prisma.$queryRaw<Array<{
      id: string;
      batchId: string | null;
      qrCode: string | null;
      variety: string;
      quantity: number;
      qualityGrade: string;
      farmerId: string | null;
      farmerName: string | null;
      centerId: string;
      centerName: string | null;
      createdAt: Date;
      type: string;
      transactionNumber: string;
      rank: number;
    }>>(
      Prisma.sql`
        SELECT 
          st.id,
          st."batchId",
          st."qrCode",
          st.variety,
          st.quantity,
          st."qualityGrade",
          st."farmerId",
          COALESCE(p."firstName" || ' ' || p."lastName", st."farmerName", u.email) as "farmerName",
          st."centerId",
          st."centerName",
          st."createdAt",
          st.type,
          st."transactionNumber",
          ts_rank(
            to_tsvector('simple', COALESCE(st."batchId", '') || ' ' || COALESCE(st."qrCode", '') || ' ' || COALESCE(p."firstName" || ' ' || p."lastName", st."farmerName", u.email, '')),
            plainto_tsquery('simple', ${sanitizedQuery})
          ) as rank
        FROM stock_transactions st
        LEFT JOIN users u ON st."farmerId" = u.id
        LEFT JOIN profiles p ON u.id = p."userId"
        WHERE 
          st."batchId" IS NOT NULL
          AND (
            to_tsvector('simple', COALESCE(st."batchId", '') || ' ' || COALESCE(st."qrCode", '') || ' ' || COALESCE(p."firstName" || ' ' || p."lastName", st."farmerName", u.email, '')) 
            @@ plainto_tsquery('simple', ${sanitizedQuery})
            OR st."batchId" ILIKE ${likeQuery}
            OR st."qrCode" ILIKE ${likeQuery}
            OR (p."firstName" || ' ' || p."lastName") ILIKE ${likeQuery}
            OR st."farmerName" ILIKE ${likeQuery}
            OR u.email ILIKE ${likeQuery}
          )
        ORDER BY 
          rank DESC,
          st."createdAt" DESC
        LIMIT ${limit}
      `
    );

    // Fetch full transaction details with relations
    if (results.length === 0) {
      return [];
    }

    const transactionIds = results.map((r) => r.id);
    const transactions = await this.prisma.stockTransaction.findMany({
      where: {
        id: { in: transactionIds },
      },
      include: {
        center: true,
        order: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map results to maintain ranking order
    const transactionMap = new Map(transactions.map((t) => [t.id, t]));
    return results
      .map((r) => transactionMap.get(r.id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
  }

  /**
   * Search for orders using PostgreSQL full-text search
   * Searches by orderNumber and buyer name (from User table)
   * Uses tsvector and tsquery for efficient text search
   */
  async searchOrders(query: string, limit: number = 10) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Sanitize query for PostgreSQL full-text search
    // Replace special characters and prepare for tsquery
    const sanitizedQuery = query.trim().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' & ');
    const likeQuery = `%${query.trim()}%`;
    
    // Use PostgreSQL full-text search with ranking
    // Search by orderNumber and buyer name (from Profile table - firstName + lastName)
    // qualityGrade comes from ProduceListing if listingId exists
    const results = await this.prisma.$queryRaw<Array<{
      id: string;
      orderNumber: string;
      buyerId: string;
      buyerName: string | null;
      buyerPhone: string | null;
      variety: string;
      quantity: number;
      qualityGrade: string | null;
      status: string;
      totalAmount: number;
      createdAt: Date;
      rank: number;
    }>>(
      Prisma.sql`
        SELECT 
          mo.id,
          mo."orderNumber",
          mo."buyerId",
          COALESCE(p."firstName" || ' ' || p."lastName", u.email) as "buyerName",
          u.phone as "buyerPhone",
          mo.variety,
          mo.quantity,
          pl."qualityGrade",
          mo.status,
          mo."totalAmount",
          mo."createdAt",
          ts_rank(
            to_tsvector('simple', COALESCE(mo."orderNumber", '') || ' ' || COALESCE(p."firstName" || ' ' || p."lastName", u.email, '')),
            plainto_tsquery('simple', ${sanitizedQuery})
          ) as rank
        FROM marketplace_orders mo
        INNER JOIN users u ON mo."buyerId" = u.id
        LEFT JOIN profiles p ON u.id = p."userId"
        LEFT JOIN produce_listings pl ON mo."listingId" = pl.id
        WHERE 
          (mo."stockOutRecorded" IS NULL OR mo."stockOutRecorded" = false)
          AND (
            to_tsvector('simple', COALESCE(mo."orderNumber", '') || ' ' || COALESCE(p."firstName" || ' ' || p."lastName", u.email, '')) 
            @@ plainto_tsquery('simple', ${sanitizedQuery})
            OR mo."orderNumber" ILIKE ${likeQuery}
            OR (p."firstName" || ' ' || p."lastName") ILIKE ${likeQuery}
            OR u.email ILIKE ${likeQuery}
          )
        ORDER BY 
          rank DESC,
          mo."createdAt" DESC
        LIMIT ${limit}
      `
    );

    // Return results directly (they already have all needed fields)
    return results.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      buyerId: order.buyerId,
      buyerName: order.buyerName || '',
      buyerPhone: order.buyerPhone || '',
      variety: order.variety,
      quantity: order.quantity,
      qualityGrade: order.qualityGrade || 'B', // Default to 'B' if not available
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    }));
  }

  /**
   * Confirm a pending stock transaction
   * Changes status from PENDING_CONFIRMATION to CONFIRMED
   * Creates inventory item when confirmed
   */
  async confirmStockTransaction(transactionId: string, userId: string) {
    const transaction = await this.prisma.stockTransaction.findUnique({
      where: { id: transactionId },
      include: {
        center: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Stock transaction with ID ${transactionId} not found`);
    }

    if (transaction.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException(
        `Transaction is not pending confirmation. Current status: ${transaction.status}`,
      );
    }

    if (transaction.type !== 'STOCK_IN') {
      throw new BadRequestException('Only STOCK_IN transactions can be confirmed');
    }

    // Update transaction status to CONFIRMED
    const updatedTransaction = await this.prisma.stockTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'CONFIRMED',
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
      include: {
        center: true,
        order: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create inventory item now that transaction is confirmed
    if (updatedTransaction.batchId) {
      try {
        const existingInventory = await this.prisma.inventoryItem.findUnique({
          where: { batchId: updatedTransaction.batchId },
        });

        if (!existingInventory) {
          await this.prisma.inventoryItem.create({
            data: {
              centerId: updatedTransaction.centerId,
              variety: updatedTransaction.variety,
              quantity: updatedTransaction.quantity,
              qualityGrade: updatedTransaction.qualityGrade as any,
              batchId: updatedTransaction.batchId,
              stockInDate: new Date(),
              farmerId: updatedTransaction.farmerId || undefined,
              farmerName: updatedTransaction.farmerName || undefined,
              stockTransactionId: updatedTransaction.id,
            },
          });
        } else {
          // Update existing inventory if batch already exists
          await this.prisma.inventoryItem.update({
            where: { id: existingInventory.id },
            data: {
              quantity: existingInventory.quantity + updatedTransaction.quantity,
            },
          });
        }
      } catch (error) {
        console.error('Failed to create inventory item:', error);
        // Don't fail the transaction if inventory creation fails
      }
    }

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'STOCK_TRANSACTION_CONFIRMED',
      entityType: 'STOCK_TRANSACTION',
      entityId: transactionId,
      metadata: {
        transactionNumber: updatedTransaction.transactionNumber,
        batchId: updatedTransaction.batchId,
        quantity: updatedTransaction.quantity,
      },
    });

    return updatedTransaction;
  }

  /**
   * Reject a pending stock transaction
   * Changes status from PENDING_CONFIRMATION to REJECTED
   */
  async rejectStockTransaction(
    transactionId: string,
    userId: string,
    reason: string,
  ) {
    const transaction = await this.prisma.stockTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Stock transaction with ID ${transactionId} not found`);
    }

    if (transaction.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException(
        `Transaction is not pending confirmation. Current status: ${transaction.status}`,
      );
    }

    // Update transaction status to REJECTED
    const updatedTransaction = await this.prisma.stockTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'REJECTED',
        confirmedBy: userId,
        confirmedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        center: true,
        order: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'STOCK_TRANSACTION_REJECTED',
      entityType: 'STOCK_TRANSACTION',
      entityId: transactionId,
      metadata: {
        transactionNumber: updatedTransaction.transactionNumber,
        batchId: updatedTransaction.batchId,
        rejectionReason: reason,
      },
    });

    // Notify farmer if transaction is rejected
    if (updatedTransaction.farmerId) {
      try {
        await this.notificationHelperService.createNotification({
          userId: updatedTransaction.farmerId,
          type: 'STOCK_TRANSACTION',
          title: 'Stock Transaction Rejected',
          message: `Your stock transaction (Batch: ${updatedTransaction.batchId}) was rejected. Reason: ${reason}`,
          priority: 'HIGH',
          entityType: 'STOCK_TRANSACTION',
          entityId: transactionId,
          actionUrl: `/stock-transactions/${transactionId}`,
          actionLabel: 'View Transaction',
          metadata: {
            batchId: updatedTransaction.batchId,
            rejectionReason: reason,
          },
        });
      } catch (error) {
        console.error('Failed to create rejection notification:', error);
      }
    }

    return updatedTransaction;
  }

  async createStockIn(data: CreateStockTransactionDto, userId: string) {
    // Generate transaction number
    const transactionNumber = await this.prisma.$queryRaw<Array<{ generate_stock_transaction_number: string }>>`
      SELECT generate_stock_transaction_number() as generate_stock_transaction_number
    `;

    // Get the destination center to check if it's a main center
    const destinationCenter = await this.prisma.aggregationCenter.findUnique({
      where: { id: data.centerId },
      select: { centerType: true, name: true },
    });

    if (!destinationCenter) {
      throw new BadRequestException('Destination aggregation center not found');
    }

    // Check if this is a transfer from satellite to main center
    const isTransferFromSatellite = data.sourceCenterId && destinationCenter.centerType === 'MAIN';
    let sourceCenter: { centerType: string; name: string } | null = null;
    let transferTransaction: { type: string; centerId: string; quantity: number } | null = null;

    if (isTransferFromSatellite && data.sourceCenterId) {
      // Verify source center exists and is a satellite
      const foundSourceCenter = await this.prisma.aggregationCenter.findUnique({
        where: { id: data.sourceCenterId },
        select: { centerType: true, name: true },
      });

      if (!foundSourceCenter) {
        throw new BadRequestException('Source aggregation center not found');
      }

      sourceCenter = foundSourceCenter;

      if (sourceCenter.centerType !== 'SATELLITE') {
        throw new BadRequestException('Source center must be a SATELLITE center for transfers');
      }

      // If transfer transaction ID is provided, verify it exists and is a STOCK_OUT
      if (data.transferTransactionId) {
        const foundTransaction = await this.prisma.stockTransaction.findUnique({
          where: { id: data.transferTransactionId },
          select: { type: true, centerId: true, quantity: true },
        });

        if (!foundTransaction) {
          throw new BadRequestException('Transfer transaction not found');
        }

        transferTransaction = foundTransaction;

        if (transferTransaction.type !== 'STOCK_OUT') {
          throw new BadRequestException('Transfer transaction must be a STOCK_OUT type');
        }

        if (transferTransaction.centerId !== data.sourceCenterId) {
          throw new BadRequestException('Transfer transaction does not match source center');
        }

        // Verify quantity matches (optional validation)
        if (Math.abs(transferTransaction.quantity - data.quantity) > 0.01) {
          console.warn(`Quantity mismatch: transfer transaction has ${transferTransaction.quantity}kg, but stock in is ${data.quantity}kg`);
        }
      }
    }

    // Get farmer info from order if orderId is provided and farmerId is not
    let farmerId = data.farmerId;
    let farmerName = data.farmerName;
    let validOrderId: string | undefined = undefined;

    // Validate orderId exists if provided
    if (data.orderId) {
      const order = await this.prisma.marketplaceOrder.findUnique({
        where: { id: data.orderId },
        select: { id: true, farmerId: true },
      });
      if (order) {
        validOrderId = order.id;
        // Get farmer info from order if farmerId is not provided
        if (!farmerId && order.farmerId) {
          farmerId = order.farmerId;
          // Get farmer name from profile
          const profile = await this.prisma.profile.findUnique({
            where: { userId: farmerId },
            select: { firstName: true, lastName: true },
          });
          if (profile) {
            farmerName = `${profile.firstName} ${profile.lastName}`;
          }
        }
      } else {
        // Order doesn't exist, log warning but don't fail - set orderId to undefined
        console.warn(`Order ID ${data.orderId} not found, creating stock transaction without order reference`);
      }
    }

    // If transfer, get farmer info from source transaction if not provided
    if (isTransferFromSatellite && transferTransaction && !farmerId) {
      const sourceTransaction = await this.prisma.stockTransaction.findUnique({
        where: { id: data.transferTransactionId! },
        select: { farmerId: true, farmerName: true },
      });
      if (sourceTransaction?.farmerId) {
        farmerId = sourceTransaction.farmerId;
        farmerName = sourceTransaction.farmerName || undefined;
      }
    }

    // If batchId is provided, look up existing batch info to populate farmer info if not provided
    if (data.batchId && !farmerId) {
      const existingBatchTransaction = await this.prisma.stockTransaction.findFirst({
        where: { batchId: data.batchId },
        select: { farmerId: true, farmerName: true, variety: true },
        orderBy: { createdAt: 'desc' },
      });
      if (existingBatchTransaction?.farmerId) {
        farmerId = existingBatchTransaction.farmerId;
        farmerName = existingBatchTransaction.farmerName || undefined;
      }
    }

    // Generate batchId if not provided
    let batchId = data.batchId;
    if (!batchId) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      batchId = `BATCH-${timestamp}-${random}`;
    }

    // Generate QR code if batchId exists and qrCode not provided
    let qrCode = data.qrCode;
    if (batchId && !qrCode) {
      qrCode = `QR-${batchId}`;
    }

    // Determine transaction type: TRANSFER if from satellite, STOCK_IN otherwise
    const transactionType = isTransferFromSatellite ? 'TRANSFER' : 'STOCK_IN';
    
    // Set status: CONFIRMED for manual stock-in, PENDING_CONFIRMATION if created from pickup
    // If batchId exists and was created from pickup, it should already have PENDING_CONFIRMATION status
    // For manual stock-in at center, set to CONFIRMED
    const transactionStatus = 'CONFIRMED'; // Manual stock-in is always confirmed immediately

    const stockTransaction = await this.prisma.stockTransaction.create({
      data: {
        centerId: data.centerId,
        transactionNumber: transactionNumber[0].generate_stock_transaction_number,
        type: transactionType,
        variety: data.variety,
        quantity: data.quantity,
        qualityGrade: data.qualityGrade as any,
        // Grading Matrix Criteria
        weightRange: data.weightRange,
        colorIntensity: data.colorIntensity,
        physicalCondition: data.physicalCondition,
        freshness: data.freshness,
        daysSinceHarvest: data.daysSinceHarvest,
        pricePerKg: data.pricePerKg,
        totalAmount: data.quantity * (data.pricePerKg || 0),
        orderId: validOrderId, // Only set if order exists
        farmerId,
        farmerName,
        batchId: batchId,
        qrCode: qrCode,
        status: transactionStatus,
        notes: isTransferFromSatellite
          ? `Transfer from ${sourceCenter?.name || 'satellite center'}${data.transferTransactionId ? ` (Transaction: ${data.transferTransactionId})` : ''}. ${data.notes || ''}`.trim()
          : data.notes,
        createdBy: userId,
      },
      include: {
        center: true,
        order: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create inventory item for traceability (per lifecycle requirements)
    // Only create inventory if transaction is CONFIRMED (not PENDING_CONFIRMATION)
    let inventoryItem: { id: string } | null = null;
    if (batchId && stockTransaction.status === 'CONFIRMED') {
      try {
        // Check if inventory item already exists for this batch
        const existingInventory = await this.prisma.inventoryItem.findUnique({
          where: { batchId: batchId },
        });

        if (!existingInventory) {
          const created = await this.prisma.inventoryItem.create({
            data: {
              centerId: data.centerId,
              variety: data.variety,
              quantity: data.quantity,
              qualityGrade: data.qualityGrade as any,
              batchId: batchId,
              stockInDate: new Date(),
              farmerId: farmerId || undefined,
              farmerName: farmerName || undefined,
              stockTransactionId: stockTransaction.id,
            },
          });
          inventoryItem = { id: created.id };
        } else {
          // Update existing inventory if batch already exists
          const updated = await this.prisma.inventoryItem.update({
            where: { id: existingInventory.id },
            data: {
              quantity: existingInventory.quantity + data.quantity,
            },
          });
          inventoryItem = { id: updated.id };
        }
      } catch (error) {
        console.error('Failed to create inventory item:', error);
        // Don't fail the transaction if inventory creation fails
      }
    }

    // Automatically create a listing when stock in is recorded (if farmer exists)
    // Only create listing for STOCK_IN (not TRANSFER) and if farmerId exists
    if (farmerId && transactionType === 'STOCK_IN' && !isTransferFromSatellite) {
      try {
        // Check if listing already exists for this batchId
        const existingListing = batchId 
          ? await this.prisma.produceListing.findUnique({
              where: { batchId: batchId },
            })
          : null;

        if (!existingListing) {
          // Get location information from aggregation center or farmer profile
          const center = stockTransaction.center;
          const farmerProfile = stockTransaction.farmer?.profile;

          // Calculate harvest date: use daysSinceHarvest if available, otherwise use current date
          const harvestDate = data.daysSinceHarvest 
            ? new Date(Date.now() - data.daysSinceHarvest * 24 * 60 * 60 * 1000)
            : new Date();

          // Get location details - prefer center location, fallback to farmer profile
          const county = center?.county || farmerProfile?.county || 'Unknown';
          const subCounty = center?.subCounty || farmerProfile?.subCounty || undefined;
          const location = center?.location || farmerProfile?.address || county;

          // Set default pricePerKg if not provided (use a reasonable default or make it configurable)
          // For now, using a default based on quality grade
          const defaultPricePerKg: Record<string, number> = {
            'A': 80, // Premium grade
            'B': 60, // Standard grade
            'C': 40, // Processing grade
          };
          const pricePerKg = data.pricePerKg || defaultPricePerKg[data.qualityGrade] || 60;

          await this.prisma.produceListing.create({
            data: {
              farmerId: farmerId,
              variety: data.variety as any,
              quantity: data.quantity,
              availableQuantity: data.quantity, // Initially same as quantity
              pricePerKg: pricePerKg,
              qualityGrade: data.qualityGrade as any,
              harvestDate: harvestDate,
              county: county,
              subCounty: subCounty,
              location: location,
              coordinates: center?.coordinates || farmerProfile?.coordinates || undefined,
              photos: stockTransaction.photos || [],
              description: `Automatically created listing from stock in at ${center?.name || 'aggregation center'}. Batch: ${batchId}`,
              batchId: batchId || undefined,
              qrCode: qrCode || undefined,
              status: 'ACTIVE',
            },
          });
        } else {
          // If listing exists, update available quantity if needed
          // (This handles cases where stock in adds more quantity to an existing batch)
          await this.prisma.produceListing.update({
            where: { id: existingListing.id },
            data: {
              availableQuantity: existingListing.availableQuantity + data.quantity,
              quantity: existingListing.quantity + data.quantity,
            },
          });
        }
      } catch (error) {
        console.error('Failed to create listing from stock in:', error);
        // Don't fail the stock transaction if listing creation fails
        // Log the error but continue with the stock transaction
      }
    }

    // Update marketplace order status if stock in is for an order
    if (validOrderId && stockTransaction.order) {
      try {
        await this.marketplaceService.updateOrderStatus(
          validOrderId,
          { status: 'AT_AGGREGATION' },
          userId,
        );
      } catch (error) {
        console.error('Failed to update order status:', error);
      }
    }

    // Create notifications (per lifecycle: manager, buyer, farmer)
    if (validOrderId && stockTransaction.order) {
      const order = stockTransaction.order;
      try {
        // To Aggregation Manager
        await this.notificationHelperService.createNotification({
          userId,
          type: 'ORDER',
          title: 'New Stock Received',
          message: `New stock received for order #${order.orderNumber}`,
          priority: 'MEDIUM',
          entityType: 'ORDER',
          entityId: validOrderId,
          actionUrl: `/orders/${validOrderId}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: order.orderNumber, transactionNumber: stockTransaction.transactionNumber },
        });

        // To Buyer
        if (order.buyerId) {
          await this.notificationHelperService.createNotification({
            userId: order.buyerId,
            type: 'ORDER',
            title: 'Order Arrived at Center',
            message: `Order #${order.orderNumber} has arrived at aggregation center`,
            priority: 'MEDIUM',
            entityType: 'ORDER',
          entityId: validOrderId,
          actionUrl: `/orders/${validOrderId}`,
            actionLabel: 'View Order',
            metadata: { orderNumber: order.orderNumber },
          });
        }

        // To Farmer
        if (farmerId) {
          await this.notificationHelperService.createNotification({
            userId: farmerId,
            type: 'ORDER',
            title: 'Produce Received',
            message: `Your produce for order #${order.orderNumber} has been received at center`,
            priority: 'MEDIUM',
            entityType: 'ORDER',
          entityId: validOrderId,
          actionUrl: `/orders/${validOrderId}`,
            actionLabel: 'View Order',
            metadata: { orderNumber: order.orderNumber },
          });
        }
      } catch (error) {
        console.error('Failed to create notifications:', error);
      }
    }

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: isTransferFromSatellite ? 'STOCK_TRANSFER_RECEIVED' : 'STOCK_IN_CREATED',
      entityType: 'STOCK_TRANSACTION',
      entityId: stockTransaction.id,
      metadata: {
        transactionNumber: stockTransaction.transactionNumber,
        orderId: validOrderId,
        centerId: data.centerId,
        sourceCenterId: data.sourceCenterId,
        inventoryItemId: inventoryItem?.id,
        batchId: data.batchId,
        isTransfer: isTransferFromSatellite,
      },
    });

    // If transfer from satellite to main center, automatically create secondary quality check
    if (isTransferFromSatellite && destinationCenter.centerType === 'MAIN') {
      try {
        // Create a quality check with default values (manager will complete it)
        // Quality score defaults to 70 (passing threshold) but can be updated
        const qualityCheckData: CreateQualityCheckDto = {
          centerId: data.centerId,
          transactionId: stockTransaction.id,
          variety: data.variety,
          quantity: data.quantity,
          qualityGrade: data.qualityGrade,
          qualityScore: 70, // Default passing score, to be updated by quality checker
          batchId: data.batchId,
          farmerId: farmerId || undefined,
          farmerName: farmerName || undefined,
          notes: `Secondary quality check required for stock transferred from ${sourceCenter?.name || 'satellite center'}`,
        };

        await this.createQualityCheck(qualityCheckData, userId);

        // Create notification for aggregation manager about required quality check
        await this.notificationHelperService.createNotification({
          userId,
          type: 'QUALITY_CHECK',
          title: 'Secondary Quality Check Required',
          message: `Stock transferred from ${sourceCenter?.name || 'satellite center'} requires secondary quality check at main center`,
          priority: 'HIGH',
          entityType: 'STOCK_TRANSACTION',
          entityId: stockTransaction.id,
          actionUrl: `/aggregation/quality-checks?transactionId=${stockTransaction.id}`,
          actionLabel: 'Complete Quality Check',
          metadata: {
            transactionNumber: stockTransaction.transactionNumber,
            sourceCenter: sourceCenter?.name,
            destinationCenter: destinationCenter.name,
            batchId: data.batchId,
          },
        });
      } catch (error) {
        console.error('Failed to create secondary quality check for transfer:', error);
        // Don't fail the stock in transaction if quality check creation fails
      }
    }

    // Return stock transaction (inventoryItem is created but not included in response to maintain API compatibility)
    return stockTransaction;
  }

  async createStockOut(data: CreateStockTransactionDto, userId: string) {
    // Check stock availability
    const center = await this.getAggregationCenterById(data.centerId);
    if (center.currentStock < data.quantity) {
      throw new BadRequestException('Insufficient stock in center');
    }

    // Validate orderId exists if provided
    let validOrderId: string | undefined = undefined;
    if (data.orderId) {
      const order = await this.prisma.marketplaceOrder.findUnique({
        where: { id: data.orderId },
        select: { id: true },
      });
      if (order) {
        validOrderId = order.id;
      } else {
        console.warn(`Order ID ${data.orderId} not found, creating stock transaction without order reference`);
      }
    }

    // Generate transaction number
    const transactionNumber = await this.prisma.$queryRaw<Array<{ generate_stock_transaction_number: string }>>`
      SELECT generate_stock_transaction_number() as generate_stock_transaction_number
    `;

    const stockTransaction = await this.prisma.stockTransaction.create({
      data: {
        centerId: data.centerId,
        transactionNumber: transactionNumber[0].generate_stock_transaction_number,
        type: 'STOCK_OUT',
        variety: data.variety,
        quantity: data.quantity,
        qualityGrade: data.qualityGrade as any,
        pricePerKg: data.pricePerKg,
        totalAmount: data.quantity * (data.pricePerKg || 0),
        orderId: validOrderId,
        buyerId: data.buyerId,
        buyerName: data.buyerName,
        batchId: data.batchId,
        notes: data.notes,
        createdBy: userId,
      },
      include: {
        center: true,
        order: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Update inventory item quantity if batchId is provided
    if (data.batchId) {
      try {
        const inventoryItem = await this.prisma.inventoryItem.findUnique({
          where: { batchId: data.batchId },
        });

        if (inventoryItem) {
          const newQuantity = inventoryItem.quantity - data.quantity;
          if (newQuantity <= 0) {
            // Delete inventory item if quantity is depleted
            await this.prisma.inventoryItem.delete({
              where: { id: inventoryItem.id },
            });
          } else {
            // Update inventory item quantity
            await this.prisma.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { quantity: newQuantity },
            });
          }
        }
      } catch (error) {
        console.error('Failed to update inventory item:', error);
      }
    }

    // Update marketplace order status and mark as stock out recorded if stock out is for an order
    if (validOrderId) {
      try {
        // Update order status
        if (stockTransaction.order) {
          await this.marketplaceService.updateOrderStatus(
            validOrderId,
            { status: 'OUT_FOR_DELIVERY' },
            userId,
          );
        }
        
        // Mark order as stock out recorded to prevent duplicate processing
        // This must happen even if order status update fails
        try {
          const updated = await this.prisma.marketplaceOrder.update({
            where: { id: validOrderId },
            data: { stockOutRecorded: true },
            select: { id: true, stockOutRecorded: true, orderNumber: true },
          });
          console.log(`Order ${updated.orderNumber} (${validOrderId}) marked as stock out recorded. Value: ${updated.stockOutRecorded}`);
        } catch (updateError: any) {
          console.error(`Failed to mark order ${validOrderId} as stock out recorded:`, updateError?.message || updateError);
          // Re-throw to ensure we know about this critical failure
          throw new Error(`Failed to mark order as stock out recorded: ${updateError?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Failed to update order status or mark as stock out recorded:', error);
        // Don't fail the whole stock out transaction, but log the error
      }
    }

    // Create notifications (per lifecycle: buyer, transport provider)
    if (validOrderId && stockTransaction.order) {
      try {
        // To Buyer
        if (stockTransaction.order.buyerId) {
          await this.notificationHelperService.createNotification({
            userId: stockTransaction.order.buyerId,
            type: 'ORDER',
            title: 'Order Out for Delivery',
            message: `Order #${stockTransaction.order.orderNumber} is out for delivery`,
            priority: 'MEDIUM',
            entityType: 'ORDER',
          entityId: validOrderId,
          actionUrl: `/orders/${validOrderId}`,
            actionLabel: 'View Order',
            metadata: { orderNumber: stockTransaction.order.orderNumber },
          });
        }

        // Note: Transport provider notification would be created when transport request is created
      } catch (error) {
        console.error('Failed to create notifications:', error);
      }
    }

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'STOCK_OUT_CREATED',
      entityType: 'STOCK_TRANSACTION',
      entityId: stockTransaction.id,
      metadata: {
        transactionNumber: stockTransaction.transactionNumber,
        orderId: validOrderId,
        centerId: data.centerId,
      },
    });

    return stockTransaction;
  }

  // ============ Inventory ============

  async getInventory(centerId?: string) {
    const where = centerId ? { centerId } : {};

    return this.prisma.inventoryItem.findMany({
      where,
      include: {
        center: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { stockInDate: 'desc' },
    });
  }

  // ============ Quality Checks ============

  async getQualityChecks(filters?: {
    centerId?: string;
    orderId?: string;
    transactionId?: string;
  }) {
    const where: any = {};

    if (filters?.centerId) {
      where.centerId = filters.centerId;
    }
    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }
    if (filters?.transactionId) {
      where.transactionId = filters.transactionId;
    }

    return this.prisma.qualityCheck.findMany({
      where,
      include: {
        center: true,
        order: true,
        checker: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { checkedAt: 'desc' },
    });
  }

  async createQualityCheck(data: CreateQualityCheckDto, checkedBy: string) {
    // Determine if approved based on quality score (>= 70 is approved)
    const approved = data.qualityScore >= 70;

    // Get farmer info from order if orderId is provided
    let farmerId = data.farmerId;
    let farmerName = data.farmerName;
    let validOrderId: string | undefined = undefined;

    // Validate orderId exists if provided
    if (data.orderId) {
      const order = await this.prisma.marketplaceOrder.findUnique({
        where: { id: data.orderId },
        select: { id: true, farmerId: true },
      });
      if (order) {
        validOrderId = order.id;
        // Get farmer info from order if farmerId is not provided
        if (!farmerId && order.farmerId) {
          farmerId = order.farmerId;
          // Get farmer name from profile
          const profile = await this.prisma.profile.findUnique({
            where: { userId: farmerId },
            select: { firstName: true, lastName: true },
          });
          if (profile) {
            farmerName = `${profile.firstName} ${profile.lastName}`;
          }
        }
      } else {
        console.warn(`Order ID ${data.orderId} not found, creating quality check without order reference`);
      }
    }

    // Get batchId from transaction if transactionId is provided
    let batchId = data.batchId;
    if (data.transactionId && !batchId) {
      const transaction = await this.prisma.stockTransaction.findUnique({
        where: { id: data.transactionId },
        select: { batchId: true },
      });
      if (transaction?.batchId) {
        batchId = transaction.batchId;
      }
    }

    const qualityCheck = await this.prisma.qualityCheck.create({
      data: {
        centerId: data.centerId,
        orderId: validOrderId,
        transactionId: data.transactionId,
        variety: data.variety,
        quantity: data.quantity,
        weightRange: data.weightRange,
        colorIntensity: data.colorIntensity ? data.colorIntensity : null,
        physicalCondition: data.physicalCondition,
        freshness: data.freshness,
        daysSinceHarvest: data.daysSinceHarvest,
        qualityGrade: data.qualityGrade as any,
        qualityScore: data.qualityScore,
        colorScore: data.colorScore,
        damageScore: data.damageScore,
        sizeScore: data.sizeScore,
        dryMatterContent: data.dryMatterContent,
        approved,
        rejectionReason: approved ? null : 'Quality score below threshold',
        farmerId,
        farmerName,
        batchId,
        checkedBy,
        notes: data.notes,
        photos: data.photos || [],
      },
      include: {
        center: true,
        order: true,
        checker: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Update marketplace order status and quality info
    if (validOrderId && qualityCheck.order) {
      try {
        // First update to QUALITY_CHECKED
        await this.marketplaceService.updateOrderStatus(
          validOrderId,
          { status: 'QUALITY_CHECKED' },
          checkedBy,
        );

        // Then update to QUALITY_APPROVED or QUALITY_REJECTED
        const finalStatus = approved ? 'QUALITY_APPROVED' : 'QUALITY_REJECTED';
        await this.marketplaceService.updateOrderStatus(
          validOrderId,
          { status: finalStatus },
          checkedBy,
        );

        // Update order quality score and feedback
        await this.prisma.marketplaceOrder.update({
          where: { id: validOrderId },
          data: {
            qualityScore: data.qualityScore,
            qualityFeedback: approved ? 'Quality approved' : (qualityCheck.rejectionReason || 'Quality rejected'),
          },
        });
      } catch (error) {
        console.error('Failed to update order status:', error);
      }
    }

    // Create notifications
    if (qualityCheck.order) {
      await this.notificationHelperService.createNotifications([
        {
          userId: qualityCheck.order.buyerId,
          type: 'QUALITY_CHECK',
          title: 'Quality Check Completed',
          message: `Quality check completed for order #${qualityCheck.order.orderNumber}`,
          priority: 'MEDIUM',
          entityType: 'ORDER',
          entityId: qualityCheck.order.id,
          actionUrl: `/orders/${qualityCheck.order.id}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: qualityCheck.order.orderNumber, approved },
        },
        {
          userId: qualityCheck.order.farmerId,
          type: 'QUALITY_CHECK',
          title: 'Quality Check Results Available',
          message: `Quality check results available for order #${qualityCheck.order.orderNumber}`,
          priority: 'MEDIUM',
          entityType: 'ORDER',
          entityId: qualityCheck.order.id,
          actionUrl: `/orders/${qualityCheck.order.id}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: qualityCheck.order.orderNumber, approved },
        },
      ]);
    }

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId: checkedBy,
      action: 'QUALITY_CHECK_CREATED',
      entityType: 'QUALITY_CHECK',
      entityId: qualityCheck.id,
      metadata: {
        orderId: validOrderId,
        approved,
        qualityScore: data.qualityScore,
      },
    });

    return qualityCheck;
  }

  // ============ Wastage ============

  async getWastageEntries(filters?: {
    centerId?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};

    if (filters?.centerId) {
      where.centerId = filters.centerId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.recordedAt = {};
      if (filters.dateFrom) {
        where.recordedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.recordedAt.lte = new Date(filters.dateTo);
      }
    }

    return this.prisma.wastageEntry.findMany({
      where,
      include: {
        center: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async createWastageEntry(data: CreateWastageEntryDto, recordedBy: string) {
    // Get farmer info from inventory item if inventoryItemId is provided
    let farmerId: string | undefined;
    let farmerName: string | undefined;

    if (data.inventoryItemId) {
      const inventoryItem = await this.prisma.inventoryItem.findUnique({
        where: { id: data.inventoryItemId },
        select: { farmerId: true, farmerName: true },
      });
      if (inventoryItem?.farmerId) {
        farmerId = inventoryItem.farmerId;
        farmerName = inventoryItem.farmerName || undefined;
      }
    }

    // Get batchId from inventory item if not provided
    let batchId = data.batchId;
    if (data.inventoryItemId && !batchId) {
      const inventoryItem = await this.prisma.inventoryItem.findUnique({
        where: { id: data.inventoryItemId },
        select: { batchId: true },
      });
      if (inventoryItem?.batchId) {
        batchId = inventoryItem.batchId;
      }
    }

    // Get recorder name
    const recorderProfile = await this.prisma.profile.findUnique({
      where: { userId: recordedBy },
      select: { firstName: true, lastName: true },
    });
    const recordedByName = recorderProfile
      ? `${recorderProfile.firstName} ${recorderProfile.lastName}`
      : undefined;

    return this.prisma.wastageEntry.create({
      data: {
        centerId: data.centerId,
        variety: data.variety,
        quantity: data.quantity,
        qualityGrade: data.qualityGrade as any,
        category: data.category as any,
        reason: data.reason,
        notes: data.notes,
        batchId,
        inventoryItemId: data.inventoryItemId,
        farmerId,
        farmerName,
        recordedByName,
        recordedBy,
      },
      include: {
        center: true,
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  // ============ Statistics ============

  async getAggregationStats() {
    const [totalCenters, centersByType, centersByStatus, totalStock, totalCapacity] =
      await Promise.all([
        this.prisma.aggregationCenter.count(),
        this.prisma.aggregationCenter.groupBy({
          by: ['centerType'],
          _count: true,
        }),
        this.prisma.aggregationCenter.groupBy({
          by: ['status'],
          _count: true,
        }),
        this.prisma.aggregationCenter.aggregate({
          _sum: {
            currentStock: true,
          },
        }),
        this.prisma.aggregationCenter.aggregate({
          _sum: {
            totalCapacity: true,
          },
        }),
      ]);

    const totalCap = totalCapacity._sum.totalCapacity || 0;
    const totalStk = totalStock._sum.currentStock || 0;
    const utilizationRate = totalCap > 0 ? (totalStk / totalCap) * 100 : 0;

    return {
      totalCenters,
      mainCenters: centersByType.find((c) => c.centerType === 'MAIN')?._count || 0,
      satelliteCenters:
        centersByType.find((c) => c.centerType === 'SATELLITE')?._count || 0,
      operationalCenters:
        centersByStatus.find((c) => c.status === 'OPERATIONAL')?._count || 0,
      totalStock: totalStock._sum.currentStock || 0,
      totalCapacity: totalCapacity._sum.totalCapacity || 0,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
    };
  }
}
