import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  mockListing,
  mockOrder,
  mockRFQ,
  mockRFQResponse,
  mockSourcingRequest,
  mockSupplierOffer,
  mockNegotiation,
} from '../../test/test-utils';

describe('MarketplaceController', () => {
  let controller: MarketplaceController;
  let service: MarketplaceService;

  const mockMarketplaceService = {
    getListings: jest.fn(),
    getListingById: jest.fn(),
    createListing: jest.fn(),
    updateListing: jest.fn(),
    deleteListing: jest.fn(),
    getOrders: jest.fn(),
    getOrderById: jest.fn(),
    createOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    getRFQs: jest.fn(),
    getRFQById: jest.fn(),
    createRFQ: jest.fn(),
    updateRFQ: jest.fn(),
    publishRFQ: jest.fn(),
    closeRFQ: jest.fn(),
    getRFQResponses: jest.fn(),
    getRFQResponseById: jest.fn(),
    submitRFQResponse: jest.fn(),
    updateRFQResponseStatus: jest.fn(),
    awardRFQ: jest.fn(),
    getSourcingRequests: jest.fn(),
    getSourcingRequestById: jest.fn(),
    createSourcingRequest: jest.fn(),
    submitSupplierOffer: jest.fn(),
    acceptSupplierOffer: jest.fn(),
    getNegotiations: jest.fn(),
    getNegotiationById: jest.fn(),
    initiateNegotiation: jest.fn(),
    sendNegotiationMessage: jest.fn(),
    acceptNegotiation: jest.fn(),
    rejectNegotiation: jest.fn(),
    getMarketplaceStats: jest.fn(),
  };

  const mockCurrentUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'FARMER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceController],
      providers: [
        {
          provide: MarketplaceService,
          useValue: mockMarketplaceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<MarketplaceController>(MarketplaceController);
    service = module.get<MarketplaceService>(MarketplaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getListings', () => {
    it('should return all listings', async () => {
      mockMarketplaceService.getListings.mockResolvedValue([mockListing]);

      const result = await controller.getListings();

      expect(result).toEqual([mockListing]);
      expect(service.getListings).toHaveBeenCalledWith({});
    });

    it('should filter listings by variety', async () => {
      mockMarketplaceService.getListings.mockResolvedValue([mockListing]);

      await controller.getListings(undefined, 'Kenya');

      expect(service.getListings).toHaveBeenCalledWith({
        variety: 'Kenya',
      });
    });
  });

  describe('getListingById', () => {
    it('should return a listing by ID', async () => {
      mockMarketplaceService.getListingById.mockResolvedValue(mockListing);

      const result = await controller.getListingById('listing-1');

      expect(result).toEqual(mockListing);
      expect(service.getListingById).toHaveBeenCalledWith('listing-1');
    });
  });

  describe('createListing', () => {
    it('should create a listing', async () => {
      const listingData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
        county: 'Nairobi',
        harvestDate: '2025-01-21',
      };

      mockMarketplaceService.createListing.mockResolvedValue(mockListing);

      const result = await controller.createListing(listingData, mockCurrentUser);

      expect(result).toEqual(mockListing);
      expect(service.createListing).toHaveBeenCalledWith(
        listingData,
        mockCurrentUser.id,
      );
    });
  });

  describe('updateListing', () => {
    it('should update a listing', async () => {
      const updateData = { pricePerKg: 55 };
      const updatedListing = { ...mockListing, ...updateData };

      mockMarketplaceService.updateListing.mockResolvedValue(updatedListing);

      const result = await controller.updateListing(
        'listing-1',
        updateData,
        mockCurrentUser,
      );

      expect(result).toEqual(updatedListing);
      expect(service.updateListing).toHaveBeenCalledWith(
        'listing-1',
        updateData,
        mockCurrentUser.id,
      );
    });
  });

  describe('deleteListing', () => {
    it('should delete a listing', async () => {
      mockMarketplaceService.deleteListing.mockResolvedValue(mockListing);

      await controller.deleteListing('listing-1', mockCurrentUser);

      expect(service.deleteListing).toHaveBeenCalledWith(
        'listing-1',
        mockCurrentUser.id,
      );
    });
  });

  describe('getOrders', () => {
    it('should return all orders', async () => {
      mockMarketplaceService.getOrders.mockResolvedValue([mockOrder]);

      const result = await controller.getOrders();

      expect(result).toEqual([mockOrder]);
      expect(service.getOrders).toHaveBeenCalledWith({});
    });
  });

  describe('createOrder', () => {
    it('should create an order', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'Kenya',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
      };

      mockMarketplaceService.createOrder.mockResolvedValue(mockOrder);

      const result = await controller.createOrder(orderData, mockCurrentUser);

      expect(result).toEqual(mockOrder);
      expect(service.createOrder).toHaveBeenCalledWith(
        orderData,
        mockCurrentUser.id,
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const statusData = { status: 'ORDER_ACCEPTED' };
      const updatedOrder = { ...mockOrder, status: 'ORDER_ACCEPTED' };

      mockMarketplaceService.updateOrderStatus.mockResolvedValue(updatedOrder);

      const result = await controller.updateOrderStatus(
        'order-1',
        statusData,
        mockCurrentUser,
      );

      expect(result).toEqual(updatedOrder);
      expect(service.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        statusData,
        mockCurrentUser.id,
      );
    });
  });

  describe('getRFQs', () => {
    it('should return all RFQs', async () => {
      mockMarketplaceService.getRFQs.mockResolvedValue([mockRFQ]);

      const result = await controller.getRFQs();

      expect(result).toEqual([mockRFQ]);
      expect(service.getRFQs).toHaveBeenCalledWith({});
    });
  });

  describe('createRFQ', () => {
    it('should create an RFQ', async () => {
      const rfqData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
        deliveryLocation: 'Nairobi',
        description: 'Need fresh OFSP',
        quoteDeadline: '2025-01-25',
      };

      mockMarketplaceService.createRFQ.mockResolvedValue(mockRFQ);

      const result = await controller.createRFQ(rfqData, mockCurrentUser);

      expect(result).toEqual(mockRFQ);
      expect(service.createRFQ).toHaveBeenCalledWith(rfqData, mockCurrentUser.id);
    });
  });

  describe('submitRFQResponse', () => {
    it('should submit RFQ response', async () => {
      const responseData = {
        rfqId: 'rfq-1',
        pricePerKg: 50,
        notes: 'Can deliver on time',
        deliveryDate: '2025-02-01',
      };

      mockMarketplaceService.submitRFQResponse.mockResolvedValue(mockRFQResponse);

      const result = await controller.submitRFQResponse(
        'rfq-1',
        responseData,
        mockCurrentUser,
      );

      expect(result).toEqual(mockRFQResponse);
      expect(service.submitRFQResponse).toHaveBeenCalledWith(
        { ...responseData, rfqId: 'rfq-1' },
        mockCurrentUser.id,
      );
    });
  });

  describe('awardRFQ', () => {
    it('should award RFQ to a response', async () => {
      const awardedResponse = { ...mockRFQResponse, status: 'AWARDED' };

      mockMarketplaceService.awardRFQ.mockResolvedValue(awardedResponse);

      const result = await controller.awardRFQ(
        'rfq-1',
        'rfq-response-1',
        mockCurrentUser,
      );

      expect(result).toEqual(awardedResponse);
      expect(service.awardRFQ).toHaveBeenCalledWith(
        'rfq-1',
        'rfq-response-1',
        mockCurrentUser.id,
      );
    });
  });

  describe('createSourcingRequest', () => {
    it('should create a sourcing request', async () => {
      const requestData = {
        variety: 'Kenya',
        quantity: 200,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
        deliveryLocation: 'Nairobi',
        description: 'Need large quantity',
      };

      mockMarketplaceService.createSourcingRequest.mockResolvedValue(
        mockSourcingRequest,
      );

      const result = await controller.createSourcingRequest(
        requestData,
        mockCurrentUser,
      );

      expect(result).toEqual(mockSourcingRequest);
      expect(service.createSourcingRequest).toHaveBeenCalledWith(
        requestData,
        mockCurrentUser.id,
      );
    });
  });

  describe('submitSupplierOffer', () => {
    it('should submit supplier offer', async () => {
      const offerData = {
        sourcingRequestId: 'sourcing-1',
        pricePerKg: 50,
        notes: 'Can supply',
        deliveryDate: '2025-02-01',
      };

      mockMarketplaceService.submitSupplierOffer.mockResolvedValue(
        mockSupplierOffer,
      );

      const result = await controller.submitSupplierOffer(
        'sourcing-1',
        offerData,
        mockCurrentUser,
      );

      expect(result).toEqual(mockSupplierOffer);
      expect(service.submitSupplierOffer).toHaveBeenCalledWith(
        { ...offerData, sourcingRequestId: 'sourcing-1' },
        mockCurrentUser.id,
      );
    });
  });

  describe('initiateNegotiation', () => {
    it('should initiate a negotiation', async () => {
      const negotiationData = {
        listingId: 'listing-1',
        proposedPrice: 45,
        proposedQuantity: 80,
        message: 'Can we negotiate?',
      };

      mockMarketplaceService.initiateNegotiation.mockResolvedValue(
        mockNegotiation,
      );

      const result = await controller.initiateNegotiation(
        negotiationData,
        mockCurrentUser,
      );

      expect(result).toEqual(mockNegotiation);
      expect(service.initiateNegotiation).toHaveBeenCalledWith(
        negotiationData,
        mockCurrentUser.id,
      );
    });
  });

  describe('sendNegotiationMessage', () => {
    it('should send negotiation message', async () => {
      const messageData = {
        message: 'How about 45 per kg?',
        counterPrice: 45,
        counterQuantity: 80,
      };

      mockMarketplaceService.sendNegotiationMessage.mockResolvedValue({
        id: 'message-1',
        negotiationId: 'negotiation-1',
        message: 'How about 45 per kg?',
        createdAt: new Date(),
      });

      const result = await controller.sendNegotiationMessage(
        'negotiation-1',
        messageData,
        mockCurrentUser,
      );

      expect(result.message).toBe('How about 45 per kg?');
      expect(service.sendNegotiationMessage).toHaveBeenCalledWith(
        'negotiation-1',
        messageData,
        mockCurrentUser.id,
      );
    });
  });

  describe('getMarketplaceStats', () => {
    it('should return marketplace statistics', async () => {
      const stats = {
        totalListings: 10,
        totalOrders: 5,
        totalRFQs: 3,
        totalSourcingRequests: 2,
        ordersByStatus: [
          { status: 'ORDER_PLACED', count: 2 },
          { status: 'COMPLETED', count: 3 },
        ],
      };

      mockMarketplaceService.getMarketplaceStats.mockResolvedValue(stats);

      const result = await controller.getMarketplaceStats();

      expect(result).toEqual(stats);
      expect(service.getMarketplaceStats).toHaveBeenCalled();
    });
  });
});
