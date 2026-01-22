import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

    if (data.orderId && !farmerId) {
      const order = await this.prisma.marketplaceOrder.findUnique({
        where: { id: data.orderId },
        select: { farmerId: true },
      });
      if (order?.farmerId) {
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

    // Determine transaction type: TRANSFER if from satellite, STOCK_IN otherwise
    const transactionType = isTransferFromSatellite ? 'TRANSFER' : 'STOCK_IN';

    const stockTransaction = await this.prisma.stockTransaction.create({
      data: {
        centerId: data.centerId,
        transactionNumber: transactionNumber[0].generate_stock_transaction_number,
        type: transactionType,
        variety: data.variety,
        quantity: data.quantity,
        qualityGrade: data.qualityGrade as any,
        pricePerKg: data.pricePerKg,
        totalAmount: data.quantity * (data.pricePerKg || 0),
        orderId: data.orderId,
        farmerId,
        farmerName,
        batchId: data.batchId,
        qrCode: data.qrCode,
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
    let inventoryItem: { id: string } | null = null;
    if (data.batchId) {
      try {
        // Check if inventory item already exists for this batch
        const existingInventory = await this.prisma.inventoryItem.findUnique({
          where: { batchId: data.batchId },
        });

        if (!existingInventory) {
          const created = await this.prisma.inventoryItem.create({
            data: {
              centerId: data.centerId,
              variety: data.variety,
              quantity: data.quantity,
              qualityGrade: data.qualityGrade as any,
              batchId: data.batchId,
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

    // Update marketplace order status if stock in is for an order
    if (data.orderId && stockTransaction.order) {
      try {
        await this.marketplaceService.updateOrderStatus(
          data.orderId,
          { status: 'AT_AGGREGATION' },
          userId,
        );
      } catch (error) {
        console.error('Failed to update order status:', error);
      }
    }

    // Create notifications (per lifecycle: manager, buyer, farmer)
    if (data.orderId && stockTransaction.order) {
      try {
        // To Aggregation Manager
        await this.notificationHelperService.createNotification({
          userId,
          type: 'ORDER',
          title: 'New Stock Received',
          message: `New stock received for order #${stockTransaction.order.orderNumber}`,
          priority: 'MEDIUM',
          entityType: 'ORDER',
          entityId: data.orderId,
          actionUrl: `/orders/${data.orderId}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: stockTransaction.order.orderNumber, transactionNumber: stockTransaction.transactionNumber },
        });

        // To Buyer
        if (stockTransaction.order.buyerId) {
          await this.notificationHelperService.createNotification({
            userId: stockTransaction.order.buyerId,
            type: 'ORDER',
            title: 'Order Arrived at Center',
            message: `Order #${stockTransaction.order.orderNumber} has arrived at aggregation center`,
            priority: 'MEDIUM',
            entityType: 'ORDER',
            entityId: data.orderId,
            actionUrl: `/orders/${data.orderId}`,
            actionLabel: 'View Order',
            metadata: { orderNumber: stockTransaction.order.orderNumber },
          });
        }

        // To Farmer
        if (farmerId) {
          await this.notificationHelperService.createNotification({
            userId: farmerId,
            type: 'ORDER',
            title: 'Produce Received',
            message: `Your produce for order #${stockTransaction.order.orderNumber} has been received at center`,
            priority: 'MEDIUM',
            entityType: 'ORDER',
            entityId: data.orderId,
            actionUrl: `/orders/${data.orderId}`,
            actionLabel: 'View Order',
            metadata: { orderNumber: stockTransaction.order.orderNumber },
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
        orderId: data.orderId,
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
        orderId: data.orderId,
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

    // Update marketplace order status if stock out is for an order
    if (data.orderId && stockTransaction.order) {
      try {
        await this.marketplaceService.updateOrderStatus(
          data.orderId,
          { status: 'OUT_FOR_DELIVERY' },
          userId,
        );
      } catch (error) {
        console.error('Failed to update order status:', error);
      }
    }

    // Create notifications (per lifecycle: buyer, transport provider)
    if (data.orderId && stockTransaction.order) {
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
            entityId: data.orderId,
            actionUrl: `/orders/${data.orderId}`,
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
        orderId: data.orderId,
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

    if (data.orderId && !farmerId) {
      const order = await this.prisma.marketplaceOrder.findUnique({
        where: { id: data.orderId },
        select: { farmerId: true },
      });
      if (order?.farmerId) {
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
        orderId: data.orderId,
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
    if (data.orderId && qualityCheck.order) {
      try {
        // First update to QUALITY_CHECKED
        await this.marketplaceService.updateOrderStatus(
          data.orderId,
          { status: 'QUALITY_CHECKED' },
          checkedBy,
        );

        // Then update to QUALITY_APPROVED or QUALITY_REJECTED
        const finalStatus = approved ? 'QUALITY_APPROVED' : 'QUALITY_REJECTED';
        await this.marketplaceService.updateOrderStatus(
          data.orderId,
          { status: finalStatus },
          checkedBy,
        );

        // Update order quality score and feedback
        await this.prisma.marketplaceOrder.update({
          where: { id: data.orderId },
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
        orderId: data.orderId,
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
