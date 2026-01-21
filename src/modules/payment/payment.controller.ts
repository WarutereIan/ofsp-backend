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
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreatePaymentDto,
  UpdatePaymentStatusDto,
  ReleaseEscrowDto,
  DisputeEscrowDto,
} from './dto';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ============ Payments ============

  @Get()
  @ApiOperation({ summary: 'Get all payments' })
  async getPayments(
    @Query('payerId') payerId?: string,
    @Query('payeeId') payeeId?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('orderType') orderType?: string,
    @Query('orderId') orderId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.paymentService.getPayments({
      payerId,
      payeeId,
      status,
      method,
      orderType,
      orderId,
      dateFrom,
      dateTo,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  async getPaymentById(@Param('id') id: string) {
    return this.paymentService.getPaymentById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create payment' })
  async createPayment(@Body() data: CreatePaymentDto) {
    return this.paymentService.createPayment(data);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update payment status' })
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() data: UpdatePaymentStatusDto,
  ) {
    return this.paymentService.updatePaymentStatus(id, data);
  }

  // ============ Escrow Transactions ============

  @Get('escrow')
  @ApiOperation({ summary: 'Get all escrow transactions' })
  async getEscrowTransactions(
    @Query('buyerId') buyerId?: string,
    @Query('farmerId') farmerId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
  ) {
    return this.paymentService.getEscrowTransactions({
      buyerId,
      farmerId,
      orderId,
      status,
    });
  }

  @Get('escrow/:id')
  @ApiOperation({ summary: 'Get escrow transaction by ID' })
  async getEscrowTransactionById(@Param('id') id: string) {
    return this.paymentService.getEscrowTransactionById(id);
  }

  @Put('escrow/:id/release')
  @ApiOperation({ summary: 'Release escrow payment' })
  async releaseEscrow(
    @Param('id') id: string,
    @Body() data: ReleaseEscrowDto,
    @Request() req: any,
  ) {
    return this.paymentService.releaseEscrow(id, data, req.user.userId);
  }

  @Put('escrow/:id/dispute')
  @ApiOperation({ summary: 'Dispute escrow payment' })
  async disputeEscrow(
    @Param('id') id: string,
    @Body() data: DisputeEscrowDto,
    @Request() req: any,
  ) {
    return this.paymentService.disputeEscrow(id, data, req.user.userId);
  }

  // ============ Payment History ============

  @Get('history')
  @ApiOperation({ summary: 'Get payment history' })
  async getPaymentHistory(
    @Query('userId') userId?: string,
    @Query('orderId') orderId?: string,
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.paymentService.getPaymentHistory({
      userId,
      orderId,
      type,
      dateFrom,
      dateTo,
    });
  }

  // ============ Statistics ============

  @Get('stats')
  @ApiOperation({ summary: 'Get payment statistics' })
  async getPaymentStats(@Query('userId') userId?: string) {
    return this.paymentService.getPaymentStats(userId);
  }
}
