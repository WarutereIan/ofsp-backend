import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  searchQuery?: string;
}

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async getActivityLogs(filters?: ActivityLogFilters) {
    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    // Handle action filter - skip if "all"
    if (filters?.action && filters.action !== 'all') {
      where.action = filters.action;
    }

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    // Handle date range - support both dateRange object and startDate/endDate
    const startDate = (filters as any)?.dateRange?.start || filters?.startDate;
    const endDate = (filters as any)?.dateRange?.end || filters?.endDate;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Handle search query - search in action, entityType, or metadata
    if (filters?.searchQuery) {
      where.OR = [
        { action: { contains: filters.searchQuery, mode: 'insensitive' } },
        { entityType: { contains: filters.searchQuery, mode: 'insensitive' } },
      ];
    }

    // Get total count (without limit)
    const totalCount = await this.prisma.activityLog.count({ where });

    // Get filtered logs
    const logs = await this.prisma.activityLog.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters?.limit || 100,
    });

    // Transform to match frontend ActivityLog interface
    const transformedLogs = logs.map((log) => {
      const userName = log.user.profile
        ? `${log.user.profile.firstName || ''} ${log.user.profile.lastName || ''}`.trim() || log.user.email
        : log.user.email;

      return {
        id: log.id,
        userId: log.userId,
        userName,
        userRole: log.user.role,
        action: log.action,
        entityType: log.entityType || '',
        entityId: log.entityId || '',
        entityName: log.metadata && typeof log.metadata === 'object' && 'name' in log.metadata
          ? String(log.metadata.name)
          : undefined,
        description: this.generateDescription(log),
        metadata: log.metadata as Record<string, unknown> | undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        createdAt: log.createdAt.toISOString(),
      };
    });

    return {
      data: transformedLogs,
      total: totalCount,
      count: transformedLogs.length,
    };
  }

  private generateDescription(log: any): string {
    const action = log.action;
    const entityType = log.entityType || 'item';
    const metadata = log.metadata || {};

    // Generate human-readable description based on action and metadata
    switch (action) {
      case 'ORDER_CREATED':
        return `Order ${metadata.orderNumber || log.entityId} was created`;
      case 'ORDER_STATUS_CHANGED':
        return `Order ${metadata.orderNumber || log.entityId} status changed from ${metadata.oldStatus || 'unknown'} to ${metadata.newStatus || 'unknown'}`;
      case 'PAYMENT_CREATED':
        return `Payment ${metadata.referenceNumber || log.entityId} was created`;
      case 'TRANSPORT_CREATED':
        return `Transport request ${metadata.requestNumber || log.entityId} was created`;
      case 'STOCK_IN':
        return `Stock in transaction recorded for ${entityType}`;
      case 'STOCK_OUT':
        return `Stock out transaction recorded for ${entityType}`;
      case 'STOCK_TRANSFER_RECEIVED':
        return `Stock transfer received for ${entityType}`;
      case 'QUALITY_CHECK_CREATED':
        return `Quality check created for ${entityType}`;
      default:
        return `${action.replace(/_/g, ' ').toLowerCase()} performed on ${entityType}`;
    }
  }
}
