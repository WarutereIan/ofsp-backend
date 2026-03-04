import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AnalyticsFiltersDto, LeaderboardFiltersDto, TimeRange, TimePeriod, EntityType, GenerateReportDto, CreateAdvisoryDto } from './dto';
import { LeaderboardMetric, LeaderboardPeriod } from './dto/leaderboard-filters.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ============ Dashboard Statistics ============

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  @ApiQuery({ name: 'entityId', type: String, required: false })
  @ApiQuery({ name: 'entityType', enum: EntityType, required: false })
  async getDashboardStats(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getDashboardStats(filters, user);
  }

  // ============ Trends ============

  @Get('trends')
  @ApiOperation({ summary: 'Get trend data for charts' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  @ApiQuery({ name: 'entityId', type: String, required: false })
  @ApiQuery({ name: 'entityType', enum: EntityType, required: false })
  @ApiQuery({ name: 'period', enum: TimePeriod, required: false })
  async getTrends(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getTrends(filters, user);
  }

  // ============ Performance Metrics ============

  @Get('performance-metrics')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  @ApiQuery({ name: 'entityId', type: String, required: false })
  @ApiQuery({ name: 'entityType', enum: EntityType, required: false })
  async getPerformanceMetrics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getPerformanceMetrics(filters, user);
  }

  // ============ Leaderboards ============

  @Get('leaderboards/:metric/:period')
  @ApiOperation({ summary: 'Get leaderboard by metric and period' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'subcounty', type: String, required: false })
  @ApiQuery({ name: 'county', type: String, required: false })
  @ApiQuery({ name: 'userId', type: String, required: false })
  async getLeaderboard(
    @Param('metric') metric: LeaderboardMetric,
    @Param('period') period: LeaderboardPeriod,
    @Query() filters: LeaderboardFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getLeaderboard(metric, period, filters, user);
  }

  // ============ Market Info ============

  @Get('market-info')
  @ApiOperation({ summary: 'Get market information (prices, trends, buyer demand)' })
  @ApiQuery({ name: 'location', type: String, required: false })
  @ApiQuery({ name: 'variety', type: String, required: false })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getMarketInfo(
    @Query('location') location?: string,
    @Query('variety') variety?: string,
    @Query() filters?: AnalyticsFiltersDto,
  ) {
    return this.analyticsService.getMarketInfo({
      location,
      variety,
      timeRange: filters?.timeRange,
      dateRange: filters?.dateRange,
    });
  }

  // ============ Role-Specific Analytics ============

  @Get('farmer')
  @ApiOperation({ summary: 'Get farmer-specific analytics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getFarmerAnalytics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getFarmerAnalytics(filters, user);
  }

  @Get('buyer')
  @ApiOperation({ summary: 'Get buyer-specific analytics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getBuyerAnalytics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getBuyerAnalytics(filters, user);
  }

  @Get('staff')
  @ApiOperation({ summary: 'Get staff-specific analytics (M&E Dashboard)' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getStaffAnalytics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getStaffAnalytics(filters, user);
  }

  @Get('county-officer')
  @ApiOperation({ summary: 'Get county officer-specific analytics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getCountyOfficerAnalytics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getCountyOfficerAnalytics(filters, user);
  }

  @Get('input-provider')
  @ApiOperation({ summary: 'Get input provider-specific analytics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getInputProviderAnalytics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getInputProviderAnalytics(filters, user);
  }

  @Get('transport-provider')
  @ApiOperation({ summary: 'Get transport provider-specific analytics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getTransportProviderAnalytics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getTransportProviderAnalytics(filters, user);
  }

  @Get('aggregation-manager')
  @ApiOperation({ summary: 'Get aggregation manager-specific analytics' })
  @ApiQuery({ name: 'timeRange', enum: TimeRange, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getAggregationManagerAnalytics(
    @Query() filters: AnalyticsFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getAggregationManagerAnalytics(filters, user);
  }

  // ============ Materialized Views Management ============

  @Get('refresh-views')
  @ApiOperation({ summary: 'Refresh analytics materialized views (admin/staff only)' })
  async refreshViews(@CurrentUser() user: any) {
    // Only allow admin/staff to refresh views
    if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
      throw new Error('Unauthorized: Only admin and staff can refresh views');
    }
    return this.analyticsService.refreshAnalyticsViews();
  }

  // ============ Reports (staff/admin only) ============

  @Get('reports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List saved/generated reports (staff/admin only)' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'templateId', type: String, required: false })
  async listReports(
    @Query('limit') limit?: string,
    @Query('templateId') templateId?: string,
  ) {
    const opts: { limit?: number; templateId?: string } = {};
    if (limit != null) opts.limit = parseInt(limit, 10);
    if (templateId) opts.templateId = templateId;
    return this.analyticsService.listSavedReports(opts);
  }

  @Get('reports/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get saved report by id (full payload) (staff/admin only)' })
  async getReportById(@Param('id') id: string) {
    return this.analyticsService.getSavedReportById(id);
  }

  @Get('report-templates')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get available report templates (staff/admin only)' })
  getReportTemplates() {
    return this.analyticsService.getReportTemplates();
  }

  @Post('reports/generate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Generate report from template (staff/admin only)' })
  async generateReport(
    @Body() dto: GenerateReportDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.generateReport(dto.templateId, dto.parameters || {}, user);
  }

  // ============ Advisories ============

  @Get('advisories')
  @ApiOperation({ summary: 'List advisories' })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getAdvisories(
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: { isActive?: boolean; limit?: number } = {};
    if (isActive !== undefined && isActive !== '') filters.isActive = isActive === 'true';
    if (limit !== undefined && limit !== '') filters.limit = parseInt(limit, 10);
    return this.analyticsService.getAdvisories(filters);
  }

  @Get('advisories/:id')
  @ApiOperation({ summary: 'Get advisory by id' })
  async getAdvisoryById(@Param('id') id: string) {
    return this.analyticsService.getAdvisoryById(id);
  }

  @Post('advisories')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.EXTENSION_OFFICER)
  @ApiOperation({ summary: 'Create and send advisory to farmers (SMS + web-push)' })
  async createAdvisory(
    @Body() dto: CreateAdvisoryDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.createAndSendAdvisory(dto, user.userId ?? user.id);
  }
}
