import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AggregationService } from './aggregation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateAggregationCenterDto,
  UpdateAggregationCenterDto,
  CreateStockTransactionDto,
  CreateQualityCheckDto,
  CreateWastageEntryDto,
} from './dto';

@ApiTags('Aggregation')
@Controller('aggregation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AggregationController {
  constructor(private readonly aggregationService: AggregationService) {}

  // ============ Aggregation Centers ============

  @Get('centers')
  @ApiOperation({ summary: 'Get all aggregation centers' })
  async getAggregationCenters(
    @Query('centerType') centerType?: string,
    @Query('status') status?: string,
    @Query('county') county?: string,
  ) {
    return this.aggregationService.getAggregationCenters({
      centerType,
      status,
      county,
    });
  }

  @Get('centers/:id')
  @ApiOperation({ summary: 'Get aggregation center by ID' })
  async getAggregationCenterById(@Param('id') id: string) {
    return this.aggregationService.getAggregationCenterById(id);
  }

  @Post('centers')
  @ApiOperation({ summary: 'Create aggregation center' })
  async createAggregationCenter(@Body() data: CreateAggregationCenterDto) {
    return this.aggregationService.createAggregationCenter(data);
  }

  @Put('centers/:id')
  @ApiOperation({ summary: 'Update aggregation center' })
  async updateAggregationCenter(
    @Param('id') id: string,
    @Body() data: UpdateAggregationCenterDto,
  ) {
    return this.aggregationService.updateAggregationCenter(id, data);
  }

  // ============ Stock Transactions ============

  @Get('stock-transactions')
  @ApiOperation({ summary: 'Get stock transactions' })
  async getStockTransactions(
    @Query('centerId') centerId?: string,
    @Query('type') type?: string,
    @Query('variety') variety?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.aggregationService.getStockTransactions({
      centerId,
      type,
      variety,
      dateFrom,
      dateTo,
    });
  }

  @Post('stock-in')
  @ApiOperation({ summary: 'Create stock in transaction' })
  async createStockIn(
    @Body() data: CreateStockTransactionDto,
    @Request() req: any,
  ) {
    return this.aggregationService.createStockIn(data, req.user.userId);
  }

  @Post('stock-out')
  @ApiOperation({ summary: 'Create stock out transaction' })
  async createStockOut(
    @Body() data: CreateStockTransactionDto,
    @Request() req: any,
  ) {
    return this.aggregationService.createStockOut(data, req.user.userId);
  }

  // ============ Inventory ============

  @Get('inventory')
  @ApiOperation({ summary: 'Get inventory items' })
  async getInventory(@Query('centerId') centerId?: string) {
    return this.aggregationService.getInventory(centerId);
  }

  // ============ Quality Checks ============

  @Get('quality-checks')
  @ApiOperation({ summary: 'Get quality checks' })
  async getQualityChecks(
    @Query('centerId') centerId?: string,
    @Query('orderId') orderId?: string,
    @Query('transactionId') transactionId?: string,
  ) {
    return this.aggregationService.getQualityChecks({
      centerId,
      orderId,
      transactionId,
    });
  }

  @Post('quality-checks')
  @ApiOperation({ summary: 'Create quality check' })
  async createQualityCheck(
    @Body() data: CreateQualityCheckDto,
    @Request() req: any,
  ) {
    return this.aggregationService.createQualityCheck(data, req.user.userId);
  }

  // ============ Wastage ============

  @Get('wastage')
  @ApiOperation({ summary: 'Get wastage entries' })
  async getWastageEntries(
    @Query('centerId') centerId?: string,
    @Query('category') category?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.aggregationService.getWastageEntries({
      centerId,
      category,
      dateFrom,
      dateTo,
    });
  }

  @Post('wastage')
  @ApiOperation({ summary: 'Create wastage entry' })
  async createWastageEntry(
    @Body() data: CreateWastageEntryDto,
    @Request() req: any,
  ) {
    return this.aggregationService.createWastageEntry(data, req.user.userId);
  }

  // ============ Statistics ============

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregation statistics' })
  async getAggregationStats() {
    return this.aggregationService.getAggregationStats();
  }
}
