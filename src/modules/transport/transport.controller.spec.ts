import { Test, TestingModule } from '@nestjs/testing';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('TransportController', () => {
  let controller: TransportController;
  let service: TransportService;

  const mockTransportService = {
    getTransportRequests: jest.fn(),
    getTransportRequestById: jest.fn(),
    createTransportRequest: jest.fn(),
    updateTransportRequestStatus: jest.fn(),
    acceptTransportRequest: jest.fn(),
    getPickupSchedules: jest.fn(),
    getPickupScheduleById: jest.fn(),
    createPickupSchedule: jest.fn(),
    getPickupSlots: jest.fn(),
    createPickupSlot: jest.fn(),
    bookPickupSlot: jest.fn(),
    getTrackingUpdates: jest.fn(),
    addTrackingUpdate: jest.fn(),
    getTransportStats: jest.fn(),
  };

  const mockCurrentUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'TRANSPORT_PROVIDER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransportController],
      providers: [
        {
          provide: TransportService,
          useValue: mockTransportService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TransportController>(TransportController);
    service = module.get<TransportService>(TransportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransportRequests', () => {
    it('should return all transport requests', async () => {
      const mockRequests = [
        {
          id: 'transport-1',
          requestNumber: 'TR-20250121-000001',
          status: 'PENDING',
        },
      ];

      mockTransportService.getTransportRequests.mockResolvedValue(mockRequests);

      const result = await controller.getTransportRequests();

      expect(result).toEqual(mockRequests);
      expect(service.getTransportRequests).toHaveBeenCalledWith({});
    });
  });

  describe('createTransportRequest', () => {
    it('should create a transport request', async () => {
      const requestData = {
        type: 'MARKETPLACE_ORDER',
        pickupLocation: 'Farm A',
        pickupCounty: 'Nairobi',
        deliveryLocation: 'Center B',
        deliveryCounty: 'Nairobi',
      };

      const createdRequest = {
        id: 'transport-1',
        requestNumber: 'TR-20250121-000001',
        ...requestData,
      };

      mockTransportService.createTransportRequest.mockResolvedValue(createdRequest);

      const result = await controller.createTransportRequest(
        requestData,
        mockCurrentUser,
      );

      expect(result).toEqual(createdRequest);
      expect(service.createTransportRequest).toHaveBeenCalledWith(
        requestData,
        mockCurrentUser.id,
      );
    });
  });
});
