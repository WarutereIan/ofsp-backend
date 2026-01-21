import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InputService } from './input.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrismaService } from '../../test/test-utils';

describe('InputService', () => {
  let service: InputService;
  let prisma: jest.Mocked<PrismaService>;

  const mockInput = {
    id: 'input-1',
    providerId: 'user-1',
    name: 'OFSP Cuttings',
    category: 'Planting Material',
    description: 'High quality OFSP cuttings',
    price: 50,
    unit: 'cutting',
    stock: 100,
    minimumStock: 10,
    images: [],
    location: 'Nairobi',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    provider: {
      id: 'user-1',
      email: 'provider@example.com',
      profile: {
        firstName: 'Provider',
        lastName: 'Test',
      },
    },
  };

  const mockInputOrder = {
    id: 'order-1',
    orderNumber: 'INP-20250121-000001',
    farmerId: 'user-2',
    inputId: 'input-1',
    quantity: 10,
    unit: 'cutting',
    pricePerUnit: 50,
    subtotal: 500,
    transportFee: 100,
    totalAmount: 600,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    requiresTransport: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    farmer: {
      id: 'user-2',
      email: 'farmer@example.com',
      profile: {
        firstName: 'Farmer',
        lastName: 'Test',
      },
    },
    input: mockInput,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InputService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<InputService>(InputService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInputs', () => {
    it('should return all inputs without filters', async () => {
      prisma.input.findMany = jest.fn().mockResolvedValue([mockInput]);

      const result = await service.getInputs();

      expect(result).toEqual([mockInput]);
      expect(prisma.input.findMany).toHaveBeenCalled();
    });

    it('should filter inputs by providerId', async () => {
      prisma.input.findMany = jest.fn().mockResolvedValue([mockInput]);

      await service.getInputs({ providerId: 'user-1' });

      expect(prisma.input.findMany).toHaveBeenCalledWith({
        where: { providerId: 'user-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getInputById', () => {
    it('should return an input when found', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);

      const result = await service.getInputById('input-1');

      expect(result).toEqual(mockInput);
    });

    it('should throw NotFoundException when input not found', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getInputById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createInput', () => {
    it('should create an input successfully', async () => {
      const inputData = {
        name: 'OFSP Cuttings',
        category: 'Planting Material',
        description: 'High quality cuttings',
        price: 50,
        unit: 'cutting',
        stock: 100,
        location: 'Nairobi',
      };

      prisma.input.create = jest.fn().mockResolvedValue(mockInput);

      const result = await service.createInput(inputData, 'user-1');

      expect(result).toEqual(mockInput);
      expect(prisma.input.create).toHaveBeenCalled();
    });
  });

  describe('updateInput', () => {
    it('should update input when provider owns it', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.input.update = jest.fn().mockResolvedValue({
        ...mockInput,
        price: 55,
      });

      const result = await service.updateInput(
        'input-1',
        { price: 55 },
        'user-1',
      );

      expect(result.price).toBe(55);
    });

    it('should throw BadRequestException when provider does not own input', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);

      await expect(
        service.updateInput('input-1', {}, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createInputOrder', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        inputId: 'input-1',
        quantity: 10,
        requiresTransport: true,
        transportFee: 100,
      };

      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_input_order_number: 'INP-20250121-000001' }]);
      prisma.inputOrder.create = jest.fn().mockResolvedValue(mockInputOrder);

      const result = await service.createInputOrder(orderData, 'user-2');

      expect(result).toEqual(mockInputOrder);
      expect(prisma.inputOrder.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      const orderData = {
        inputId: 'input-1',
        quantity: 200, // More than available stock
      };

      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);

      await expect(
        service.createInputOrder(orderData, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateInputOrderStatus', () => {
    it('should update order status and reduce stock when accepted', async () => {
      prisma.inputOrder.findUnique = jest.fn().mockResolvedValue(mockInputOrder);
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.input.update = jest.fn().mockResolvedValue({
        ...mockInput,
        stock: 90,
      });
      prisma.inputOrder.update = jest.fn().mockResolvedValue({
        ...mockInputOrder,
        status: 'ACCEPTED',
      });

      const result = await service.updateInputOrderStatus(
        'order-1',
        { status: 'ACCEPTED' },
        'user-1',
      );

      expect(result.status).toBe('ACCEPTED');
      expect(prisma.input.update).toHaveBeenCalledWith({
        where: { id: 'input-1' },
        data: {
          stock: {
            decrement: 10,
          },
        },
      });
    });
  });

  describe('getInputStats', () => {
    it('should return input statistics', async () => {
      prisma.input.count = jest.fn().mockResolvedValue(10);
      prisma.inputOrder.count = jest.fn().mockResolvedValue(5);
      prisma.input.groupBy = jest.fn().mockResolvedValue([
        { category: 'Planting Material', _count: 5 },
        { category: 'Fertilizer', _count: 5 },
      ]);
      prisma.inputOrder.groupBy = jest.fn().mockResolvedValue([
        { status: 'PENDING', _count: 2 },
        { status: 'COMPLETED', _count: 3 },
      ]);

      const result = await service.getInputStats();

      expect(result.totalInputs).toBe(10);
      expect(result.totalOrders).toBe(5);
      expect(result.inputsByCategory).toHaveLength(2);
      expect(result.ordersByStatus).toHaveLength(2);
    });
  });
});
