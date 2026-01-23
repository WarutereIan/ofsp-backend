import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsCacheService, ANALYTICS_CACHE_TTL } from './analytics-cache.service';
import { AnalyticsFiltersDto, TimeRange, TimePeriod, EntityType } from './dto';
import { LeaderboardFiltersDto, LeaderboardMetric, LeaderboardPeriod } from './dto/leaderboard-filters.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: AnalyticsCacheService,
  ) {}

  // ============ Helper Methods ============

  /**
   * Calculate date range from TimeRange enum
   */
  private getDateRange(timeRange?: TimeRange, customRange?: { start?: string; end?: string }): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    if (customRange?.start && customRange?.end) {
      return {
        start: new Date(customRange.start),
        end: new Date(customRange.end),
      };
    }

    switch (timeRange) {
      case TimeRange.DAY:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case TimeRange.WEEK:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case TimeRange.MONTH:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case TimeRange.QUARTER:
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case TimeRange.YEAR:
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case TimeRange.ALL:
      default:
        // Default to last 30 days if no range specified
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
    }

    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Get granularity for time series aggregation
   */
  private getGranularity(timeRange?: TimeRange, period?: TimePeriod): 'day' | 'week' | 'month' {
    if (period) {
      switch (period) {
        case TimePeriod.DAILY:
          return 'day';
        case TimePeriod.WEEKLY:
          return 'week';
        case TimePeriod.MONTHLY:
          return 'month';
        default:
          return 'day';
      }
    }

    // Auto-select based on timeRange
    switch (timeRange) {
      case TimeRange.DAY:
        return 'day';
      case TimeRange.WEEK:
        return 'day';
      case TimeRange.MONTH:
        return 'day';
      case TimeRange.QUARTER:
        return 'week';
      case TimeRange.YEAR:
        return 'month';
      default:
        return 'day';
    }
  }

  /**
   * Build where clause for entity filtering
   */
  private buildEntityWhere(filters: AnalyticsFiltersDto, user: any): any {
    const where: any = {};

    // Role-based filtering
    if (user?.role === 'FARMER') {
      where.farmerId = user.id;
    } else if (user?.role === 'BUYER') {
      where.buyerId = user.id;
    }

    // Entity type filtering
    if (filters.entityType) {
      switch (filters.entityType) {
        case EntityType.FARMER:
          where.farmerId = filters.entityId || where.farmerId;
          break;
        case EntityType.BUYER:
          where.buyerId = filters.entityId || where.buyerId;
          break;
      }
    } else if (filters.entityId) {
      // If entityId provided but no type, try to infer
      where.OR = [
        { farmerId: filters.entityId },
        { buyerId: filters.entityId },
      ];
    }

    return where;
  }

  // ============ Dashboard Statistics ============

  async getDashboardStats(filters: AnalyticsFiltersDto, user: any) {
    // Generate cache key based on filters and user role
    const cacheKey = this.cacheService.generateKey(
      'dashboard',
      filters.timeRange,
      filters.dateRange,
      user?.role,
      filters.entityType,
      filters.entityId,
    );

    // Try to get from cache
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for dashboard stats: ${cacheKey}`);
      return cached;
    }

    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const orderWhere = this.buildEntityWhere(filters, user);

    // Get previous period for growth calculation
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(start);

    // OPTIMIZATION: Execute all independent queries in parallel using Promise.all
    const [
      currentRevenue,
      previousRevenue,
      currentOrders,
      previousOrders,
      totalUsers,
      previousUsers,
      totalFarmers,
      totalBuyers,
      totalStock,
      totalQuantity,
    ] = await Promise.all([
      // Total Revenue (current period)
      this.prisma.marketplaceOrder.aggregate({
        where: {
          ...orderWhere,
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),
      // Total Revenue (previous period)
      this.prisma.marketplaceOrder.aggregate({
        where: {
          ...orderWhere,
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: previousStart, lt: previousEnd },
        },
        _sum: { totalAmount: true },
      }),
      // Total Orders (current period)
      this.prisma.marketplaceOrder.count({
        where: {
          ...orderWhere,
          createdAt: { gte: start, lte: end },
        },
      }),
      // Total Orders (previous period)
      this.prisma.marketplaceOrder.count({
        where: {
          ...orderWhere,
          createdAt: { gte: previousStart, lt: previousEnd },
        },
      }),
      // Total Users
      this.prisma.profile.count({
        where: {
          createdAt: { lte: end },
        },
      }),
      // Previous Users
      this.prisma.profile.count({
        where: {
          createdAt: { lte: previousEnd },
        },
      }),
      // Total Farmers
      this.prisma.profile.count({
        where: {
          user: { role: 'FARMER' },
          createdAt: { lte: end },
        },
      }),
      // Total Buyers
      this.prisma.profile.count({
        where: {
          user: { role: 'BUYER' },
          createdAt: { lte: end },
        },
      }),
      // Total Stock (from inventory)
      this.prisma.inventoryItem.aggregate({
        where: {
          status: 'FRESH',
        },
        _sum: { quantity: true },
      }),
      // Total Quantity for average price calculation
      this.prisma.marketplaceOrder.aggregate({
        where: {
          ...orderWhere,
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: start, lte: end },
        },
        _sum: { quantity: true },
      }),
    ]);

    // Average Order Value
    const avgOrderValue = currentOrders > 0
      ? (currentRevenue._sum.totalAmount || 0) / currentOrders
      : 0;

    // Growth Rates
    const revenueGrowthRate = previousRevenue._sum.totalAmount && previousRevenue._sum.totalAmount > 0
      ? ((currentRevenue._sum.totalAmount || 0) - previousRevenue._sum.totalAmount) / previousRevenue._sum.totalAmount * 100
      : 0;

    const orderGrowthRate = previousOrders > 0
      ? ((currentOrders - previousOrders) / previousOrders) * 100
      : 0;

    const userGrowthRate = previousUsers > 0
      ? ((totalUsers - previousUsers) / previousUsers) * 100
      : 0;

    const averagePrice = totalQuantity._sum.quantity && totalQuantity._sum.quantity > 0
      ? (currentRevenue._sum.totalAmount || 0) / totalQuantity._sum.quantity
      : 0;

    // Determine period
    let period: TimePeriod = TimePeriod.CUSTOM;
    if (filters.timeRange) {
      switch (filters.timeRange) {
        case TimeRange.DAY:
          period = TimePeriod.DAILY;
          break;
        case TimeRange.WEEK:
          period = TimePeriod.WEEKLY;
          break;
        case TimeRange.MONTH:
          period = TimePeriod.MONTHLY;
          break;
        case TimeRange.QUARTER:
          period = TimePeriod.QUARTERLY;
          break;
        case TimeRange.YEAR:
          period = TimePeriod.YEARLY;
          break;
      }
    }

    const result = {
      totalRevenue: currentRevenue._sum.totalAmount || 0,
      totalOrders: currentOrders,
      totalFarmers,
      totalBuyers,
      totalUsers,
      totalStock: totalStock._sum?.quantity || 0,
      averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      growthRate: revenueGrowthRate,
      userGrowthRate: Math.round(userGrowthRate * 100) / 100,
      orderGrowthRate: Math.round(orderGrowthRate * 100) / 100,
      revenueGrowthRate: Math.round(revenueGrowthRate * 100) / 100,
      averagePrice: Math.round(averagePrice * 100) / 100,
      period,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };

    // Cache the result
    this.cacheService.set(cacheKey, result, ANALYTICS_CACHE_TTL.DASHBOARD);
    
    return result;
  }

  // ============ Trends ============

  async getTrends(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const granularity = this.getGranularity(filters.timeRange, filters.period);
    const orderWhere = this.buildEntityWhere(filters, user);

    // Get all orders in the date range
    const orders = await this.prisma.marketplaceOrder.findMany({
      where: {
        ...orderWhere,
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        totalAmount: true,
        quantity: true,
        status: true,
        createdAt: true,
        farmerId: true,
        buyerId: true,
      },
    });

    // Group by date based on granularity
    const trendsMap = new Map<string, {
      date: string;
      revenue: number;
      orders: number;
      volume: number;
      farmers: Set<string>;
      buyers: Set<string>;
    }>();

    orders.forEach(order => {
      let dateKey: string;
      const orderDate = new Date(order.createdAt);

      switch (granularity) {
        case 'day':
          dateKey = orderDate.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(orderDate);
          weekStart.setDate(orderDate.getDate() - orderDate.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-01`;
          break;
        default:
          dateKey = orderDate.toISOString().split('T')[0];
      }

      if (!trendsMap.has(dateKey)) {
        trendsMap.set(dateKey, {
          date: dateKey,
          revenue: 0,
          orders: 0,
          volume: 0,
          farmers: new Set(),
          buyers: new Set(),
        });
      }

      const trend = trendsMap.get(dateKey)!;
      if (order.status === 'COMPLETED' || order.status === 'DELIVERED') {
        trend.revenue += order.totalAmount || 0;
        trend.volume += order.quantity || 0;
      }
      trend.orders += 1;
      if (order.farmerId) trend.farmers.add(order.farmerId);
      if (order.buyerId) trend.buyers.add(order.buyerId);
    });

    // Get user counts for each date
    const allDates = Array.from(trendsMap.keys()).sort();
    const userCounts = await Promise.all(
      allDates.map(async (date) => {
        const dateEnd = new Date(date);
        if (granularity === 'day') {
          dateEnd.setDate(dateEnd.getDate() + 1);
        } else if (granularity === 'week') {
          dateEnd.setDate(dateEnd.getDate() + 7);
        } else if (granularity === 'month') {
          dateEnd.setMonth(dateEnd.getMonth() + 1);
        }

        const farmers = await this.prisma.profile.count({
          where: {
            user: { role: 'FARMER' },
            createdAt: { lte: dateEnd },
          },
        });

        const buyers = await this.prisma.profile.count({
          where: {
            user: { role: 'BUYER' },
            createdAt: { lte: dateEnd },
          },
        });

        return { date, farmers, buyers, totalUsers: farmers + buyers };
      })
    );

    // Combine data
    const trends = allDates.map(date => {
      const trend = trendsMap.get(date)!;
      const userCount = userCounts.find(uc => uc.date === date);

      return {
        date,
        revenue: trend.revenue,
        orders: trend.orders,
        volume: trend.volume,
        farmers: userCount?.farmers || trend.farmers.size,
        buyers: userCount?.buyers || trend.buyers.size,
        users: userCount?.totalUsers || (trend.farmers.size + trend.buyers.size),
      };
    });

    return trends;
  }

  // ============ Performance Metrics ============

  async getPerformanceMetrics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const orderWhere = this.buildEntityWhere(filters, user);

    // Get baseline (previous period)
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const baselineStart = new Date(start);
    baselineStart.setDate(baselineStart.getDate() - periodDays);
    const baselineEnd = new Date(start);

    // Revenue metrics
    const currentRevenue = await this.prisma.marketplaceOrder.aggregate({
      where: {
        ...orderWhere,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });

    const baselineRevenue = await this.prisma.marketplaceOrder.aggregate({
      where: {
        ...orderWhere,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: baselineStart, lt: baselineEnd },
      },
      _sum: { totalAmount: true },
    });

    // Quality metrics
    const qualityChecks = await this.prisma.qualityCheck.findMany({
      where: {
        checkedAt: { gte: start, lte: end },
      },
      select: { qualityScore: true },
    });

    const avgQualityScore = qualityChecks.length > 0
      ? qualityChecks.reduce((sum, qc) => sum + (qc.qualityScore || 0), 0) / qualityChecks.length
      : 0;

    // Volume metrics
    const currentVolume = await this.prisma.marketplaceOrder.aggregate({
      where: {
        ...orderWhere,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    });

    // User count
    const currentUsers = await this.prisma.profile.count({
      where: {
        createdAt: { lte: end },
      },
    });

    const baselineUsers = await this.prisma.profile.count({
      where: {
        createdAt: { lte: baselineEnd },
      },
    });

    // Income increase (simplified - would need historical farmer income data)
    const incomeIncrease = baselineRevenue._sum.totalAmount && baselineRevenue._sum.totalAmount > 0
      ? ((currentRevenue._sum.totalAmount || 0) - baselineRevenue._sum.totalAmount) / baselineRevenue._sum.totalAmount * 100
      : 0;

    let period: TimePeriod = TimePeriod.CUSTOM;
    if (filters.timeRange) {
      switch (filters.timeRange) {
        case TimeRange.DAY:
          period = TimePeriod.DAILY;
          break;
        case TimeRange.WEEK:
          period = TimePeriod.WEEKLY;
          break;
        case TimeRange.MONTH:
          period = TimePeriod.MONTHLY;
          break;
        case TimeRange.QUARTER:
          period = TimePeriod.QUARTERLY;
          break;
        case TimeRange.YEAR:
          period = TimePeriod.YEARLY;
          break;
      }
    }

    return [
      {
        id: 'revenue',
        name: 'Total Revenue',
        metric: 'revenue',
        value: currentRevenue._sum.totalAmount || 0,
        baseline: baselineRevenue._sum.totalAmount || 0,
        unit: 'KES',
        trend: (currentRevenue._sum.totalAmount || 0) >= (baselineRevenue._sum.totalAmount || 0) ? 'up' : 'down',
        trendPercentage: incomeIncrease,
        period,
      },
      {
        id: 'quality_score',
        name: 'Quality Score',
        metric: 'quality_score',
        value: Math.round(avgQualityScore * 20), // Convert to percentage
        baseline: 75, // Default baseline
        unit: '%',
        trend: avgQualityScore >= 4 ? 'up' : 'stable',
        period,
      },
      {
        id: 'volume',
        name: 'Volume',
        metric: 'volume',
        value: currentVolume._sum.quantity || 0,
        unit: 'kg',
        period,
      },
      {
        id: 'income_increase',
        name: 'Income Increase',
        metric: 'income_increase',
        value: Math.round(incomeIncrease * 100) / 100,
        baseline: 0,
        target: 50,
        unit: '%',
        trend: incomeIncrease > 0 ? 'up' : 'down',
        trendPercentage: incomeIncrease,
        period,
      },
      {
        id: 'users',
        name: 'Total Users',
        metric: 'users',
        value: currentUsers,
        baseline: baselineUsers,
        unit: 'users',
        trend: currentUsers >= baselineUsers ? 'up' : 'down',
        trendPercentage: baselineUsers > 0 ? ((currentUsers - baselineUsers) / baselineUsers) * 100 : 0,
        period,
      },
    ];
  }

  // ============ Leaderboards ============

  async getLeaderboard(
    metric: LeaderboardMetric,
    period: LeaderboardPeriod,
    filters: LeaderboardFiltersDto,
    user: any,
  ) {
    // Generate cache key
    const cacheKey = this.cacheService.generateKey(
      'leaderboard',
      metric,
      period,
      filters.subcounty,
      filters.county,
      filters.limit,
    );

    // Try to get from cache
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for leaderboard: ${cacheKey}`);
      return cached;
    }

    // Calculate date range for period
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    switch (period) {
      case LeaderboardPeriod.DAILY:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case LeaderboardPeriod.WEEKLY:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case LeaderboardPeriod.MONTHLY:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case LeaderboardPeriod.QUARTERLY:
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case LeaderboardPeriod.YEARLY:
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }

    end.setHours(23, 59, 59, 999);

    const limit = filters.limit || 50;

    // Generate title components
    const periodNames: Record<LeaderboardPeriod, string> = {
      [LeaderboardPeriod.DAILY]: 'Today',
      [LeaderboardPeriod.WEEKLY]: 'This Week',
      [LeaderboardPeriod.MONTHLY]: 'This Month',
      [LeaderboardPeriod.QUARTERLY]: 'This Quarter',
      [LeaderboardPeriod.YEARLY]: 'This Year',
    };

    const metricNames: Record<LeaderboardMetric, string> = {
      [LeaderboardMetric.REVENUE]: 'Revenue',
      [LeaderboardMetric.SALES]: 'Sales',
      [LeaderboardMetric.ORDERS]: 'Orders',
      [LeaderboardMetric.RATING]: 'Rating',
      [LeaderboardMetric.QUALITY]: 'Quality',
    };

    // OPTIMIZATION: Use single aggregated query instead of N+1 queries
    // Build the aggregation based on metric type
    let entries: any[] = [];

    if (metric === LeaderboardMetric.REVENUE || metric === LeaderboardMetric.SALES || metric === LeaderboardMetric.ORDERS) {
      // Use groupBy for order-based metrics (single query instead of N+1)
      const orderAggregation = await this.prisma.marketplaceOrder.groupBy({
        by: ['farmerId'],
        where: {
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: start, lte: end },
          farmer: {
            role: 'FARMER',
            profile: {
              ...(filters.subcounty && { subCounty: filters.subcounty }),
              ...(filters.county && { county: filters.county }),
            },
          },
        },
        _sum: { totalAmount: true, quantity: true },
        _count: { id: true },
        orderBy: metric === LeaderboardMetric.REVENUE
          ? { _sum: { totalAmount: 'desc' } }
          : metric === LeaderboardMetric.SALES
            ? { _sum: { quantity: 'desc' } }
            : { _count: { id: 'desc' } },
        take: limit + 10, // Take extra to account for potential filtering
      });

      // Get farmer profiles in a single batch query
      const farmerIds = orderAggregation
        .map(a => a.farmerId)
        .filter((id): id is string => id !== null);
      const profiles = await this.prisma.profile.findMany({
        where: { userId: { in: farmerIds } },
        select: { userId: true, firstName: true, lastName: true, subCounty: true },
      });
      const profileMap = new Map(profiles.map(p => [p.userId, p]));

      entries = orderAggregation
        .filter(agg => agg.farmerId !== null)
        .map((agg, index) => {
          const profile = profileMap.get(agg.farmerId!);
        const fullName = profile
          ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown'
          : 'Unknown';
        const totalRevenue = agg._sum.totalAmount || 0;
        const totalSales = agg._sum.quantity || 0;
        const orderCount = agg._count.id;
        const score = metric === LeaderboardMetric.REVENUE
          ? totalRevenue
          : metric === LeaderboardMetric.SALES
            ? totalSales
            : orderCount;

        return {
          id: agg.farmerId!,
          name: fullName,
          score,
          totalRevenue,
          totalSales,
          orderCount,
          avgRating: 0,
          subCounty: profile?.subCounty || 'Unknown',
          isCurrentUser: user?.id === agg.farmerId!,
          farmerName: fullName,
          userId: agg.farmerId!,
          rank: index + 1,
          metric,
        };
      });
    } else if (metric === LeaderboardMetric.RATING) {
      // Use groupBy for rating-based metrics
      const ratingAggregation = await this.prisma.rating.groupBy({
        by: ['ratedUserId'],
        where: {
          createdAt: { gte: start, lte: end },
          ratedUser: {
            role: 'FARMER',
            profile: {
              ...(filters.subcounty && { subCounty: filters.subcounty }),
              ...(filters.county && { county: filters.county }),
            },
          },
        },
        _avg: { rating: true },
        _count: { id: true },
        having: { rating: { _count: { gte: 1 } } },
        orderBy: { _avg: { rating: 'desc' } },
        take: limit + 10,
      });

      // Get farmer profiles in a single batch query
      const farmerIds = ratingAggregation
        .map(a => a.ratedUserId)
        .filter((id): id is string => id !== null);
      const profiles = await this.prisma.profile.findMany({
        where: { userId: { in: farmerIds } },
        select: { userId: true, firstName: true, lastName: true, subCounty: true },
      });
      const profileMap = new Map(profiles.map(p => [p.userId, p]));

      entries = ratingAggregation
        .filter(agg => agg.ratedUserId !== null)
        .map((agg, index) => {
        const profile = profileMap.get(agg.ratedUserId!);
        const fullName = profile
          ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown'
          : 'Unknown';
        const avgRating = agg._avg.rating || 0;

        return {
          id: agg.ratedUserId!,
          name: fullName,
          score: avgRating,
          totalRevenue: 0,
          totalSales: 0,
          orderCount: 0,
          avgRating: Math.round(avgRating * 10) / 10,
          subCounty: profile?.subCounty || 'Unknown',
          isCurrentUser: user?.id === agg.ratedUserId!,
          farmerName: fullName,
          userId: agg.ratedUserId!,
          rank: index + 1,
          metric,
        };
      });
    } else if (metric === LeaderboardMetric.QUALITY) {
      // Use groupBy for quality-based metrics
      const qualityAggregation = await this.prisma.qualityCheck.groupBy({
        by: ['farmerId'],
        where: {
          checkedAt: { gte: start, lte: end },
          farmer: {
            role: 'FARMER',
            profile: {
              ...(filters.subcounty && { subCounty: filters.subcounty }),
              ...(filters.county && { county: filters.county }),
            },
          },
        },
        _avg: { qualityScore: true },
        _count: { id: true },
        having: { id: { _count: { gte: 1 } } },
        orderBy: { _avg: { qualityScore: 'desc' } },
        take: limit + 10,
      });

      // Get farmer profiles in a single batch query
      const farmerIds = qualityAggregation
        .map(a => a.farmerId)
        .filter((id): id is string => id !== null);
      const profiles = await this.prisma.profile.findMany({
        where: { userId: { in: farmerIds } },
        select: { userId: true, firstName: true, lastName: true, subCounty: true },
      });
      const profileMap = new Map(profiles.map(p => [p.userId, p]));

      entries = qualityAggregation
        .filter(agg => agg.farmerId !== null)
        .map((agg, index) => {
          const profile = profileMap.get(agg.farmerId!);
        const fullName = profile
          ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown'
          : 'Unknown';
        const qualityScore = agg._avg.qualityScore || 0;

        return {
          id: agg.farmerId!,
          name: fullName,
          score: qualityScore,
          totalRevenue: 0,
          totalSales: 0,
          orderCount: 0,
          avgRating: 0,
          subCounty: profile?.subCounty || 'Unknown',
          isCurrentUser: user?.id === agg.farmerId!,
          farmerName: fullName,
          userId: agg.farmerId!,
          rank: index + 1,
          metric,
        };
      });
    }

    // Filter out entries with zero score
    const validEntries = entries.filter(e => e.score > 0);

    // Apply limit
    const topEntries = validEntries.slice(0, limit);

    // If userId specified and not in top N, add their entry
    if (filters.userId) {
      const userEntry = validEntries.find(e => e.userId === filters.userId);
      if (userEntry && !topEntries.find(e => e.userId === filters.userId)) {
        topEntries.push(userEntry);
      }
    }

    const result = {
      id: `leaderboard-${metric}-${period}-${now.toISOString().split('T')[0]}`,
      title: `${metricNames[metric]} Leaderboard - ${periodNames[period]}`,
      metric,
      period,
      entries: topEntries,
      generatedAt: now.toISOString(),
    };

    // Cache the result
    this.cacheService.set(cacheKey, result, ANALYTICS_CACHE_TTL.LEADERBOARD);

    return result;
  }

  // ============ Market Info ============

  async getMarketInfo(filters: { location?: string; variety?: string; timeRange?: TimeRange; dateRange?: { start?: string; end?: string } }) {
    const now = new Date();
    // Use flexible time range - default to 30 days if not specified
    const { start: trendStart, end: trendEnd } = filters.dateRange?.start && filters.dateRange?.end
      ? { start: new Date(filters.dateRange.start), end: new Date(filters.dateRange.end) }
      : filters.timeRange
        ? this.getDateRange(filters.timeRange)
        : (() => {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);
            return { start: thirtyDaysAgo, end: now };
          })();

    // Get current active listings
    const listingsWhere: any = {
      status: 'ACTIVE',
    };

    if (filters.location) {
      listingsWhere.OR = [
        { subCounty: { contains: filters.location, mode: 'insensitive' } },
        { county: { contains: filters.location, mode: 'insensitive' } },
      ];
    }

    if (filters.variety) {
      listingsWhere.variety = filters.variety.toUpperCase();
    }

    const activeListings = await this.prisma.produceListing.findMany({
      where: listingsWhere,
      select: {
        variety: true,
        qualityGrade: true,
        pricePerKg: true,
        subCounty: true,
        county: true,
        createdAt: true,
      },
    });

    // Calculate market prices by variety, grade, and location
    const priceMap = new Map<string, {
      variety: string;
      grade: string;
      location: string;
      prices: number[];
      count: number;
    }>();

    activeListings.forEach(listing => {
      const key = `${listing.variety}-${listing.qualityGrade}-${listing.subCounty || listing.county}`;
      if (!priceMap.has(key)) {
        priceMap.set(key, {
          variety: listing.variety,
          grade: listing.qualityGrade,
          location: listing.subCounty || listing.county || 'Unknown',
          prices: [],
          count: 0,
        });
      }
      const entry = priceMap.get(key)!;
      entry.prices.push(listing.pricePerKg);
      entry.count += 1;
    });

    // Calculate average prices and compare with previous period
    const periodDays = Math.ceil((trendEnd.getTime() - trendStart.getTime()) / (1000 * 60 * 60 * 24));
    const previousPeriodStart = new Date(trendStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);
    const previousPeriodEnd = new Date(trendStart);

    // Get previous period orders for accurate price comparison
    const previousPeriodOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: previousPeriodStart, lt: previousPeriodEnd },
      },
      select: {
        variety: true,
        pricePerKg: true,
        qualityScore: true,
        listingId: true,
        listing: {
          select: { qualityGrade: true },
        },
        farmer: {
          select: {
            profile: {
              select: { subCounty: true, county: true },
            },
          },
        },
        qualityCheck: {
          select: { qualityGrade: true },
        },
      },
    });

    // Calculate previous period prices by variety/grade/location
    // Use qualityCheck.qualityGrade if available, then listing.qualityGrade, otherwise infer from qualityScore
    const previousPriceMap = new Map<string, number[]>();
    previousPeriodOrders.forEach(order => {
      const location = order.farmer?.profile?.subCounty || order.farmer?.profile?.county || 'Unknown';
      // Determine quality grade: prefer qualityCheck, then listing, then infer from score
      let qualityGrade = 'A';
      if (order.qualityCheck?.qualityGrade) {
        qualityGrade = order.qualityCheck.qualityGrade;
      } else if (order.listing?.qualityGrade) {
        qualityGrade = order.listing.qualityGrade;
      } else if (order.qualityScore) {
        // Infer grade from score: 80+ = A, 60-79 = B, <60 = C
        qualityGrade = order.qualityScore >= 80 ? 'A' : order.qualityScore >= 60 ? 'B' : 'C';
      }
      const key = `${order.variety}-${qualityGrade}-${location}`;
      if (!previousPriceMap.has(key)) {
        previousPriceMap.set(key, []);
      }
      previousPriceMap.get(key)!.push(order.pricePerKg);
    });

    const marketPrices = Array.from(priceMap.values()).map(entry => {
      const avgPrice = entry.prices.reduce((sum, p) => sum + p, 0) / entry.prices.length;
      const key = `${entry.variety}-${entry.grade}-${entry.location}`;
      const previousPrices = previousPriceMap.get(key) || [];
      const previousAvg = previousPrices.length > 0
        ? previousPrices.reduce((sum, p) => sum + p, 0) / previousPrices.length
        : avgPrice * 0.95; // Fallback if no previous data
      const change = avgPrice - previousAvg;
      const changePercent = previousAvg > 0 ? (change / previousAvg) * 100 : 0;

      return {
        variety: entry.variety,
        grade: entry.grade,
        currentPrice: Math.round(avgPrice * 100) / 100,
        previousPrice: Math.round(previousAvg * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        location: entry.location,
        listingCount: entry.count,
        lastUpdated: now.toISOString(),
      };
    });

    // Get price trends by variety (using flexible time range)
    const completedOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: trendStart, lte: trendEnd },
      },
      select: {
        variety: true,
        pricePerKg: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date and variety
    const trendMap = new Map<string, Map<string, number[]>>();
    completedOrders.forEach(order => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, new Map());
      }
      const varietyMap = trendMap.get(dateKey)!;
      if (!varietyMap.has(order.variety)) {
        varietyMap.set(order.variety, []);
      }
      varietyMap.get(order.variety)!.push(order.pricePerKg);
    });

    // Calculate average prices per day per variety
    const priceTrends: Array<{
      date: string;
      kenya?: number;
      spk004?: number;
      kabode?: number;
      kakamega?: number;
    }> = [];

    Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, varietyMap]) => {
        const trend: any = { date };
        varietyMap.forEach((prices, variety) => {
          const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          const varietyKey = variety.toLowerCase();
          if (varietyKey === 'kenya') trend.kenya = Math.round(avgPrice * 100) / 100;
          else if (varietyKey === 'spk004') trend.spk004 = Math.round(avgPrice * 100) / 100;
          else if (varietyKey === 'kabode') trend.kabode = Math.round(avgPrice * 100) / 100;
          else if (varietyKey === 'kakamega') trend.kakamega = Math.round(avgPrice * 100) / 100;
        });
        priceTrends.push(trend);
      });

    // Get buyer demand (from RFQs, SourcingRequests, and pending orders)
    const rfqs = await this.prisma.rFQ.findMany({
      where: {
        status: { in: ['PUBLISHED', 'EVALUATING'] },
        deadline: { gte: now },
      },
      select: {
        variety: true,
        qualityGrade: true,
        quantity: true,
        deliveryLocation: true,
        buyer: {
          select: {
            profile: {
              select: {
                subCounty: true,
                county: true,
              },
            },
          },
        },
      },
    });

    const sourcingRequests = await this.prisma.sourcingRequest.findMany({
      where: {
        status: { in: ['OPEN', 'URGENT'] },
        deadline: { gte: now },
      },
      select: {
        variety: true,
        qualityGrade: true,
        quantity: true,
        deliveryRegion: true,
        buyer: {
          select: {
            profile: {
              select: {
                subCounty: true,
                county: true,
              },
            },
          },
        },
      },
    });

    const pendingOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        status: { in: ['ORDER_PLACED', 'ORDER_ACCEPTED'] },
      },
      select: {
        variety: true,
        quantity: true,
        deliveryCounty: true,
      },
    });

    // Aggregate buyer demand
    const demandMap = new Map<string, {
      variety: string;
      grade: string;
      location: string;
      buyerCount: number;
      totalQuantityNeeded: number;
    }>();

    // Process RFQs
    rfqs.forEach(rfq => {
      if (!rfq.variety || !rfq.qualityGrade) return;
      const location = rfq.buyer?.profile?.subCounty || rfq.buyer?.profile?.county || rfq.deliveryLocation || 'Unknown';
      const key = `${rfq.variety}-${rfq.qualityGrade}-${location}`;
      
      if (!demandMap.has(key)) {
        demandMap.set(key, {
          variety: rfq.variety,
          grade: rfq.qualityGrade,
          location,
          buyerCount: 0,
          totalQuantityNeeded: 0,
        });
      }
      const entry = demandMap.get(key)!;
      entry.buyerCount += 1;
      entry.totalQuantityNeeded += rfq.quantity || 0;
    });

    // Process Sourcing Requests
    sourcingRequests.forEach(sr => {
      if (!sr.variety || !sr.qualityGrade) return;
      const location = sr.buyer?.profile?.subCounty || sr.buyer?.profile?.county || sr.deliveryRegion || 'Unknown';
      const key = `${sr.variety}-${sr.qualityGrade}-${location}`;
      
      if (!demandMap.has(key)) {
        demandMap.set(key, {
          variety: sr.variety,
          grade: sr.qualityGrade,
          location,
          buyerCount: 0,
          totalQuantityNeeded: 0,
        });
      }
      const entry = demandMap.get(key)!;
      entry.buyerCount += 1;
      entry.totalQuantityNeeded += sr.quantity || 0;
    });

    // Process Pending Orders
    pendingOrders.forEach(order => {
      const key = `${order.variety}-A-${order.deliveryCounty}`; // Assume Grade A for pending orders
      if (!demandMap.has(key)) {
        demandMap.set(key, {
          variety: order.variety,
          grade: 'A',
          location: order.deliveryCounty,
          buyerCount: 0,
          totalQuantityNeeded: 0,
        });
      }
      const entry = demandMap.get(key)!;
      entry.buyerCount += 1;
      entry.totalQuantityNeeded += order.quantity || 0;
    });

    // Convert to array and calculate demand levels
    const buyerDemand = Array.from(demandMap.values()).map(entry => {
      // Determine demand level based on quantity and buyer count
      let demandLevel: 'high' | 'medium' | 'low' = 'low';
      if (entry.totalQuantityNeeded > 2000 || entry.buyerCount > 10) {
        demandLevel = 'high';
      } else if (entry.totalQuantityNeeded > 1000 || entry.buyerCount > 5) {
        demandLevel = 'medium';
      }

      const colors = {
        high: '#EF4444',
        medium: '#F59E0B',
        low: '#22C55E',
      };

      return {
        ...entry,
        demandLevel,
        color: colors[demandLevel],
      };
    });

    return {
      prices: marketPrices,
      priceTrends,
      buyerDemand,
      generatedAt: now.toISOString(),
    };
  }

  // ============ Enhanced Farmer Analytics ============

  async getFarmerAnalytics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const farmerId = user?.id;

    if (!farmerId) {
      throw new Error('Farmer ID required');
    }

    // Get previous period for comparison
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(start);

    // Quantity delivered (kg)
    const currentQuantity = await this.prisma.marketplaceOrder.aggregate({
      where: {
        farmerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    });

    const previousQuantity = await this.prisma.marketplaceOrder.aggregate({
      where: {
        farmerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: previousStart, lt: previousEnd },
      },
      _sum: { quantity: true },
    });

    // Quality score from ratings (average rating converted to percentage)
    const ratings = await this.prisma.rating.findMany({
      where: {
        ratedUserId: farmerId,
        createdAt: { gte: start, lte: end },
      },
      select: { rating: true },
    });

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
      : 0;
    const qualityScorePercent = (avgRating / 5) * 100; // Convert 1-5 scale to percentage

    // Active listings count
    const activeListings = await this.prisma.produceListing.count({
      where: {
        farmerId,
        status: 'ACTIVE',
      },
    });

    // Completion rate
    const totalOrders = await this.prisma.marketplaceOrder.count({
      where: {
        farmerId,
        createdAt: { gte: start, lte: end },
      },
    });

    const completedOrders = await this.prisma.marketplaceOrder.count({
      where: {
        farmerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
    });

    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Get revenue for peer comparison
    const currentRevenue = await this.prisma.marketplaceOrder.aggregate({
      where: {
        farmerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });

    // Get farmer's sub-county for peer comparison
    const farmerProfile = await this.prisma.profile.findUnique({
      where: { userId: farmerId },
      select: { subCounty: true },
    });

    // Get peer average revenue (same sub-county)
    const peerProfiles = await this.prisma.profile.findMany({
      where: {
        user: { role: 'FARMER' },
        subCounty: farmerProfile?.subCounty,
        userId: { not: farmerId },
      },
      select: { userId: true },
    });

    const peerRevenues = await Promise.all(
      peerProfiles.map(async (profile) => {
        const revenue = await this.prisma.marketplaceOrder.aggregate({
          where: {
            farmerId: profile.userId,
            status: { in: ['COMPLETED', 'DELIVERED'] },
            createdAt: { gte: start, lte: end },
          },
          _sum: { totalAmount: true },
        });
        return revenue._sum.totalAmount || 0;
      })
    );

    const peerAvgRevenue = peerRevenues.length > 0
      ? peerRevenues.reduce((sum, r) => sum + r, 0) / peerRevenues.length
      : 0;

    const salesGrowthVsPeer = peerAvgRevenue > 0
      ? ((currentRevenue._sum.totalAmount || 0) - peerAvgRevenue) / peerAvgRevenue * 100
      : 0;

    // Get percentile ranking (simplified - would need full leaderboard calculation)
    const allFarmerRevenues = await Promise.all(
      (await this.prisma.profile.findMany({
        where: { user: { role: 'FARMER' } },
        select: { userId: true },
      })).map(async (profile) => {
        const revenue = await this.prisma.marketplaceOrder.aggregate({
          where: {
            farmerId: profile.userId,
            status: { in: ['COMPLETED', 'DELIVERED'] },
            createdAt: { gte: start, lte: end },
          },
          _sum: { totalAmount: true },
        });
        return { userId: profile.userId, revenue: revenue._sum.totalAmount || 0 };
      })
    );

    allFarmerRevenues.sort((a, b) => b.revenue - a.revenue);
    const farmerRank = allFarmerRevenues.findIndex(f => f.userId === farmerId) + 1;
    const totalFarmers = allFarmerRevenues.length;
    const percentile = totalFarmers > 0 ? ((totalFarmers - farmerRank) / totalFarmers) * 100 : 0;

    // Sub-county ranking (ranking within same sub-county)
    const subCountyFarmers = await Promise.all(
      (await this.prisma.profile.findMany({
        where: {
          user: { role: 'FARMER' },
          subCounty: farmerProfile?.subCounty,
        },
        select: { userId: true },
      })).map(async (profile) => {
        const revenue = await this.prisma.marketplaceOrder.aggregate({
          where: {
            farmerId: profile.userId,
            status: { in: ['COMPLETED', 'DELIVERED'] },
            createdAt: { gte: start, lte: end },
          },
          _sum: { totalAmount: true },
        });
        return { userId: profile.userId, revenue: revenue._sum.totalAmount || 0 };
      })
    );

    subCountyFarmers.sort((a, b) => b.revenue - a.revenue);
    const subCountyRank = subCountyFarmers.findIndex(f => f.userId === farmerId) + 1;
    const totalSubCountyFarmers = subCountyFarmers.length;
    const subCountyPercentile = totalSubCountyFarmers > 0
      ? ((totalSubCountyFarmers - subCountyRank) / totalSubCountyFarmers) * 100
      : 0;

    return {
      quantityDelivered: currentQuantity._sum.quantity || 0,
      quantityDeliveredPrevious: previousQuantity._sum.quantity || 0,
      quantityGrowthRate: previousQuantity._sum.quantity && previousQuantity._sum.quantity > 0
        ? ((currentQuantity._sum.quantity || 0) - previousQuantity._sum.quantity) / previousQuantity._sum.quantity * 100
        : 0,
      qualityScore: Math.round(qualityScorePercent * 100) / 100,
      avgRating: Math.round(avgRating * 10) / 10,
      activeListings,
      completionRate: Math.round(completionRate * 100) / 100,
      peerRanking: {
        rank: farmerRank,
        totalFarmers,
        percentile: Math.round(percentile * 100) / 100,
      },
      subCountyRanking: {
        rank: subCountyRank,
        totalFarmers: totalSubCountyFarmers,
        percentile: Math.round(subCountyPercentile * 100) / 100,
        subCounty: farmerProfile?.subCounty || 'Unknown',
      },
      salesGrowthVsPeer: Math.round(salesGrowthVsPeer * 100) / 100,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  // ============ Enhanced Buyer Analytics ============

  async getBuyerAnalytics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const buyerId = user?.id;

    if (!buyerId) {
      throw new Error('Buyer ID required');
    }

    // Get previous period for comparison
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(start);

    // Volume sourced (tons)
    const currentVolume = await this.prisma.marketplaceOrder.aggregate({
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    });

    const previousVolume = await this.prisma.marketplaceOrder.aggregate({
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: previousStart, lt: previousEnd },
      },
      _sum: { quantity: true },
    });

    const volumeInTons = (currentVolume._sum.quantity || 0) / 1000;
    const volumeGrowthRate = previousVolume._sum.quantity && previousVolume._sum.quantity > 0
      ? ((currentVolume._sum.quantity || 0) - previousVolume._sum.quantity) / previousVolume._sum.quantity * 100
      : 0;

    // Average price per kg vs market average
    const buyerOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      select: { pricePerKg: true, totalAmount: true, quantity: true, createdAt: true },
    });

    const buyerAvgPrice = buyerOrders.length > 0
      ? buyerOrders.reduce((sum, o) => sum + o.pricePerKg, 0) / buyerOrders.length
      : 0;

    // Market average price (all orders)
    const marketOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      select: { pricePerKg: true },
    });

    const marketAvgPrice = marketOrders.length > 0
      ? marketOrders.reduce((sum, o) => sum + o.pricePerKg, 0) / marketOrders.length
      : 0;

    const priceVsMarket = marketAvgPrice > 0
      ? ((buyerAvgPrice - marketAvgPrice) / marketAvgPrice) * 100
      : 0;

    // Price trend % change (current period vs previous period)
    const previousBuyerOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: previousStart, lt: previousEnd },
      },
      select: { pricePerKg: true },
    });

    const previousBuyerAvgPrice = previousBuyerOrders.length > 0
      ? previousBuyerOrders.reduce((sum, o) => sum + o.pricePerKg, 0) / previousBuyerOrders.length
      : 0;

    const priceTrendPercentChange = previousBuyerAvgPrice > 0
      ? ((buyerAvgPrice - previousBuyerAvgPrice) / previousBuyerAvgPrice) * 100
      : 0;

    // Quality acceptance rate (% Grade A orders)
    const ordersWithQuality = await this.prisma.marketplaceOrder.findMany({
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      include: {
        qualityCheck: {
          select: { qualityGrade: true },
        },
      },
    });

    const gradeAOrders = ordersWithQuality.filter(o => o.qualityCheck?.qualityGrade === 'A').length;
    const qualityAcceptanceRate = ordersWithQuality.length > 0
      ? (gradeAOrders / ordersWithQuality.length) * 100
      : 0;

    // Active suppliers count
    const uniqueSuppliers = new Set(
      (await this.prisma.marketplaceOrder.findMany({
        where: {
          buyerId,
          status: { in: ['ORDER_PLACED', 'ORDER_ACCEPTED', 'COMPLETED', 'DELIVERED'] },
          createdAt: { gte: start, lte: end },
        },
        select: { farmerId: true },
        distinct: ['farmerId'],
      })).map(o => o.farmerId)
    );

    // Deliveries this week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const deliveriesThisWeek = await this.prisma.marketplaceOrder.count({
      where: {
        buyerId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        actualDeliveryDate: { gte: weekStart, lte: weekEnd },
      },
    });

    // Sourcing by method
    const directOrders = await this.prisma.marketplaceOrder.count({
      where: {
        buyerId,
        listingId: { not: null },
        rfqId: null,
        sourcingRequestId: null,
        createdAt: { gte: start, lte: end },
      },
    });

    const rfqOrders = await this.prisma.marketplaceOrder.count({
      where: {
        buyerId,
        rfqId: { not: null },
        createdAt: { gte: start, lte: end },
      },
    });

    const negotiationOrders = await this.prisma.marketplaceOrder.count({
      where: {
        buyerId,
        negotiation: { isNot: null },
        createdAt: { gte: start, lte: end },
      },
    });

    const sourcingRequestOrders = await this.prisma.marketplaceOrder.count({
      where: {
        buyerId,
        sourcingRequestId: { not: null },
        createdAt: { gte: start, lte: end },
      },
    });

    // Total procurement value
    const totalProcurement = await this.prisma.marketplaceOrder.aggregate({
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });

    // Supplier performance trends (by supplier over time period)
    const supplierPerformance = await this.prisma.marketplaceOrder.groupBy({
      by: ['farmerId'],
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
      _sum: { totalAmount: true, quantity: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10, // Top 10 suppliers
    });

    const supplierPerformanceDetails = await Promise.all(
      supplierPerformance.map(async (supplier) => {
        const farmerProfile = await this.prisma.profile.findUnique({
          where: { userId: supplier.farmerId },
          select: {
            firstName: true,
            lastName: true,
            subCounty: true,
            county: true,
          },
        });

        // Get quality rating for this supplier
        const supplierOrders = await this.prisma.marketplaceOrder.findMany({
          where: {
            buyerId,
            farmerId: supplier.farmerId,
            status: { in: ['COMPLETED', 'DELIVERED'] },
            createdAt: { gte: start, lte: end },
          },
          include: {
            qualityCheck: {
              select: { qualityGrade: true },
            },
          },
        });

        const gradeAOrders = supplierOrders.filter(o => o.qualityCheck?.qualityGrade === 'A').length;
        const qualityRate = supplierOrders.length > 0 ? (gradeAOrders / supplierOrders.length) * 100 : 0;

        return {
          farmerId: supplier.farmerId,
          farmerName: farmerProfile ? `${farmerProfile.firstName} ${farmerProfile.lastName}` : 'Unknown',
          location: farmerProfile?.subCounty || farmerProfile?.county || 'Unknown',
          orderCount: supplier._count.id,
          totalValue: supplier._sum.totalAmount || 0,
          totalQuantity: supplier._sum.quantity || 0,
          qualityAcceptanceRate: Math.round(qualityRate * 100) / 100,
        };
      })
    );

    // Sourcing by region (geographic breakdown)
    const ordersByRegion = await this.prisma.marketplaceOrder.findMany({
      where: {
        buyerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      select: {
        totalAmount: true,
        quantity: true,
        farmer: {
          select: {
            profile: {
              select: { subCounty: true, county: true },
            },
          },
        },
      },
    });

    const regionMap = new Map<string, { region: string; orderCount: number; totalValue: number; totalQuantity: number }>();
    ordersByRegion.forEach(order => {
      const region = order.farmer?.profile?.subCounty || order.farmer?.profile?.county || 'Unknown';
      if (!regionMap.has(region)) {
        regionMap.set(region, {
          region,
          orderCount: 0,
          totalValue: 0,
          totalQuantity: 0,
        });
      }
      const entry = regionMap.get(region)!;
      entry.orderCount += 1;
      entry.totalValue += order.totalAmount || 0;
      entry.totalQuantity += order.quantity || 0;
    });

    const sourcingByRegion = Array.from(regionMap.values()).map(entry => ({
      region: entry.region,
      orderCount: entry.orderCount,
      totalValue: Math.round(entry.totalValue * 100) / 100,
      totalQuantity: Math.round(entry.totalQuantity * 100) / 100,
      percentageOfTotal: totalProcurement._sum.totalAmount && totalProcurement._sum.totalAmount > 0
        ? Math.round((entry.totalValue / totalProcurement._sum.totalAmount) * 100 * 100) / 100
        : 0,
    })).sort((a, b) => b.totalValue - a.totalValue);

    // Supplier distribution (distribution metrics)
    const totalSuppliers = uniqueSuppliers.size;
    const supplierDistribution = {
      totalSuppliers,
      top10SupplierValue: supplierPerformanceDetails
        .reduce((sum, s) => sum + s.totalValue, 0),
      top10SupplierPercentage: totalProcurement._sum.totalAmount && totalProcurement._sum.totalAmount > 0
        ? Math.round((supplierPerformanceDetails.reduce((sum, s) => sum + s.totalValue, 0) / totalProcurement._sum.totalAmount) * 100 * 100) / 100
        : 0,
      averageOrdersPerSupplier: totalSuppliers > 0
        ? Math.round((ordersByRegion.length / totalSuppliers) * 100) / 100
        : 0,
      averageValuePerSupplier: totalSuppliers > 0
        ? Math.round((totalProcurement._sum.totalAmount || 0) / totalSuppliers * 100) / 100
        : 0,
    };

    return {
      volumeSourced: volumeInTons,
      volumeSourcedPrevious: (previousVolume._sum.quantity || 0) / 1000,
      volumeGrowthRate: Math.round(volumeGrowthRate * 100) / 100,
      averagePrice: Math.round(buyerAvgPrice * 100) / 100,
      marketAveragePrice: Math.round(marketAvgPrice * 100) / 100,
      priceVsMarket: Math.round(priceVsMarket * 100) / 100,
      priceTrendPercentChange: Math.round(priceTrendPercentChange * 100) / 100,
      previousAveragePrice: Math.round(previousBuyerAvgPrice * 100) / 100,
      qualityAcceptanceRate: Math.round(qualityAcceptanceRate * 100) / 100,
      activeSuppliers: uniqueSuppliers.size,
      deliveriesThisWeek,
      totalProcurementValue: totalProcurement._sum.totalAmount || 0,
      sourcingByMethod: {
        directOrders,
        rfqOrders,
        negotiationOrders,
        sourcingRequestOrders,
      },
      supplierPerformance: supplierPerformanceDetails,
      sourcingByRegion,
      supplierDistribution,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  // ============ Enhanced Staff Analytics ============

  async getStaffAnalytics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);

    // Get previous period for comparison
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(start);

    // Platform fee (2% of revenue)
    const totalRevenue = await this.prisma.marketplaceOrder.aggregate({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });

    const platformFee = (totalRevenue._sum.totalAmount || 0) * 0.02;

    // Quality trends (Grade A percentage)
    const qualityChecks = await this.prisma.qualityCheck.findMany({
      where: {
        checkedAt: { gte: start, lte: end },
      },
      select: { qualityGrade: true },
    });

    const gradeAChecks = qualityChecks.filter(qc => qc.qualityGrade === 'A').length;
    const qualityGradeAPercentage = qualityChecks.length > 0
      ? (gradeAChecks / qualityChecks.length) * 100
      : 0;

    // Geographic analytics - centers by location
    const centers = await this.prisma.aggregationCenter.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        county: true,
        subCounty: true,
        isActive: true,
      },
    });

    // Farmer distribution by sub-county
    const farmerProfiles = await this.prisma.profile.findMany({
      where: {
        user: { role: 'FARMER' },
      },
      select: {
        subCounty: true,
        county: true,
      },
    });

    const farmerDistribution = new Map<string, number>();
    farmerProfiles.forEach(profile => {
      const key = profile.subCounty || profile.county || 'Unknown';
      farmerDistribution.set(key, (farmerDistribution.get(key) || 0) + 1);
    });

    // Volume trends (already in trends endpoint, but adding here for completeness)
    const volumeOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      select: { quantity: true, createdAt: true },
    });

    const totalVolume = volumeOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);

    return {
      platformFee: Math.round(platformFee * 100) / 100,
      qualityGradeAPercentage: Math.round(qualityGradeAPercentage * 100) / 100,
      totalVolume: Math.round(totalVolume * 100) / 100,
      geographicAnalytics: {
        centers: centers.map(c => ({
          id: c.id,
          name: c.name,
          location: c.location,
          county: c.county,
          subCounty: c.subCounty,
          isActive: c.isActive,
        })),
        farmerDistribution: Array.from(farmerDistribution.entries()).map(([location, count]) => ({
          location,
          count,
        })),
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  // ============ County Officer Analytics ============

  async getCountyOfficerAnalytics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    
    // Get officer's jurisdiction (from profile)
    const officerProfile = await this.prisma.profile.findUnique({
      where: { userId: user?.id },
      select: { county: true, subCounty: true },
    });

    const jurisdictionWhere: any = {};
    if (officerProfile?.county) {
      jurisdictionWhere.county = officerProfile.county;
    }
    if (officerProfile?.subCounty) {
      jurisdictionWhere.subCounty = officerProfile.subCounty;
    }

    // Total farmers in jurisdiction
    const totalFarmers = await this.prisma.profile.count({
      where: {
        user: { role: 'FARMER' },
        ...jurisdictionWhere,
      },
    });

    // Active farmers (have orders in period)
    const activeFarmerIds = await this.prisma.marketplaceOrder.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        farmer: {
          profile: jurisdictionWhere,
        },
      },
      select: { farmerId: true },
      distinct: ['farmerId'],
    });

    const activeFarmers = activeFarmerIds.length;

    // Total production volume (tons) from orders
    const productionVolume = await this.prisma.marketplaceOrder.aggregate({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
        farmer: {
          profile: jurisdictionWhere,
        },
      },
      _sum: { quantity: true },
    });

    const productionVolumeTons = (productionVolume._sum.quantity || 0) / 1000;

    // Aggregation centers count
    const centersCount = await this.prisma.aggregationCenter.count({
      where: {
        ...jurisdictionWhere,
      },
    });

    // Quality score (% Grade A)
    const qualityChecks = await this.prisma.qualityCheck.findMany({
      where: {
        checkedAt: { gte: start, lte: end },
        center: jurisdictionWhere,
      },
      select: { qualityGrade: true },
    });

    const gradeAChecks = qualityChecks.filter(qc => qc.qualityGrade === 'A').length;
    const qualityScore = qualityChecks.length > 0
      ? (gradeAChecks / qualityChecks.length) * 100
      : 0;

    // Total value (KES)
    const totalValue = await this.prisma.marketplaceOrder.aggregate({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
        farmer: {
          profile: jurisdictionWhere,
        },
      },
      _sum: { totalAmount: true },
    });

    // Pending advisories count
    const pendingAdvisories = await this.prisma.advisory.count({
      where: {
        status: 'PENDING',
        ...(jurisdictionWhere.county ? { targetCounty: jurisdictionWhere.county } : {}),
      },
    });

    // Monthly production trend (dynamic based on time range)
    // Calculate number of months in the range
    const productionMonthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    const productionNumberOfMonths = Math.max(1, Math.min(productionMonthsDiff, 24)); // Cap at 24 months for performance
    
    const monthlyProduction: Array<{ month: string; volume: number }> = [];
    for (let i = productionNumberOfMonths - 1; i >= 0; i--) {
      const monthStart = new Date(end);
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthVolume = await this.prisma.marketplaceOrder.aggregate({
        where: {
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: monthStart, lt: monthEnd },
          farmer: {
            profile: jurisdictionWhere,
          },
        },
        _sum: { quantity: true },
      });

      monthlyProduction.push({
        month: monthStart.toISOString().substring(0, 7), // YYYY-MM
        volume: Math.round((monthVolume._sum.quantity || 0) / 1000 * 100) / 100, // tons
      });
    }

    // Production by sub-county
    const farmersBySubCounty = await this.prisma.profile.findMany({
      where: {
        user: { role: 'FARMER' },
        ...jurisdictionWhere,
      },
      select: {
        subCounty: true,
        userId: true,
      },
    });

    const productionBySubCounty = await Promise.all(
      Array.from(new Set(farmersBySubCounty.map(f => f.subCounty).filter(Boolean))).map(async (subCounty) => {
        const volume = await this.prisma.marketplaceOrder.aggregate({
          where: {
            status: { in: ['COMPLETED', 'DELIVERED'] },
            createdAt: { gte: start, lte: end },
            farmer: {
              profile: {
                subCounty,
                ...jurisdictionWhere,
              },
            },
          },
          _sum: { quantity: true },
        });

        return {
          subCounty: subCounty || 'Unknown',
          volume: Math.round((volume._sum.quantity || 0) / 1000 * 100) / 100, // tons
        };
      })
    );

    // Average production per farmer
    const avgProductionPerFarmer = totalFarmers > 0
      ? productionVolumeTons / totalFarmers
      : 0;

    // Center utilization rates
    const centers = await this.prisma.aggregationCenter.findMany({
      where: jurisdictionWhere,
      select: {
        id: true,
        name: true,
        totalCapacity: true,
        currentStock: true,
      },
    });

    const centerUtilization = centers.map(center => ({
      id: center.id,
      name: center.name,
      utilizationRate: center.totalCapacity > 0
        ? (center.currentStock / center.totalCapacity) * 100
        : 0,
      currentStock: center.currentStock,
      totalCapacity: center.totalCapacity,
    }));

    // Participation rate
    const participationRate = totalFarmers > 0
      ? (activeFarmers / totalFarmers) * 100
      : 0;

    // Farmer growth (cumulative registration) - using flexible time range
    const growthMonthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    const growthNumberOfMonths = Math.max(1, Math.min(growthMonthsDiff, 24)); // Cap at 24 months
    
    const farmerGrowth: Array<{ period: string; cumulativeCount: number; newFarmers: number }> = [];
    
    for (let i = growthNumberOfMonths - 1; i >= 0; i--) {
      const periodStart = new Date(end);
      periodStart.setMonth(periodStart.getMonth() - i);
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Count farmers registered up to this period
      const farmersUpToPeriod = await this.prisma.profile.count({
        where: {
          user: { role: 'FARMER' },
          ...jurisdictionWhere,
          createdAt: { lte: periodEnd },
        },
      });

      // New farmers in this period
      const newFarmers = await this.prisma.profile.count({
        where: {
          user: { role: 'FARMER' },
          ...jurisdictionWhere,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      });

      farmerGrowth.push({
        period: periodStart.toISOString().substring(0, 7), // YYYY-MM
        cumulativeCount: farmersUpToPeriod,
        newFarmers,
      });
    }

    // Farmer activity (recent activity list) - using flexible time range
    const activityDays = Math.min(30, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const activityStart = new Date(end);
    activityStart.setDate(activityStart.getDate() - activityDays);

    const recentOrders = await this.prisma.marketplaceOrder.findMany({
      where: {
        createdAt: { gte: activityStart, lte: end },
        farmer: {
          profile: jurisdictionWhere,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20, // Last 20 activities
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        quantity: true,
        createdAt: true,
        farmer: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                subCounty: true,
              },
            },
          },
        },
      },
    });

    const recentListings = await this.prisma.produceListing.findMany({
      where: {
        createdAt: { gte: activityStart, lte: end },
        farmer: {
          profile: jurisdictionWhere,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Last 10 listings
      select: {
        id: true,
        variety: true,
        quantity: true,
        pricePerKg: true,
        status: true,
        createdAt: true,
        farmer: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                subCounty: true,
              },
            },
          },
        },
      },
    });

    const farmerActivity = [
      ...recentOrders.map(order => ({
        type: 'order' as const,
        id: order.id,
        farmerId: order.farmer.id,
        farmerName: order.farmer.profile
          ? `${order.farmer.profile.firstName} ${order.farmer.profile.lastName}`
          : 'Unknown',
        activity: `Order ${order.orderNumber} - ${order.status}`,
        value: order.totalAmount || 0,
        quantity: order.quantity || 0,
        date: order.createdAt,
      })),
      ...recentListings.map(listing => ({
        type: 'listing' as const,
        id: listing.id,
        farmerId: listing.farmer.id,
        farmerName: listing.farmer.profile
          ? `${listing.farmer.profile.firstName} ${listing.farmer.profile.lastName}`
          : 'Unknown',
        activity: `New listing - ${listing.variety} (${listing.quantity}kg)`,
        value: (listing.pricePerKg || 0) * (listing.quantity || 0),
        quantity: listing.quantity || 0,
        date: listing.createdAt,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);

    // Advisory read rates and impact metrics
    const advisories = await this.prisma.advisory.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(jurisdictionWhere.county ? { targetValue: { contains: jurisdictionWhere.county } } : {}),
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        type: true,
        views: true,
        readCount: true,
        deliveryCount: true,
        createdAt: true,
        targetValue: true,
      },
    });

    const advisoryMetrics = {
      totalAdvisories: advisories.length,
      totalViews: advisories.reduce((sum, a) => sum + (a.views || 0), 0),
      totalReads: advisories.reduce((sum, a) => sum + (a.readCount || 0), 0),
      totalDeliveries: advisories.reduce((sum, a) => sum + (a.deliveryCount || 0), 0),
      averageReadRate: advisories.length > 0
        ? advisories.reduce((sum, a) => {
            const readRate = a.deliveryCount && a.deliveryCount > 0
              ? (a.readCount || 0) / a.deliveryCount * 100
              : 0;
            return sum + readRate;
          }, 0) / advisories.length
        : 0,
      advisoriesByType: advisories.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      topAdvisories: advisories
        .map(a => ({
          id: a.id,
          title: a.title,
          type: a.type,
          views: a.views || 0,
          readCount: a.readCount || 0,
          deliveryCount: a.deliveryCount || 0,
          readRate: a.deliveryCount && a.deliveryCount > 0
            ? Math.round(((a.readCount || 0) / a.deliveryCount) * 100 * 100) / 100
            : 0,
          createdAt: a.createdAt,
        }))
        .sort((a, b) => b.readCount - a.readCount)
        .slice(0, 10),
    };

    return {
      dashboardMetrics: {
        totalFarmers,
        activeFarmers,
        totalProductionVolume: Math.round(productionVolumeTons * 100) / 100,
        aggregationCentersCount: centersCount,
        qualityScore: Math.round(qualityScore * 100) / 100,
        totalValue: totalValue._sum.totalAmount || 0,
        pendingAdvisories,
      },
      productionAnalytics: {
        monthlyProductionTrend: monthlyProduction,
        productionBySubCounty,
        averageProductionPerFarmer: Math.round(avgProductionPerFarmer * 100) / 100,
      },
      centerPerformance: {
        centerUtilization,
        topPerformingCenters: centerUtilization
          .sort((a, b) => b.utilizationRate - a.utilizationRate)
          .slice(0, 5),
      },
      farmerParticipation: {
        activeFarmers,
        totalFarmers,
        participationRate: Math.round(participationRate * 100) / 100,
      },
      farmerGrowth,
      farmerActivity,
      advisoryMetrics: {
        ...advisoryMetrics,
        averageReadRate: Math.round(advisoryMetrics.averageReadRate * 100) / 100,
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  // ============ Input Provider Analytics ============

  async getInputProviderAnalytics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const providerId = user?.id;

    if (!providerId) {
      throw new Error('Input Provider ID required');
    }

    // Get previous period for comparison
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(start);

    // Total inputs (products)
    const totalInputs = await this.prisma.input.count({
      where: { providerId },
    });

    // Active orders count
    const activeOrders = await this.prisma.inputOrder.count({
      where: {
        input: { providerId },
        status: { in: ['PENDING', 'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'IN_TRANSIT'] },
      },
    });

    // Total revenue (this month vs last month)
    const currentRevenue = await this.prisma.inputOrder.aggregate({
      where: {
        input: { providerId },
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });

    const previousRevenue = await this.prisma.inputOrder.aggregate({
      where: {
        input: { providerId },
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: previousStart, lt: previousEnd },
      },
      _sum: { totalAmount: true },
    });

    const revenueGrowthRate = previousRevenue._sum.totalAmount && previousRevenue._sum.totalAmount > 0
      ? ((currentRevenue._sum.totalAmount || 0) - previousRevenue._sum.totalAmount) / previousRevenue._sum.totalAmount * 100
      : 0;

    // Total customers (unique farmers)
    const uniqueCustomers = await this.prisma.inputOrder.findMany({
      where: {
        input: { providerId },
        createdAt: { gte: start, lte: end },
      },
      select: { farmerId: true },
      distinct: ['farmerId'],
    });

    // New customers (this month)
    const allTimeCustomers = await this.prisma.inputOrder.findMany({
      where: {
        input: { providerId },
        createdAt: { lt: start },
      },
      select: { farmerId: true },
      distinct: ['farmerId'],
    });

    const allTimeCustomerIds = new Set(allTimeCustomers.map(c => c.farmerId));
    const newCustomers = uniqueCustomers.filter(c => !allTimeCustomerIds.has(c.farmerId)).length;

    // Pending orders
    const pendingOrders = await this.prisma.inputOrder.count({
      where: {
        input: { providerId },
        status: 'PENDING',
      },
    });

    // Low stock products count
    const allInputs = await this.prisma.input.findMany({
      where: { providerId },
      select: { stock: true, minimumStock: true },
    });

    const lowStockProducts = allInputs.filter(
      input => input.minimumStock !== null && input.stock <= input.minimumStock
    ).length;

    // Sales by category
    const ordersByCategory = await this.prisma.inputOrder.findMany({
      where: {
        input: { providerId },
        createdAt: { gte: start, lte: end },
      },
      include: {
        input: {
          select: { category: true },
        },
      },
    });

    const salesByCategory = new Map<string, number>();
    ordersByCategory.forEach(order => {
      const category = order.input.category;
      salesByCategory.set(category, (salesByCategory.get(category) || 0) + order.totalAmount);
    });

    // Top selling products
    const ordersByProduct = await this.prisma.inputOrder.groupBy({
      by: ['inputId'],
      where: {
        input: { providerId },
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
      _sum: { quantity: true, totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10,
    });

    const topSellingProducts = await Promise.all(
      ordersByProduct.map(async (product) => {
        const input = await this.prisma.input.findUnique({
          where: { id: product.inputId },
          select: { name: true, category: true },
        });
        return {
          inputId: product.inputId,
          name: input?.name || 'Unknown',
          category: input?.category || 'Unknown',
          totalQuantity: product._sum.quantity || 0,
          totalRevenue: product._sum.totalAmount || 0,
          orderCount: product._count.id || 0,
        };
      })
    );

    return {
      dashboardMetrics: {
        totalInputs: totalInputs,
        activeOrders: activeOrders,
        totalRevenue: currentRevenue._sum.totalAmount || 0,
        previousRevenue: previousRevenue._sum.totalAmount || 0,
        revenueGrowthRate: Math.round(revenueGrowthRate * 100) / 100,
        totalCustomers: uniqueCustomers.length,
        newCustomers,
        pendingOrders,
        lowStockProducts,
      },
      salesAnalytics: {
        salesByCategory: Array.from(salesByCategory.entries()).map(([category, revenue]) => ({
          category,
          revenue: Math.round(revenue * 100) / 100,
        })),
        topSellingProducts,
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  // ============ Transport Provider Analytics ============

  async getTransportProviderAnalytics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const providerId = user?.id;

    if (!providerId) {
      throw new Error('Transport Provider ID required');
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Active deliveries count
    const activeDeliveries = await this.prisma.transportRequest.count({
      where: {
        providerId,
        status: { in: ['ACCEPTED', 'IN_TRANSIT_PICKUP', 'IN_TRANSIT_DELIVERY'] },
      },
    });

    // Pending requests count
    const pendingRequests = await this.prisma.transportRequest.count({
      where: {
        providerId,
        status: 'PENDING',
      },
    });

    // Completed today count
    const completedToday = await this.prisma.transportRequest.count({
      where: {
        providerId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        actualDelivery: { gte: todayStart, lte: todayEnd },
      },
    });

    // Total earnings (all-time) - from transport requests
    const allTimeRequests = await this.prisma.transportRequest.findMany({
      where: {
        providerId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        agreedCost: { not: null },
      },
      select: { agreedCost: true },
    });

    const totalEarnings = allTimeRequests.reduce((sum, r) => sum + (r.agreedCost || 0), 0);

    // Weekly earnings
    const weeklyRequests = await this.prisma.transportRequest.findMany({
      where: {
        providerId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        actualDelivery: { gte: weekStart, lte: weekEnd },
        agreedCost: { not: null },
      },
      select: { agreedCost: true },
    });

    const weeklyEarnings = weeklyRequests.reduce((sum, r) => sum + (r.agreedCost || 0), 0);

    // Average rating and total reviews
    const ratings = await this.prisma.rating.findMany({
      where: {
        ratedUserId: providerId,
        order: {
          transportRequests: {
            some: {
              providerId,
            },
          },
        },
      },
      select: { rating: true },
    });

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
      : 0;

    // Weekly earnings trend (dynamic based on time range)
    // Calculate number of weeks in the range
    const weeksDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const numberOfWeeks = Math.max(1, Math.min(weeksDiff, 52)); // Cap at 52 weeks for performance
    
    const weeklyTrends: Array<{ week: string; earnings: number }> = [];
    for (let i = numberOfWeeks - 1; i >= 0; i--) {
      const weekStartDate = new Date(end);
      weekStartDate.setDate(end.getDate() - (end.getDay() + i * 7));
      weekStartDate.setHours(0, 0, 0, 0);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 7);

      const weekRequests = await this.prisma.transportRequest.findMany({
        where: {
          providerId,
          status: { in: ['DELIVERED', 'COMPLETED'] },
          actualDelivery: { gte: weekStartDate, lte: weekEndDate },
          agreedCost: { not: null },
        },
        select: { agreedCost: true },
      });

      const weekEarnings = weekRequests.reduce((sum, r) => sum + (r.agreedCost || 0), 0);

      weeklyTrends.push({
        week: weekStartDate.toISOString().substring(0, 10),
        earnings: weekEarnings,
      });
    }

    // Delivery completion rate
    const totalRequests = await this.prisma.transportRequest.count({
      where: {
        providerId,
        createdAt: { gte: start, lte: end },
      },
    });

    const completedRequests = await this.prisma.transportRequest.count({
      where: {
        providerId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: start, lte: end },
      },
    });

    const completionRate = totalRequests > 0
      ? (completedRequests / totalRequests) * 100
      : 0;

    // On-time delivery rate (simplified - comparing scheduled vs actual)
    const requestsWithDelivery = await this.prisma.transportRequest.findMany({
      where: {
        providerId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        scheduledDelivery: { not: null },
        actualDelivery: { not: null },
        createdAt: { gte: start, lte: end },
      },
      select: {
        scheduledDelivery: true,
        actualDelivery: true,
        actualPickup: true,
      },
    });

    const onTimeDeliveries = requestsWithDelivery.filter(req => {
      if (!req.scheduledDelivery || !req.actualDelivery) return false;
      return new Date(req.actualDelivery) <= new Date(req.scheduledDelivery);
    }).length;

    const onTimeRate = requestsWithDelivery.length > 0
      ? (onTimeDeliveries / requestsWithDelivery.length) * 100
      : 0;

    // Average delivery time (in hours)
    const deliveryTimes = requestsWithDelivery
      .map(req => {
        if (!req.actualPickup || !req.actualDelivery) return null;
        return (new Date(req.actualDelivery).getTime() - new Date(req.actualPickup).getTime()) / (1000 * 60 * 60);
      })
      .filter((time): time is number => time !== null);

    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, t) => sum + t, 0) / deliveryTimes.length
      : 0;

    return {
      dashboardMetrics: {
        activeDeliveries,
        pendingRequests,
        completedToday,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        weeklyEarnings: Math.round(weeklyEarnings * 100) / 100,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: ratings.length,
      },
      trends: {
        weeklyEarningsTrend: weeklyTrends,
        deliveryCompletionRate: Math.round(completionRate * 100) / 100,
      },
      performance: {
        onTimeDeliveryRate: Math.round(onTimeRate * 100) / 100,
        averageDeliveryTime: Math.round(avgDeliveryTime * 100) / 100, // hours
        customerSatisfaction: Math.round(avgRating * 20), // Convert to percentage
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  // ============ Aggregation Manager Analytics ============

  async getAggregationManagerAnalytics(filters: AnalyticsFiltersDto, user: any) {
    const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
    const managerId = user?.id;

    if (!managerId) {
      throw new Error('Aggregation Manager ID required');
    }

    // Get manager's center(s)
    const centers = await this.prisma.aggregationCenter.findMany({
      where: { managerId },
      select: { id: true, name: true, totalCapacity: true },
    });

    if (centers.length === 0) {
      throw new Error('No aggregation centers found for this manager');
    }

    const centerIds = centers.map(c => c.id);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Current stock (kg)
    const currentStock = await this.prisma.inventoryItem.aggregate({
      where: {
        centerId: { in: centerIds },
        status: 'FRESH',
      },
      _sum: { quantity: true },
    });

    // Stock in today
    const stockInToday = await this.prisma.stockTransaction.aggregate({
      where: {
        centerId: { in: centerIds },
        type: 'STOCK_IN',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { quantity: true },
    });

    // Stock out today
    const stockOutToday = await this.prisma.stockTransaction.aggregate({
      where: {
        centerId: { in: centerIds },
        type: 'STOCK_OUT',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { quantity: true },
    });

    // Quality checks today
    const qualityChecksToday = await this.prisma.qualityCheck.count({
      where: {
        centerId: { in: centerIds },
        checkedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // Pending quality checks
    const pendingQualityChecks = await this.prisma.qualityCheck.count({
      where: {
        centerId: { in: centerIds },
        approved: false,
        status: { not: 'rejected' },
      },
    });

    // Capacity utilization
    const totalCapacity = centers.reduce((sum, c) => sum + c.totalCapacity, 0);
    const capacityUtilization = totalCapacity > 0
      ? ((currentStock._sum?.quantity || 0) / totalCapacity) * 100
      : 0;

    // Stock by variety
    const stockByVariety = await this.prisma.inventoryItem.groupBy({
      by: ['variety'],
      where: {
        centerId: { in: centerIds },
        status: 'FRESH',
      },
      _sum: { quantity: true },
    });

    // Stock movement trends (in/out)
    const stockMovements = await this.prisma.stockTransaction.findMany({
      where: {
        centerId: { in: centerIds },
        createdAt: { gte: start, lte: end },
      },
      select: {
        type: true,
        quantity: true,
        createdAt: true,
      },
    });

    // Group by date
    const movementMap = new Map<string, { stockIn: number; stockOut: number }>();
    stockMovements.forEach(movement => {
      const dateKey = movement.createdAt.toISOString().split('T')[0];
      if (!movementMap.has(dateKey)) {
        movementMap.set(dateKey, { stockIn: 0, stockOut: 0 });
      }
      const entry = movementMap.get(dateKey)!;
      if (movement.type === 'STOCK_IN') {
        entry.stockIn += movement.quantity || 0;
      } else if (movement.type === 'STOCK_OUT') {
        entry.stockOut += movement.quantity || 0;
      }
    });

    const stockMovementTrends = Array.from(movementMap.entries())
      .map(([date, data]) => ({
        date,
        stockIn: Math.round(data.stockIn * 100) / 100,
        stockOut: Math.round(data.stockOut * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Quality distribution
    const qualityDistribution = await this.prisma.qualityCheck.groupBy({
      by: ['qualityGrade'],
      where: {
        centerId: { in: centerIds },
        checkedAt: { gte: start, lte: end },
      },
      _count: { id: true },
    });

    // Active farmers count
    const activeFarmers = await this.prisma.stockTransaction.findMany({
      where: {
        centerId: { in: centerIds },
        createdAt: { gte: start, lte: end },
        farmerId: { not: null },
      },
      select: { farmerId: true },
      distinct: ['farmerId'],
    });

    // Stock turnover rate (simplified)
    const totalStockOut = await this.prisma.stockTransaction.aggregate({
      where: {
        centerId: { in: centerIds },
        type: 'STOCK_OUT',
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    });

    const avgStock = (currentStock._sum?.quantity || 0) / 2; // Average of start and end
    const stockTurnoverRate = avgStock > 0
      ? (totalStockOut._sum?.quantity || 0) / avgStock
      : 0;

    // Quality acceptance rate
    const totalQualityChecks = await this.prisma.qualityCheck.count({
      where: {
        centerId: { in: centerIds },
        checkedAt: { gte: start, lte: end },
      },
    });

    const approvedQualityChecks = await this.prisma.qualityCheck.count({
      where: {
        centerId: { in: centerIds },
        approved: true,
        checkedAt: { gte: start, lte: end },
      },
    });

    const qualityAcceptanceRate = totalQualityChecks > 0
      ? (approvedQualityChecks / totalQualityChecks) * 100
      : 0;

    return {
      dashboardMetrics: {
        currentStock: Math.round((currentStock._sum?.quantity || 0) * 100) / 100,
        stockInToday: Math.round((stockInToday._sum?.quantity || 0) * 100) / 100,
        stockOutToday: Math.round((stockOutToday._sum?.quantity || 0) * 100) / 100,
        qualityChecksToday,
        pendingQualityChecks,
        capacityUtilization: Math.round(capacityUtilization * 100) / 100,
        maxCapacity: totalCapacity,
      },
      stockAnalytics: {
        stockByVariety: stockByVariety.map(s => ({
          variety: s.variety,
          quantity: Math.round((s._sum?.quantity || 0) * 100) / 100,
        })),
        stockMovementTrends,
        qualityDistribution: qualityDistribution.map(q => ({
          grade: q.qualityGrade,
          count: q._count.id,
        })),
      },
      performance: {
        activeFarmers: activeFarmers.length,
        stockTurnoverRate: Math.round(stockTurnoverRate * 100) / 100,
        qualityAcceptanceRate: Math.round(qualityAcceptanceRate * 100) / 100,
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  /**
   * Refresh analytics materialized views
   * Should be called periodically (daily) or on-demand
   * Uses the refresh_analytics_views() function created in migration
   */
  async refreshAnalyticsViews() {
    try {
      await this.prisma.$executeRawUnsafe('SELECT refresh_analytics_views()');
      return { 
        success: true, 
        message: 'Analytics materialized views refreshed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error refreshing analytics views:', error);
      throw error;
    }
  }

  /**
   * Get data from daily_order_summary materialized view
   * Optimized query for daily trends
   */
  async getDailyOrderSummary(startDate?: Date, endDate?: Date) {
    const where: any = {};
    
    if (startDate && endDate) {
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    const orderBy = startDate && endDate 
      ? { date: 'asc' as const }
      : { date: 'desc' as const };

    const take = startDate && endDate ? undefined : 30;

    return this.prisma.dailyOrderSummary.findMany({
      where,
      orderBy,
      take,
    });
  }

  /**
   * Get data from monthly_farmer_statistics materialized view
   * Optimized query for farmer leaderboards
   */
  async getMonthlyFarmerStatistics(month?: Date, subCounty?: string) {
    const where: any = {};

    if (month) {
      where.month = month;
    }

    if (subCounty) {
      where.subCounty = subCounty;
    }

    return this.prisma.monthlyFarmerStatistics.findMany({
      where,
      orderBy: { revenue: 'desc' },
      take: 100,
    });
  }

  /**
   * Get data from center_utilization_summary materialized view
   * Optimized query for center analytics
   */
  async getCenterUtilizationSummary(county?: string) {
    const where: any = {};

    if (county) {
      where.county = county;
    }

    return this.prisma.centerUtilizationSummary.findMany({
      where,
      orderBy: { utilizationRate: 'desc' },
    });
  }

  /**
   * Get data from weekly_buyer_sourcing materialized view
   * Optimized query for buyer sourcing analytics
   */
  async getWeeklyBuyerSourcing(week?: Date, buyerId?: string) {
    const where: any = {};

    if (week) {
      where.week = week;
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    return this.prisma.weeklyBuyerSourcing.findMany({
      where,
      orderBy: { procurementValue: 'desc' },
    });
  }

  // ============ Optimization Views ============

  /**
   * Get platform metrics summary from materialized view
   * Useful for fast dashboard queries
   */
  async getPlatformMetricsSummary(startDate?: Date, endDate?: Date) {
    const where: any = {};
    
    if (startDate && endDate) {
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    return this.prisma.platformMetricsSummary.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get farmer leaderboard from pre-computed materialized view
   * Much faster than computing rankings on-the-fly
   */
  async getFarmerLeaderboardFromView(month?: Date, subcounty?: string, county?: string, limit?: number) {
    const where: any = {};

    if (month) {
      // Find the start of the month
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      where.month = monthStart;
    }

    if (subcounty) {
      where.subCounty = subcounty;
    }

    if (county) {
      where.county = county;
    }

    return this.prisma.farmerLeaderboardMonthly.findMany({
      where,
      orderBy: { revenue: 'desc' },
      take: limit || 50,
    });
  }

  /**
   * Get market price summary from materialized view
   * Pre-computed weekly averages by variety, grade, and location
   */
  async getMarketPriceSummary(variety?: string, grade?: string, location?: string, weeks?: number) {
    const where: any = {};

    if (variety) {
      where.variety = variety;
    }

    if (grade) {
      where.grade = grade;
    }

    if (location) {
      where.location = location;
    }

    // Default to last 12 weeks
    const weeksToFetch = weeks || 12;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksToFetch * 7));
    where.week = { gte: startDate };

    return this.prisma.marketPriceSummary.findMany({
      where,
      orderBy: { week: 'desc' },
    });
  }

  /**
   * Get buyer demand summary from materialized view
   * Pre-computed demand aggregations from RFQs and Sourcing Requests
   */
  async getBuyerDemandSummary(variety?: string, location?: string, weeks?: number) {
    const where: any = {};

    if (variety) {
      where.variety = variety;
    }

    if (location) {
      where.location = location;
    }

    // Default to last 8 weeks
    const weeksToFetch = weeks || 8;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksToFetch * 7));
    where.week = { gte: startDate };

    return this.prisma.buyerDemandSummary.findMany({
      where,
      orderBy: [{ totalQuantityNeeded: 'desc' }, { totalBuyerCount: 'desc' }],
    });
  }

  /**
   * Get user growth summary from materialized view
   * Monthly user registration stats by role and location
   */
  async getUserGrowthSummary(role?: string, county?: string, months?: number) {
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (county) {
      where.county = county;
    }

    // Default to last 12 months
    const monthsToFetch = months || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsToFetch);
    startDate.setDate(1);
    where.month = { gte: startDate };

    return this.prisma.userGrowthSummary.findMany({
      where,
      orderBy: { month: 'desc' },
    });
  }

  /**
   * Get fast dashboard stats using materialized views
   * Optimized version that queries pre-computed summaries
   */
  async getFastDashboardStats(startDate: Date, endDate: Date) {
    // Query platform metrics summary for the date range
    const dailyStats = await this.prisma.platformMetricsSummary.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Aggregate the pre-computed daily stats
    const totalRevenue = dailyStats.reduce((sum, d) => sum + (d.revenue || 0), 0);
    const totalOrders = dailyStats.reduce((sum, d) => sum + d.totalOrders, 0);
    const completedOrders = dailyStats.reduce((sum, d) => sum + d.completedOrders, 0);
    const activeFarmers = new Set(dailyStats.flatMap(d => d.activeFarmers)).size || 
      dailyStats.reduce((max, d) => Math.max(max, d.activeFarmers), 0);
    const activeBuyers = new Set(dailyStats.flatMap(d => d.activeBuyers)).size ||
      dailyStats.reduce((max, d) => Math.max(max, d.activeBuyers), 0);
    const totalPlatformFee = dailyStats.reduce((sum, d) => sum + (d.platformFee || 0), 0);
    
    // Calculate averages
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgPrice = dailyStats.length > 0
      ? dailyStats.reduce((sum, d) => sum + (d.averagePrice || 0), 0) / dailyStats.length
      : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      completedOrders,
      activeFarmers,
      activeBuyers,
      averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      averagePrice: Math.round(avgPrice * 100) / 100,
      totalPlatformFee: Math.round(totalPlatformFee * 100) / 100,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      dataPoints: dailyStats.length,
    };
  }
}
