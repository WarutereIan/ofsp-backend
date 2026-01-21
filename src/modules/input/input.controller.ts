import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InputService } from './input.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateInputDto,
  UpdateInputDto,
  CreateInputOrderDto,
  UpdateInputOrderStatusDto,
} from './dto';

@ApiTags('Inputs')
@ApiBearerAuth()
@Controller('inputs')
@UseGuards(JwtAuthGuard)
export class InputController {
  constructor(private readonly inputService: InputService) {}

  // ============ Input Products ============

  @Get()
  @ApiOperation({ summary: 'Get all input products' })
  async getInputs(
    @Query('providerId') providerId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('search') search?: string,
  ) {
    return this.inputService.getInputs({
      providerId,
      category,
      status,
      minPrice,
      maxPrice,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get input product by ID' })
  async getInputById(@Param('id') id: string) {
    return this.inputService.getInputById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an input product' })
  async createInput(
    @Body() createInputDto: CreateInputDto,
    @CurrentUser() user: any,
  ) {
    return this.inputService.createInput(createInputDto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an input product' })
  async updateInput(
    @Param('id') id: string,
    @Body() updateInputDto: UpdateInputDto,
    @CurrentUser() user: any,
  ) {
    return this.inputService.updateInput(id, updateInputDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an input product' })
  async deleteInput(@Param('id') id: string, @CurrentUser() user: any) {
    return this.inputService.deleteInput(id, user.id);
  }

  // ============ Input Orders ============

  @Get('orders')
  @ApiOperation({ summary: 'Get all input orders' })
  async getInputOrders(
    @Query('farmerId') farmerId?: string,
    @Query('providerId') providerId?: string,
    @Query('inputId') inputId?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.inputService.getInputOrders({
      farmerId,
      providerId,
      inputId,
      status,
      paymentStatus,
    });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get input order by ID' })
  async getInputOrderById(@Param('id') id: string) {
    return this.inputService.getInputOrderById(id);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create an input order' })
  async createInputOrder(
    @Body() createInputOrderDto: CreateInputOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.inputService.createInputOrder(createInputOrderDto, user.id);
  }

  @Put('orders/:id/status')
  @ApiOperation({ summary: 'Update input order status' })
  async updateInputOrderStatus(
    @Param('id') id: string,
    @Body() updateInputOrderStatusDto: UpdateInputOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.inputService.updateInputOrderStatus(
      id,
      updateInputOrderStatusDto,
      user.id,
    );
  }

  // ============ Input Customers ============

  @Get('customers')
  @ApiOperation({ summary: 'Get all input customers' })
  async getInputCustomers(
    @Query('providerId') providerId?: string,
    @Query('search') search?: string,
    @Query('minOrders') minOrders?: number,
    @Query('minSpent') minSpent?: number,
  ) {
    return this.inputService.getInputCustomers({
      providerId,
      search,
      minOrders,
      minSpent,
    });
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get input customer by ID' })
  async getInputCustomerById(
    @Param('id') id: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.inputService.getInputCustomerById(id, providerId);
  }

  @Get('customers/:id/orders')
  @ApiOperation({ summary: 'Get customer order history' })
  async getCustomerOrderHistory(
    @Param('id') id: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.inputService.getCustomerOrderHistory(id, providerId);
  }

  @Get('customers/stats')
  @ApiOperation({ summary: 'Get customer statistics' })
  async getCustomerStats(@Query('providerId') providerId?: string) {
    return this.inputService.getCustomerStats(providerId);
  }

  // ============ Statistics ============

  @Get('stats')
  @ApiOperation({ summary: 'Get input statistics' })
  async getInputStats(@Query('providerId') providerId?: string) {
    return this.inputService.getInputStats(providerId);
  }
}
