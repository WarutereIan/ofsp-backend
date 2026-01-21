import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mockPrismaService,
  mockListing,
  mockOrder,
  mockRFQ,
  mockRFQResponse,
  mockSourcingRequest,
  mockSupplierOffer,
  mockNegotiation,
  mockNegotiationMessage,
} from '../../test/test-utils';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getListings', () => {
    it('should return all listings without filters', async () => {
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([mockListing]);

      const result = await service.getListings();

      expect(result).toEqual([mockListing]);
      expect(prisma.produceListing.findMany).toHaveBeenCalled();
    });

    it('should filter listings by farmerId', async () => {
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([mockListing]);

      await service.getListings({ farmerId: 'user-1' });

      expect(prisma.produceListing.findMany).toHaveBeenCalledWith({
        where: { farmerId: 'user-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getListingById', () => {
    it('should return a listing when found', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);

      const result = await service.getListingById('listing-1');

      expect(result).toEqual(mockListing);
    });

    it('should throw NotFoundException when listing not found', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getListingById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createListing', () => {
    it('should create a listing successfully', async () => {
      const listingData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
        county: 'Nairobi',
        subcounty: 'Westlands',
        location: 'Parklands',
        description: 'Fresh OFSP',
        photos: [],
        batchId: 'BATCH-001',
        harvestDate: '2025-01-21',
      };

      prisma.$queryRaw = jest.fn().mockResolvedValue([]);
      prisma.produceListing.create = jest.fn().mockResolvedValue(mockListing);

      const result = await service.createListing(listingData, 'user-1');

      expect(result).toEqual(mockListing);
      expect(prisma.produceListing.create).toHaveBeenCalled();
    });
  });

  describe('updateListing', () => {
    it('should update listing when farmer owns it', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);
      prisma.produceListing.update = jest.fn().mockResolvedValue(mockListing);

      const updateData = { pricePerKg: 55 };
      const result = await service.updateListing('listing-1', updateData, 'user-1');

      expect(result).toEqual(mockListing);
    });

    it('should throw BadRequestException when farmer does not own listing', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);

      await expect(
        service.updateListing('listing-1', {}, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteListing', () => {
    it('should delete listing when farmer owns it', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);
      prisma.produceListing.delete = jest.fn().mockResolvedValue(mockListing);

      const result = await service.deleteListing('listing-1', 'user-1');

      expect(result).toEqual(mockListing);
    });

    it('should throw BadRequestException when farmer does not own listing', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);

      await expect(
        service.deleteListing('listing-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrders', () => {
    it('should return all orders', async () => {
      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue([mockOrder]);

      const result = await service.getOrders();

      expect(result).toEqual([mockOrder]);
    });

    it('should filter orders by buyerId', async () => {
      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue([mockOrder]);

      await service.getOrders({ buyerId: 'user-2' });

      expect(prisma.marketplaceOrder.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'user-2' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getOrderById', () => {
    it('should return an order when found', async () => {
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(mockOrder);

      const result = await service.getOrderById('order-1');

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getOrderById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'Kenya',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
        notes: 'Please deliver in the morning',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-20250121-000001' }]);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue(mockOrder);

      const result = await service.createOrder(orderData, 'user-2');

      expect(result).toEqual(mockOrder);
      expect(prisma.marketplaceOrder.create).toHaveBeenCalled();
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status when user is buyer or farmer', async () => {
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(mockOrder);
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue({
        ...mockOrder,
        status: 'ORDER_ACCEPTED',
      });

      const result = await service.updateOrderStatus(
        'order-1',
        { status: 'ORDER_ACCEPTED' },
        'user-2',
      );

      expect(result.status).toBe('ORDER_ACCEPTED');
    });

    it('should throw BadRequestException when user is not buyer or farmer', async () => {
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(mockOrder);

      await expect(
        service.updateOrderStatus('order-1', { status: 'ORDER_ACCEPTED' }, 'user-3'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRFQs', () => {
    it('should return all RFQs', async () => {
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([mockRFQ]);

      const result = await service.getRFQs();

      expect(result).toEqual([mockRFQ]);
    });
  });

  describe('createRFQ', () => {
    it('should create an RFQ successfully', async () => {
      const rfqData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
        deliveryLocation: 'Nairobi',
        description: 'Need fresh OFSP',
        quoteDeadline: '2025-01-25',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_rfq_number: 'RFQ-20250121-000001' }]);
      prisma.rFQ.create = jest.fn().mockResolvedValue(mockRFQ);

      const result = await service.createRFQ(rfqData, 'user-2');

      expect(result).toEqual(mockRFQ);
      expect(prisma.rFQ.create).toHaveBeenCalled();
    });
  });

  describe('submitRFQResponse', () => {
    it('should submit RFQ response successfully', async () => {
      const responseData = {
        rfqId: 'rfq-1',
        pricePerKg: 50,
        notes: 'Can deliver on time',
        deliveryDate: '2025-02-01',
      };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);
      prisma.rFQResponse.create = jest.fn().mockResolvedValue(mockRFQResponse);

      const result = await service.submitRFQResponse(responseData, 'user-1');

      expect(result).toEqual(mockRFQResponse);
      expect(prisma.rFQResponse.create).toHaveBeenCalled();
    });
  });

  describe('awardRFQ', () => {
    it('should award RFQ to a response', async () => {
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);
      prisma.rFQResponse.update = jest.fn().mockResolvedValue({
        ...mockRFQResponse,
        status: 'AWARDED',
      });
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...mockRFQ,
        status: 'AWARDED',
      });

      const result = await service.awardRFQ('rfq-1', 'rfq-response-1', 'user-2');

      expect(result.status).toBe('AWARDED');
      expect(prisma.rFQResponse.update).toHaveBeenCalled();
      expect(prisma.rFQ.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);

      await expect(
        service.awardRFQ('rfq-1', 'rfq-response-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createSourcingRequest', () => {
    it('should create a sourcing request successfully', async () => {
      const requestData = {
        variety: 'Kenya',
        quantity: 200,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
        deliveryLocation: 'Nairobi',
        description: 'Need large quantity',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_sourcing_request_id: 'SR-20250121-000001' }]);
      prisma.sourcingRequest.create = jest.fn().mockResolvedValue(mockSourcingRequest);

      const result = await service.createSourcingRequest(requestData, 'user-2');

      expect(result).toEqual(mockSourcingRequest);
      expect(prisma.sourcingRequest.create).toHaveBeenCalled();
    });
  });

  describe('submitSupplierOffer', () => {
    it('should submit supplier offer successfully', async () => {
      const offerData = {
        sourcingRequestId: 'sourcing-1',
        pricePerKg: 50,
        notes: 'Can supply',
        deliveryDate: '2025-02-01',
      };

      prisma.sourcingRequest.findUnique = jest
        .fn()
        .mockResolvedValue(mockSourcingRequest);
      prisma.supplierOffer.create = jest.fn().mockResolvedValue(mockSupplierOffer);

      const result = await service.submitSupplierOffer(offerData, 'user-1');

      expect(result).toEqual(mockSupplierOffer);
      expect(prisma.supplierOffer.create).toHaveBeenCalled();
    });
  });

  describe('initiateNegotiation', () => {
    it('should initiate a negotiation successfully', async () => {
      const negotiationData = {
        listingId: 'listing-1',
        proposedPrice: 45,
        proposedQuantity: 80,
        message: 'Can we negotiate?',
      };

      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_negotiation_number: 'NEG-20250121-000001' }]);
      prisma.negotiation.create = jest.fn().mockResolvedValue(mockNegotiation);

      const result = await service.initiateNegotiation(negotiationData, 'user-2');

      expect(result).toEqual(mockNegotiation);
      expect(prisma.negotiation.create).toHaveBeenCalled();
    });
  });

  describe('sendNegotiationMessage', () => {
    it('should send negotiation message successfully', async () => {
      const messageData = {
        message: 'How about 45 per kg?',
        counterPrice: 45,
        counterQuantity: 80,
      };

      prisma.negotiation.findUnique = jest.fn().mockResolvedValue(mockNegotiation);
      prisma.negotiationMessage.create = jest
        .fn()
        .mockResolvedValue(mockNegotiationMessage);

      const result = await service.sendNegotiationMessage(
        'negotiation-1',
        messageData,
        'user-2',
      );

      expect(result).toEqual(mockNegotiationMessage);
      expect(prisma.negotiationMessage.create).toHaveBeenCalled();
    });
  });

  describe('getMarketplaceStats', () => {
    it('should return marketplace statistics', async () => {
      prisma.produceListing.count = jest.fn().mockResolvedValue(10);
      prisma.marketplaceOrder.count = jest.fn().mockResolvedValue(5);
      prisma.rFQ.count = jest.fn().mockResolvedValue(3);
      prisma.sourcingRequest.count = jest.fn().mockResolvedValue(2);
      prisma.marketplaceOrder.groupBy = jest.fn().mockResolvedValue([
        { status: 'ORDER_PLACED', _count: 2 },
        { status: 'COMPLETED', _count: 3 },
      ]);

      const result = await service.getMarketplaceStats();

      expect(result.totalListings).toBe(10);
      expect(result.totalOrders).toBe(5);
      expect(result.totalRFQs).toBe(3);
      expect(result.totalSourcingRequests).toBe(2);
      expect(result.ordersByStatus).toHaveLength(2);
    });
  });
});
