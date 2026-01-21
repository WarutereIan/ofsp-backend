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
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  CreateRFQDto,
  CreateRFQResponseDto,
  CreateSourcingRequestDto,
  CreateSupplierOfferDto,
  CreateNegotiationDto,
  SendNegotiationMessageDto,
} from './dto';

@ApiTags('Marketplace')
@ApiBearerAuth()
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // ============ Produce Listings ============

  @Get('listings')
  @ApiOperation({ summary: 'Get all produce listings' })
  async getListings(
    @Query('farmerId') farmerId?: string,
    @Query('variety') variety?: string,
    @Query('county') county?: string,
    @Query('status') status?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ) {
    return this.marketplaceService.getListings({
      farmerId,
      variety,
      county,
      status,
      minPrice,
      maxPrice,
    });
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing by ID' })
  async getListingById(@Param('id') id: string) {
    return this.marketplaceService.getListingById(id);
  }

  @Post('listings')
  @ApiOperation({ summary: 'Create a produce listing' })
  async createListing(
    @Body() createListingDto: CreateListingDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.createListing(createListingDto, user.id);
  }

  @Put('listings/:id')
  @ApiOperation({ summary: 'Update a listing' })
  async updateListing(
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.updateListing(id, updateListingDto, user.id);
  }

  @Delete('listings/:id')
  @ApiOperation({ summary: 'Delete a listing' })
  async deleteListing(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketplaceService.deleteListing(id, user.id);
  }

  // ============ Marketplace Orders ============

  @Get('orders')
  @ApiOperation({ summary: 'Get all marketplace orders' })
  async getOrders(
    @Query('buyerId') buyerId?: string,
    @Query('farmerId') farmerId?: string,
    @Query('status') status?: string,
    @Query('listingId') listingId?: string,
  ) {
    return this.marketplaceService.getOrders({
      buyerId,
      farmerId,
      status,
      listingId,
    });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrderById(@Param('id') id: string) {
    return this.marketplaceService.getOrderById(id);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create a marketplace order' })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.createOrder(createOrderDto, user.id);
  }

  @Put('orders/:id/status')
  @ApiOperation({ summary: 'Update order status' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.updateOrderStatus(
      id,
      updateOrderStatusDto,
      user.id,
    );
  }

  // ============ RFQs ============

  @Get('rfqs')
  @ApiOperation({ summary: 'Get all RFQs' })
  async getRFQs(
    @Query('buyerId') buyerId?: string,
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.getRFQs({ buyerId, status });
  }

  @Get('rfqs/:id')
  @ApiOperation({ summary: 'Get RFQ by ID' })
  async getRFQById(@Param('id') id: string) {
    return this.marketplaceService.getRFQById(id);
  }

  @Post('rfqs')
  @ApiOperation({ summary: 'Create an RFQ' })
  async createRFQ(
    @Body() createRFQDto: CreateRFQDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.createRFQ(createRFQDto, user.id);
  }

  @Put('rfqs/:id')
  @ApiOperation({ summary: 'Update an RFQ' })
  async updateRFQ(
    @Param('id') id: string,
    @Body() updateRFQDto: Partial<CreateRFQDto>,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.updateRFQ(id, updateRFQDto, user.id);
  }

  @Put('rfqs/:id/publish')
  @ApiOperation({ summary: 'Publish an RFQ' })
  async publishRFQ(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketplaceService.publishRFQ(id, user.id);
  }

  @Put('rfqs/:id/close')
  @ApiOperation({ summary: 'Close an RFQ' })
  async closeRFQ(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketplaceService.closeRFQ(id, user.id);
  }

  // ============ RFQ Responses ============

  @Get('rfqs/:rfqId/responses')
  @ApiOperation({ summary: 'Get RFQ responses' })
  async getRFQResponses(
    @Param('rfqId') rfqId: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.getRFQResponses({ rfqId, supplierId, status });
  }

  @Get('rfq-responses/:id')
  @ApiOperation({ summary: 'Get RFQ response by ID' })
  async getRFQResponseById(@Param('id') id: string) {
    return this.marketplaceService.getRFQResponseById(id);
  }

  @Post('rfqs/:rfqId/responses')
  @ApiOperation({ summary: 'Submit RFQ response' })
  async submitRFQResponse(
    @Param('rfqId') rfqId: string,
    @Body() createRFQResponseDto: CreateRFQResponseDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.submitRFQResponse(
      { ...createRFQResponseDto, rfqId },
      user.id,
    );
  }

  @Put('rfq-responses/:id/status')
  @ApiOperation({ summary: 'Update RFQ response status' })
  async updateRFQResponseStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.updateRFQResponseStatus(id, status, user.id);
  }

  @Put('rfqs/:rfqId/award/:responseId')
  @ApiOperation({ summary: 'Award RFQ to a response' })
  async awardRFQ(
    @Param('rfqId') rfqId: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.awardRFQ(rfqId, responseId, user.id);
  }

  // ============ Sourcing Requests ============

  @Get('sourcing-requests')
  @ApiOperation({ summary: 'Get all sourcing requests' })
  async getSourcingRequests(
    @Query('buyerId') buyerId?: string,
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.getSourcingRequests({ buyerId, status });
  }

  @Get('sourcing-requests/:id')
  @ApiOperation({ summary: 'Get sourcing request by ID' })
  async getSourcingRequestById(@Param('id') id: string) {
    return this.marketplaceService.getSourcingRequestById(id);
  }

  @Post('sourcing-requests')
  @ApiOperation({ summary: 'Create a sourcing request' })
  async createSourcingRequest(
    @Body() createSourcingRequestDto: CreateSourcingRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.createSourcingRequest(
      createSourcingRequestDto,
      user.id,
    );
  }

  @Put('sourcing-requests/:id/publish')
  @ApiOperation({ summary: 'Publish a sourcing request' })
  async publishSourcingRequest(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketplaceService.publishSourcingRequest(id, user.id);
  }

  @Put('sourcing-requests/:id/close')
  @ApiOperation({ summary: 'Close a sourcing request' })
  async closeSourcingRequest(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketplaceService.closeSourcingRequest(id, user.id);
  }

  @Post('sourcing-requests/:requestId/offers')
  @ApiOperation({ summary: 'Submit supplier offer' })
  async submitSupplierOffer(
    @Param('requestId') requestId: string,
    @Body() createSupplierOfferDto: CreateSupplierOfferDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.submitSupplierOffer(
      { ...createSupplierOfferDto, sourcingRequestId: requestId },
      user.id,
    );
  }

  @Put('supplier-offers/:id/accept')
  @ApiOperation({ summary: 'Accept supplier offer' })
  async acceptSupplierOffer(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.acceptSupplierOffer(id, user.id);
  }

  // ============ Negotiations ============

  @Get('negotiations')
  @ApiOperation({ summary: 'Get all negotiations' })
  async getNegotiations(
    @Query('listingId') listingId?: string,
    @Query('buyerId') buyerId?: string,
    @Query('farmerId') farmerId?: string,
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.getNegotiations({
      listingId,
      buyerId,
      farmerId,
      status,
    });
  }

  @Get('negotiations/:id')
  @ApiOperation({ summary: 'Get negotiation by ID' })
  async getNegotiationById(@Param('id') id: string) {
    return this.marketplaceService.getNegotiationById(id);
  }

  @Post('negotiations')
  @ApiOperation({ summary: 'Initiate a negotiation' })
  async initiateNegotiation(
    @Body() createNegotiationDto: CreateNegotiationDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.initiateNegotiation(
      createNegotiationDto,
      user.id,
    );
  }

  @Post('negotiations/:id/messages')
  @ApiOperation({ summary: 'Send negotiation message' })
  async sendNegotiationMessage(
    @Param('id') id: string,
    @Body() sendMessageDto: SendNegotiationMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.marketplaceService.sendNegotiationMessage(
      id,
      sendMessageDto,
      user.id,
    );
  }

  @Put('negotiations/:id/accept')
  @ApiOperation({ summary: 'Accept negotiation' })
  async acceptNegotiation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketplaceService.acceptNegotiation(id, user.id);
  }

  @Put('negotiations/:id/reject')
  @ApiOperation({ summary: 'Reject negotiation' })
  async rejectNegotiation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marketplaceService.rejectNegotiation(id, user.id);
  }

  // ============ Statistics ============

  @Get('stats')
  @ApiOperation({ summary: 'Get marketplace statistics' })
  async getMarketplaceStats() {
    return this.marketplaceService.getMarketplaceStats();
  }
}
