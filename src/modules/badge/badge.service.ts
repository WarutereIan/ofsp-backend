import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum BadgeType {
  FIRST_SALE = 'first_sale',
  HUNDRED_KG = 'hundred_kg',
  FIVE_HUNDRED_KG = 'five_hundred_kg',
  THOUSAND_KG = 'thousand_kg',
  FIVE_STAR = 'five_star',
  FAST_RESPONDER = 'fast_responder',
  TOP_PERFORMER_MONTHLY = 'top_performer_monthly',
  TOP_PERFORMER_QUARTERLY = 'top_performer_quarterly',
  CONSISTENT_SELLER = 'consistent_seller',
  QUALITY_CHAMPION = 'quality_champion',
}

export interface BadgeMilestone {
  type: BadgeType;
  name: string;
  description: string;
  category: string;
  targetValue?: number;
  icon?: string;
  color?: string;
  bgColor?: string;
}

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  // Badge definitions
  private readonly badgeDefinitions: BadgeMilestone[] = [
    {
      type: BadgeType.FIRST_SALE,
      name: 'First Sale',
      description: 'Made your first sale',
      category: 'sales',
      icon: 'star',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      type: BadgeType.HUNDRED_KG,
      name: '100kg Milestone',
      description: 'Sold 100kg of OFSP',
      category: 'sales',
      targetValue: 100,
      icon: 'package',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      type: BadgeType.FIVE_HUNDRED_KG,
      name: '500kg Milestone',
      description: 'Sold 500kg of OFSP',
      category: 'sales',
      targetValue: 500,
      icon: 'trending-up',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      type: BadgeType.THOUSAND_KG,
      name: '1000kg Milestone',
      description: 'Sold 1000kg of OFSP',
      category: 'sales',
      targetValue: 1000,
      icon: 'trophy',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      type: BadgeType.FIVE_STAR,
      name: '5-Star Rating',
      description: 'Achieved 5-star average rating',
      category: 'quality',
      targetValue: 5,
      icon: 'star',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      type: BadgeType.FAST_RESPONDER,
      name: 'Fast Responder',
      description: 'Average response time under 15 minutes',
      category: 'performance',
      targetValue: 15, // minutes
      icon: 'clock',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
    },
    {
      type: BadgeType.TOP_PERFORMER_MONTHLY,
      name: 'Top Performer (Monthly)',
      description: 'Top seller in your sub-county this month',
      category: 'performance',
      icon: 'award',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      type: BadgeType.TOP_PERFORMER_QUARTERLY,
      name: 'Top Performer (Quarterly)',
      description: 'Top seller in your sub-county this quarter',
      category: 'performance',
      icon: 'trophy',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      type: BadgeType.CONSISTENT_SELLER,
      name: 'Consistent Seller',
      description: 'Active seller for 3 consecutive months',
      category: 'performance',
      targetValue: 3, // months
      icon: 'trending-up',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      type: BadgeType.QUALITY_CHAMPION,
      name: 'Quality Champion',
      description: '90%+ of orders rated Grade A',
      category: 'quality',
      targetValue: 90, // percentage
      icon: 'award',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
  ];

  constructor(private prisma: PrismaService) {
    this.initializeBadges();
  }

  /**
   * Initialize badge definitions in database
   */
  private async initializeBadges() {
    try {
      for (const badgeDef of this.badgeDefinitions) {
        await this.prisma.badge.upsert({
          where: { type: badgeDef.type },
          update: {
            name: badgeDef.name,
            description: badgeDef.description,
            category: badgeDef.category,
            targetValue: badgeDef.targetValue,
            icon: badgeDef.icon,
            color: badgeDef.color,
            bgColor: badgeDef.bgColor,
          },
          create: {
            type: badgeDef.type,
            name: badgeDef.name,
            description: badgeDef.description,
            category: badgeDef.category,
            targetValue: badgeDef.targetValue,
            icon: badgeDef.icon,
            color: badgeDef.color,
            bgColor: badgeDef.bgColor,
          },
        });
      }
      this.logger.log('Badge definitions initialized');
    } catch (error) {
      this.logger.error('Failed to initialize badges', error);
    }
  }

  /**
   * Get all badges with progress for a user
   */
  async getUserBadges(userId: string) {
    const badges = await this.prisma.badge.findMany({
      where: { isActive: true },
      include: {
        progress: {
          where: { userId },
        },
      },
      orderBy: { category: 'asc' },
    });

    return badges.map(badge => {
      const progress = badge.progress[0];
      const progressPercent = badge.targetValue && badge.targetValue > 0
        ? Math.min(100, (progress?.currentValue || 0) / badge.targetValue * 100)
        : progress?.isEarned ? 100 : 0;

      return {
        id: badge.id,
        type: badge.type,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon,
        color: badge.color,
        bgColor: badge.bgColor,
        earned: progress?.isEarned || false,
        earnedDate: progress?.earnedAt?.toISOString(),
        progress: progressPercent,
        current: progress?.currentValue || 0,
        target: badge.targetValue || undefined,
      };
    });
  }

  /**
   * Check and update badges for a farmer after order completion
   */
  async checkBadgesOnOrderCompletion(farmerId: string, orderId: string) {
    try {
      // Get order details
      const order = await this.prisma.marketplaceOrder.findUnique({
        where: { id: orderId },
        include: {
          qualityCheck: {
            select: { qualityGrade: true },
          },
        },
      });

      if (!order || order.status !== 'COMPLETED' && order.status !== 'DELIVERED') {
        return;
      }

      // Check sales volume badges
      await this.checkSalesVolumeBadges(farmerId);

      // Check first sale badge
      await this.checkFirstSaleBadge(farmerId);

      // Check quality badges
      await this.checkQualityBadges(farmerId);

      // Check performance badges (async, can be done periodically)
      // This could be done via a scheduled job instead
      await this.checkPerformanceBadges(farmerId);

      this.logger.log(`Badge check completed for farmer ${farmerId} after order ${orderId}`);
    } catch (error) {
      this.logger.error(`Error checking badges for farmer ${farmerId}`, error);
    }
  }

  /**
   * Check sales volume badges (100kg, 500kg, 1000kg)
   */
  private async checkSalesVolumeBadges(farmerId: string) {
    const totalQuantity = await this.prisma.marketplaceOrder.aggregate({
      where: {
        farmerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
      _sum: { quantity: true },
    });

    const totalKg = totalQuantity._sum.quantity || 0;

    // Check 100kg badge
    await this.updateBadgeProgress(farmerId, BadgeType.HUNDRED_KG, totalKg);

    // Check 500kg badge
    await this.updateBadgeProgress(farmerId, BadgeType.FIVE_HUNDRED_KG, totalKg);

    // Check 1000kg badge
    await this.updateBadgeProgress(farmerId, BadgeType.THOUSAND_KG, totalKg);
  }

  /**
   * Check first sale badge
   */
  private async checkFirstSaleBadge(farmerId: string) {
    const completedOrders = await this.prisma.marketplaceOrder.count({
      where: {
        farmerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
    });

    if (completedOrders >= 1) {
      await this.updateBadgeProgress(farmerId, BadgeType.FIRST_SALE, 1);
    }
  }

  /**
   * Check quality badges (5-star rating, quality champion)
   */
  private async checkQualityBadges(farmerId: string) {
    // Check 5-star rating badge
    const ratings = await this.prisma.rating.findMany({
      where: { ratedUserId: farmerId },
      select: { rating: true },
    });

    if (ratings.length > 0) {
      const avgRating = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;
      await this.updateBadgeProgress(farmerId, BadgeType.FIVE_STAR, avgRating);
    }

    // Check quality champion badge (90%+ Grade A)
    const ordersWithQuality = await this.prisma.marketplaceOrder.findMany({
      where: {
        farmerId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        qualityCheck: { isNot: null },
      },
      include: {
        qualityCheck: {
          select: { qualityGrade: true },
        },
      },
    });

    if (ordersWithQuality.length > 0) {
      const gradeAOrders = ordersWithQuality.filter(o => o.qualityCheck?.qualityGrade === 'A').length;
      const gradeAPercentage = (gradeAOrders / ordersWithQuality.length) * 100;
      await this.updateBadgeProgress(farmerId, BadgeType.QUALITY_CHAMPION, gradeAPercentage);
    }
  }

  /**
   * Check performance badges (top performer, consistent seller)
   * Note: These are more complex and might be better as scheduled jobs
   */
  private async checkPerformanceBadges(farmerId: string) {
    // Check consistent seller (3 consecutive months)
    await this.checkConsistentSellerBadge(farmerId);

    // Top performer badges are better checked via scheduled jobs or analytics service
    // as they require comparing with peers
  }

  /**
   * Check consistent seller badge (3 consecutive months with sales)
   */
  private async checkConsistentSellerBadge(farmerId: string) {
    const now = new Date();
    let consecutiveMonths = 0;

    for (let i = 0; i < 3; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const ordersInMonth = await this.prisma.marketplaceOrder.count({
        where: {
          farmerId,
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      });

      if (ordersInMonth > 0) {
        consecutiveMonths++;
      } else {
        break; // Not consecutive
      }
    }

    await this.updateBadgeProgress(farmerId, BadgeType.CONSISTENT_SELLER, consecutiveMonths);
  }

  /**
   * Update badge progress and award badge if milestone reached
   */
  private async updateBadgeProgress(
    userId: string,
    badgeType: BadgeType,
    currentValue: number,
  ) {
    const badge = await this.prisma.badge.findUnique({
      where: { type: badgeType },
    });

    if (!badge) {
      return;
    }

    const progress = await this.prisma.badgeProgress.upsert({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
      update: {
        currentValue: Math.max(currentValue, 0), // Ensure non-negative
      },
      create: {
        userId,
        badgeId: badge.id,
        currentValue: Math.max(currentValue, 0),
      },
    });

    // Check if badge should be awarded
    const shouldAward = badge.targetValue
      ? currentValue >= badge.targetValue
      : currentValue >= 1; // For badges without target (like first_sale)

    if (shouldAward && !progress.isEarned) {
      await this.prisma.badgeProgress.update({
        where: { id: progress.id },
        data: {
          isEarned: true,
          earnedAt: new Date(),
        },
      });

      this.logger.log(`Badge ${badgeType} awarded to user ${userId}`);
    }
  }

  /**
   * Award top performer badges (called from analytics service or scheduled job)
   */
  async awardTopPerformerBadges(farmerId: string, period: 'monthly' | 'quarterly') {
    const badgeType = period === 'monthly'
      ? BadgeType.TOP_PERFORMER_MONTHLY
      : BadgeType.TOP_PERFORMER_QUARTERLY;

    await this.updateBadgeProgress(farmerId, badgeType, 1);
  }
}
