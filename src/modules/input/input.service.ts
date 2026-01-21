import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import {
  CreateInputDto,
  UpdateInputDto,
  CreateInputOrderDto,
  UpdateInputOrderStatusDto,
} from './dto';

@Injectable()
export class InputService {
  constructor(
    private prisma: PrismaService,
    private notificationHelperService: NotificationHelperService,
    private activityLogService: ActivityLogService,
  ) {}

  // ============ Input Products ============

  async getInputs(filters?: {
    providerId?: string;
    category?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.providerId) {
      where.providerId = filters.providerId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.minPrice || filters?.maxPrice) {
      where.price = {};
      if (filters.minPrice) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice) {
        where.price.lte = filters.maxPrice;
      }
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.input.findMany({
      where,
      include: {
        provider: {
          include: {
            profile: true,
          },
        },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInputById(id: string) {
    const input = await this.prisma.input.findUnique({
      where: { id },
      include: {
        provider: {
          include: {
            profile: true,
          },
        },
        orders: {
          include: {
            farmer: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!input) {
      throw new NotFoundException(`Input with ID ${id} not found`);
    }

    return input;
  }

  async createInput(data: CreateInputDto, providerId: string) {
    return this.prisma.input.create({
      data: {
        ...data,
        providerId,
        category: data.category as any,
        status: data.status as any || 'ACTIVE',
      },
      include: {
        provider: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async updateInput(id: string, data: UpdateInputDto, providerId: string) {
    const input = await this.getInputById(id);

    if (input.providerId !== providerId) {
      throw new BadRequestException('You can only update your own inputs');
    }

    return this.prisma.input.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.category && { category: data.category as any }),
        ...(data.description && { description: data.description }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.unit && { unit: data.unit }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.minimumStock !== undefined && { minimumStock: data.minimumStock }),
        ...(data.images && { images: data.images }),
        ...(data.location && { location: data.location }),
        ...(data.status && { status: data.status as any }),
      },
      include: {
        provider: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async deleteInput(id: string, providerId: string) {
    const input = await this.getInputById(id);

    if (input.providerId !== providerId) {
      throw new BadRequestException('You can only delete your own inputs');
    }

    return this.prisma.input.delete({
      where: { id },
    });
  }

  // ============ Input Orders ============

  async getInputOrders(filters?: {
    farmerId?: string;
    providerId?: string;
    inputId?: string;
    status?: string;
    paymentStatus?: string;
  }) {
    const where: any = {};

    if (filters?.farmerId) {
      where.farmerId = filters.farmerId;
    }
    if (filters?.inputId) {
      where.inputId = filters.inputId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }
    if (filters?.providerId) {
      where.input = {
        providerId: filters.providerId,
      };
    }

    return this.prisma.inputOrder.findMany({
      where,
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
        input: {
          include: {
            provider: {
              include: {
                profile: true,
              },
            },
          },
        },
        transportRequest: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInputOrderById(id: string) {
    const order = await this.prisma.inputOrder.findUnique({
      where: { id },
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
        input: {
          include: {
            provider: {
              include: {
                profile: true,
              },
            },
          },
        },
        transportRequest: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Input Order with ID ${id} not found`);
    }

    return order;
  }

  async createInputOrder(data: CreateInputOrderDto, farmerId: string) {
    // Get input to calculate totals
    const input = await this.getInputById(data.inputId);

    // Check stock availability
    if (input.stock < data.quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    // Generate order number
    const orderNumber = await this.prisma.$queryRaw<Array<{ generate_input_order_number: string }>>`
      SELECT generate_input_order_number() as generate_input_order_number
    `;

    const subtotal = data.quantity * input.price;
    const transportFee = data.requiresTransport ? (data.transportFee || 0) : 0;
    const totalAmount = subtotal + transportFee;

    const inputOrder = await this.prisma.inputOrder.create({
      data: {
        farmerId,
        inputId: data.inputId,
        orderNumber: orderNumber[0].generate_input_order_number,
        quantity: data.quantity,
        unit: input.unit,
        pricePerUnit: input.price,
        subtotal,
        transportFee,
        totalAmount,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes,
        requiresTransport: data.requiresTransport || false,
      },
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
        input: {
          include: {
            provider: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    // Create notifications
    await this.notificationHelperService.createNotifications([
      {
        userId: input.providerId,
        type: 'ORDER',
        title: 'New Input Order Received',
        message: `New input order #${inputOrder.orderNumber} from ${inputOrder.farmer.profile?.firstName || 'Farmer'}`,
        priority: 'HIGH',
        entityType: 'INPUT_ORDER',
        entityId: inputOrder.id,
        actionUrl: `/inputs/orders/${inputOrder.id}`,
        actionLabel: 'View Order',
        metadata: { orderNumber: inputOrder.orderNumber },
      },
      {
        userId: farmerId,
        type: 'ORDER',
        title: 'Input Order Placed Successfully',
        message: `Input order #${inputOrder.orderNumber} placed successfully`,
        priority: 'MEDIUM',
        entityType: 'INPUT_ORDER',
        entityId: inputOrder.id,
        actionUrl: `/inputs/orders/${inputOrder.id}`,
        actionLabel: 'View Order',
        metadata: { orderNumber: inputOrder.orderNumber },
      },
    ]);

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId: farmerId,
      action: 'INPUT_ORDER_CREATED',
      entityType: 'INPUT_ORDER',
      entityId: inputOrder.id,
      metadata: {
        orderNumber: inputOrder.orderNumber,
        inputId: data.inputId,
        quantity: data.quantity,
      },
    });

    return inputOrder;
  }

  async updateInputOrderStatus(
    id: string,
    data: UpdateInputOrderStatusDto,
    userId: string,
  ) {
    const order = await this.getInputOrderById(id);

    // Verify user has permission (farmer or provider)
    const input = await this.getInputById(order.inputId);
    if (order.farmerId !== userId && input.providerId !== userId) {
      throw new BadRequestException('You can only update your own orders');
    }

    // If status is ACCEPTED, reduce stock
    if (data.status === 'ACCEPTED' && order.status !== 'ACCEPTED') {
      await this.prisma.input.update({
        where: { id: order.inputId },
        data: {
          stock: {
            decrement: order.quantity,
          },
        },
      });
    }

    const oldStatus = order.status;
    const updatedOrder = await this.prisma.inputOrder.update({
      where: { id },
      data: {
        status: data.status as any,
        ...(data.paymentStatus && { paymentStatus: data.paymentStatus as any }),
      },
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
        input: {
          include: {
            provider: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    // Create notifications
    const statusMessages: Record<string, { title: string; message: string }> = {
      ACCEPTED: {
        title: 'Input Order Accepted',
        message: `Input provider has accepted order #${updatedOrder.orderNumber}`,
      },
      PROCESSING: {
        title: 'Order Being Processed',
        message: `Order #${updatedOrder.orderNumber} is being processed`,
      },
      READY_FOR_PICKUP: {
        title: 'Order Ready for Pickup',
        message: `Order #${updatedOrder.orderNumber} is ready for pickup`,
      },
      IN_TRANSIT: {
        title: 'Order In Transit',
        message: `Order #${updatedOrder.orderNumber} is in transit`,
      },
      DELIVERED: {
        title: 'Order Delivered',
        message: `Order #${updatedOrder.orderNumber} has been delivered`,
      },
      COMPLETED: {
        title: 'Order Completed',
        message: `Order #${updatedOrder.orderNumber} completed`,
      },
    };

    const statusInfo = statusMessages[data.status];
    if (statusInfo) {
      await this.notificationHelperService.createNotifications([
        {
          userId: updatedOrder.farmerId,
          type: 'ORDER',
          title: statusInfo.title,
          message: statusInfo.message,
          priority: ['DELIVERED', 'COMPLETED'].includes(data.status) ? 'HIGH' : 'MEDIUM',
          entityType: 'INPUT_ORDER',
          entityId: updatedOrder.id,
          actionUrl: `/inputs/orders/${updatedOrder.id}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: updatedOrder.orderNumber, status: data.status },
        },
      ]);
    }

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId,
      action: 'INPUT_ORDER_STATUS_CHANGED',
      entityType: 'INPUT_ORDER',
      entityId: updatedOrder.id,
      metadata: {
        orderNumber: updatedOrder.orderNumber,
        oldStatus,
        newStatus: data.status,
      },
    });

    return updatedOrder;
  }

  // ============ Input Customers ============

  async getInputCustomers(filters?: {
    providerId?: string;
    search?: string;
    minOrders?: number;
    minSpent?: number;
  }) {
    const where: any = {};

    if (filters?.providerId) {
      where.orders = {
        some: {
          input: {
            providerId: filters.providerId,
          },
        },
      };
    }
    if (filters?.search) {
      where.OR = [
        { profile: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const customers = await this.prisma.user.findMany({
      where: {
        ...where,
        role: 'FARMER',
      },
      include: {
        profile: true,
        inputOrders: {
          where: filters?.providerId
            ? {
                input: { providerId: filters.providerId },
              }
            : {},
          include: {
            input: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Calculate customer stats
    return customers.map((customer) => {
      const orders = customer.inputOrders;
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      // Get favorite category
      const categoryCounts: Record<string, number> = {};
      orders.forEach((order) => {
        const category = order.input.category;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      const favoriteCategory = Object.keys(categoryCounts).reduce((a, b) =>
        categoryCounts[a] > categoryCounts[b] ? a : b,
      );

      return {
        id: customer.id,
        farmerName: `${customer.profile?.firstName || ''} ${customer.profile?.lastName || ''}`.trim(),
        farmerPhone: customer.phone,
        farmerEmail: customer.email,
        location: customer.profile?.county || '',
        totalOrders,
        totalSpent,
        averageOrderValue,
        lastOrderDate: orders[0]?.createdAt || null,
        firstOrderDate: orders[orders.length - 1]?.createdAt || null,
        favoriteCategory: favoriteCategory || null,
        orderHistory: orders.slice(0, 10).map((order) => ({
          orderNumber: order.orderNumber,
          inputName: order.input.name,
          quantity: order.quantity,
          amount: order.totalAmount,
          date: order.createdAt,
          status: order.status,
        })),
      };
    });
  }

  async getInputCustomerById(customerId: string, providerId?: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      include: {
        profile: true,
        inputOrders: {
          where: providerId
            ? {
                input: { providerId },
              }
            : {},
          include: {
            input: {
              include: {
                provider: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            payment: true,
            transportRequest: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer || customer.role !== 'FARMER') {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return customer;
  }

  async getCustomerOrderHistory(customerId: string, providerId?: string) {
    const customer = await this.getInputCustomerById(customerId, providerId);
    return customer.inputOrders;
  }

  async getCustomerStats(providerId?: string) {
    const where = providerId
      ? {
          input: { providerId },
        }
      : {};

    const orders = await this.prisma.inputOrder.findMany({
      where,
      include: {
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    const uniqueCustomers = new Set(orders.map((o) => o.farmerId));
    const totalCustomers = uniqueCustomers.size;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Top customers by revenue
    const customerRevenue: Record<string, number> = {};
    orders.forEach((order) => {
      customerRevenue[order.farmerId] =
        (customerRevenue[order.farmerId] || 0) + order.totalAmount;
    });

    const topCustomers = Object.entries(customerRevenue)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([farmerId, revenue]) => {
        const customerOrders = orders.filter((o) => o.farmerId === farmerId);
        const customer = customerOrders[0].farmer;
        return {
          farmerId,
          farmerName: `${customer.profile?.firstName || ''} ${customer.profile?.lastName || ''}`.trim(),
          totalSpent: revenue,
          totalOrders: customerOrders.length,
        };
      });

    return {
      totalCustomers,
      totalOrders,
      totalRevenue,
      averageOrderValue,
      topCustomers,
    };
  }

  // ============ Statistics ============

  async getInputStats(providerId?: string) {
    const where = providerId ? { providerId } : {};

    const [totalInputs, totalOrders, inputsByCategory, ordersByStatus] =
      await Promise.all([
        this.prisma.input.count({ where }),
        this.prisma.inputOrder.count({
          where: providerId
            ? {
                input: { providerId },
              }
            : {},
        }),
        this.prisma.input.groupBy({
          by: ['category'],
          where,
          _count: true,
        }),
        this.prisma.inputOrder.groupBy({
          by: ['status'],
          where: providerId
            ? {
                input: { providerId },
              }
            : {},
          _count: true,
        }),
      ]);

    return {
      totalInputs,
      totalOrders,
      inputsByCategory: inputsByCategory.map((item) => ({
        category: item.category,
        count: item._count,
      })),
      ordersByStatus: ordersByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
    };
  }
}
