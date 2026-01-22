import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsCacheService } from './analytics-cache.service';

/**
 * Analytics Scheduler
 * 
 * Handles scheduled and event-triggered refresh of materialized views
 * and cache invalidation.
 * 
 * Schedule Strategy:
 * - Hourly refresh during business hours (6 AM - 10 PM)
 * - Full refresh at midnight
 * - Event-triggered partial refresh on order completion
 */
@Injectable()
export class AnalyticsScheduler {
  private readonly logger = new Logger(AnalyticsScheduler.name);
  private isRefreshing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AnalyticsCacheService,
  ) {}

  /**
   * Refresh all analytics views every hour during business hours (6 AM - 10 PM)
   * Cron: At minute 0 of every hour from 6 through 22
   */
  @Cron('0 * 6-22 * * *')
  async refreshViewsHourly(): Promise<void> {
    this.logger.log('Starting hourly analytics views refresh');
    await this.refreshAllViews();
  }

  /**
   * Full refresh at midnight - ensures fresh data for the new day
   * Also cleans up the cache completely
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshViewsAtMidnight(): Promise<void> {
    this.logger.log('Starting midnight full analytics refresh');
    
    // Clear all cached analytics data
    this.cacheService.clear();
    
    // Refresh all views
    await this.refreshAllViews();
    
    this.logger.log('Midnight full refresh completed');
  }

  /**
   * Refresh daily order summary every 15 minutes during peak hours (8 AM - 6 PM)
   * This view is frequently accessed for dashboards
   */
  @Cron('*/15 8-18 * * *')
  async refreshDailyOrderSummary(): Promise<void> {
    await this.refreshView('daily_order_summary', 'Daily Order Summary');
  }

  /**
   * Event handler: Refresh relevant views when an order is completed
   * This ensures leaderboards and stats reflect completed transactions quickly
   */
  @OnEvent('order.completed')
  async onOrderCompleted(payload: { orderId: string; farmerId: string; buyerId: string }): Promise<void> {
    this.logger.log(`Order completed event received: ${payload.orderId}`);
    
    try {
      // Refresh the daily order summary (most impacted by completed orders)
      await this.refreshView('daily_order_summary', 'Daily Order Summary');
      
      // Invalidate related cache entries
      this.cacheService.invalidatePattern('dashboard:');
      this.cacheService.invalidatePattern(`farmer:${payload.farmerId}`);
      this.cacheService.invalidatePattern(`buyer:${payload.buyerId}`);
      this.cacheService.invalidatePattern('leaderboard:');
      
      this.logger.log('Order completion event processing completed');
    } catch (error) {
      this.logger.error('Error processing order completed event', error);
    }
  }

  /**
   * Event handler: Refresh market price view when listing is created/updated
   */
  @OnEvent('listing.created')
  @OnEvent('listing.updated')
  async onListingChanged(payload: { listingId: string; variety?: string }): Promise<void> {
    this.logger.debug(`Listing changed event: ${payload.listingId}`);
    
    // Invalidate market price cache
    this.cacheService.invalidatePattern('marketPrices:');
    this.cacheService.invalidatePattern('marketInfo:');
  }

  /**
   * Event handler: Refresh user growth view when new user registers
   */
  @OnEvent('user.registered')
  async onUserRegistered(payload: { userId: string; role: string }): Promise<void> {
    this.logger.debug(`New user registered: ${payload.userId}, role: ${payload.role}`);
    
    // Invalidate dashboard cache (user counts)
    this.cacheService.invalidatePattern('dashboard:');
  }

  /**
   * Refresh all analytics materialized views
   */
  async refreshAllViews(): Promise<{ success: boolean; duration: number; errors: string[] }> {
    if (this.isRefreshing) {
      this.logger.warn('View refresh already in progress, skipping');
      return { success: false, duration: 0, errors: ['Refresh already in progress'] };
    }

    this.isRefreshing = true;
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Execute the refresh function which handles all views
      await this.prisma.$executeRawUnsafe('SELECT refresh_analytics_views()');
      
      // Clear all analytics cache after view refresh
      this.cacheService.invalidatePattern('dashboard:');
      this.cacheService.invalidatePattern('leaderboard:');
      this.cacheService.invalidatePattern('marketPrices:');
      this.cacheService.invalidatePattern('trends:');
      this.cacheService.invalidatePattern('farmer:');
      this.cacheService.invalidatePattern('buyer:');
      this.cacheService.invalidatePattern('staff:');
      
      const duration = Date.now() - startTime;
      this.logger.log(`All analytics views refreshed successfully in ${duration}ms`);
      
      return { success: true, duration, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error refreshing analytics views', error);
      errors.push(errorMessage);
      
      return { success: false, duration: Date.now() - startTime, errors };
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Refresh a specific materialized view
   */
  async refreshView(viewName: string, displayName?: string): Promise<boolean> {
    const name = displayName || viewName;
    
    try {
      this.logger.debug(`Refreshing view: ${name}`);
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${viewName}"`);
      this.logger.debug(`View ${name} refreshed successfully`);
      return true;
    } catch (error) {
      // If CONCURRENTLY fails (no unique index), try without it
      try {
        this.logger.debug(`Retrying refresh without CONCURRENTLY for ${name}`);
        await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW "${viewName}"`);
        this.logger.debug(`View ${name} refreshed successfully (non-concurrent)`);
        return true;
      } catch (retryError) {
        this.logger.error(`Error refreshing view ${name}`, retryError);
        return false;
      }
    }
  }

  /**
   * Get the current refresh status
   */
  isRefreshInProgress(): boolean {
    return this.isRefreshing;
  }

  /**
   * Manual trigger for view refresh (for admin API)
   */
  async triggerManualRefresh(): Promise<{ success: boolean; duration: number; errors: string[] }> {
    this.logger.log('Manual analytics refresh triggered');
    return this.refreshAllViews();
  }

  /**
   * Refresh specific view set based on data type
   */
  async refreshViewSet(type: 'orders' | 'users' | 'inventory' | 'all'): Promise<boolean[]> {
    const results: boolean[] = [];

    switch (type) {
      case 'orders':
        results.push(await this.refreshView('daily_order_summary'));
        results.push(await this.refreshView('weekly_buyer_sourcing'));
        results.push(await this.refreshView('monthly_farmer_statistics'));
        results.push(await this.refreshView('platform_metrics_summary'));
        results.push(await this.refreshView('farmer_leaderboard_monthly'));
        break;
      
      case 'users':
        results.push(await this.refreshView('user_growth_summary'));
        results.push(await this.refreshView('monthly_farmer_statistics'));
        break;
      
      case 'inventory':
        results.push(await this.refreshView('center_utilization_summary'));
        break;
      
      case 'all':
      default:
        await this.refreshAllViews();
        results.push(true);
        break;
    }

    return results;
  }
}
