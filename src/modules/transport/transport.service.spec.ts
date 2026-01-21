import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransportService } from './transport.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrismaService } from '../../test/test-utils';

describe('TransportService', () => {
  let service: TransportService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTransportRequest = {
    id: 'transport-1',
    requestNumber: 'TR-20250121-000001',
    requesterId: 'user-1',
    type: 'MARKETPLACE_ORDER',
    status: 'PENDING',
    pickupLocation: 'Farm A',
    pickupCounty: 'Nairobi',
    deliveryLocation: 'Center B',
    deliveryCounty: 'Nairobi',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransportService>(TransportService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransportRequests', () => {
    it('should return all transport requests', async () => {
      prisma.transportRequest.findMany = jest
        .fn()
        .mockResolvedValue([mockTransportRequest]);

      const result = await service.getTransportRequests();

      expect(result).toEqual([mockTransportRequest]);
    });
  });

  describe('createTransportRequest', () => {
    it('should create a transport request successfully', async () => {
      const requestData = {
        type: 'MARKETPLACE_ORDER',
        pickupLocation: 'Farm A',
        pickupCounty: 'Nairobi',
        deliveryLocation: 'Center B',
        deliveryCounty: 'Nairobi',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_transport_request_number: 'TR-20250121-000001' }]);
      prisma.transportRequest.create = jest
        .fn()
        .mockResolvedValue(mockTransportRequest);

      const result = await service.createTransportRequest(requestData, 'user-1');

      expect(result).toEqual(mockTransportRequest);
      expect(prisma.transportRequest.create).toHaveBeenCalled();
    });
  });

  describe('acceptTransportRequest', () => {
    it('should accept a transport request', async () => {
      prisma.transportRequest.findUnique = jest
        .fn()
        .mockResolvedValue(mockTransportRequest);
      prisma.transportRequest.update = jest.fn().mockResolvedValue({
        ...mockTransportRequest,
        providerId: 'user-2',
        status: 'ACCEPTED',
      });

      const result = await service.acceptTransportRequest('transport-1', 'user-2');

      expect(result.status).toBe('ACCEPTED');
      expect(result.providerId).toBe('user-2');
    });

    it('should throw error if request is not pending', async () => {
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue({
        ...mockTransportRequest,
        status: 'ACCEPTED',
      });

      await expect(
        service.acceptTransportRequest('transport-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
