import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrismaService } from '../../test/test-utils';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPayment = {
    id: 'payment-1',
    referenceNumber: 'PAY-20250121-000001',
    orderId: 'order-1',
    amount: 1000,
    currency: 'KES',
    method: 'MPESA',
    status: 'PENDING',
    payerId: 'user-1',
    payeeId: 'user-2',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEscrow = {
    id: 'escrow-1',
    orderId: 'order-1',
    amount: 1000,
    status: 'SECURED',
    buyerId: 'user-1',
    buyerName: 'Buyer Name',
    farmerId: 'user-2',
    farmerName: 'Farmer Name',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPayments', () => {
    it('should return all payments', async () => {
      prisma.payment.findMany = jest.fn().mockResolvedValue([mockPayment]);

      const result = await service.getPayments();

      expect(result).toEqual([mockPayment]);
      expect(prisma.payment.findMany).toHaveBeenCalled();
    });

    it('should filter payments by status', async () => {
      prisma.payment.findMany = jest.fn().mockResolvedValue([mockPayment]);

      await service.getPayments({ status: 'PENDING' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by id', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);

      const result = await service.getPaymentById('payment-1');

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if payment not found', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getPaymentById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const paymentData = {
        orderId: 'order-1',
        amount: 1000,
        method: 'MPESA',
        payerId: 'user-1',
        payeeId: 'user-2',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_payment_reference: 'PAY-20250121-000001' }]);
      prisma.payment.create = jest.fn().mockResolvedValue(mockPayment);

      const result = await service.createPayment(paymentData);

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);
      prisma.payment.update = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'RELEASED',
      });

      const result = await service.updatePaymentStatus('payment-1', {
        status: 'RELEASED',
      });

      expect(result.status).toBe('RELEASED');
      expect(prisma.payment.update).toHaveBeenCalled();
    });
  });

  describe('getEscrowTransactionById', () => {
    it('should return escrow transaction by id', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);

      const result = await service.getEscrowTransactionById('escrow-1');

      expect(result).toEqual(mockEscrow);
    });

    it('should throw NotFoundException if escrow not found', async () => {
      prisma.escrowTransaction.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getEscrowTransactionById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow successfully', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);
      prisma.escrowTransaction.update = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAt: new Date(),
      });

      const result = await service.releaseEscrow('escrow-1', {}, 'user-1');

      expect(result.status).toBe('RELEASED');
      expect(prisma.escrowTransaction.update).toHaveBeenCalled();
    });

    it('should throw error if escrow is not in valid state', async () => {
      prisma.escrowTransaction.findUnique = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
      });

      await expect(
        service.releaseEscrow('escrow-1', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disputeEscrow', () => {
    it('should dispute escrow successfully', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);
      prisma.escrowTransaction.update = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
        disputeReason: 'Quality issue',
      });

      const result = await service.disputeEscrow(
        'escrow-1',
        { reason: 'Quality issue' },
        'user-1',
      );

      expect(result.status).toBe('DISPUTED');
      expect(prisma.escrowTransaction.update).toHaveBeenCalled();
    });

    it('should throw error if escrow is already disputed', async () => {
      prisma.escrowTransaction.findUnique = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      await expect(
        service.disputeEscrow('escrow-1', { reason: 'Test' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics', async () => {
      prisma.payment.count = jest.fn().mockResolvedValue(10);
      prisma.payment.groupBy = jest
        .fn()
        .mockResolvedValueOnce([
          { status: 'PENDING', _count: 2 },
          { status: 'RELEASED', _count: 8 },
        ])
        .mockResolvedValueOnce([
          { method: 'MPESA', _count: 5 },
          { method: 'BANK_TRANSFER', _count: 5 },
        ]);
      prisma.payment.aggregate = jest.fn().mockResolvedValue({
        _sum: { amount: 10000 },
      });
      prisma.escrowTransaction.aggregate = jest.fn().mockResolvedValue({
        _sum: { amount: 5000 },
        _count: 3,
      });
      prisma.escrowTransaction.groupBy = jest.fn().mockResolvedValue([
        { status: 'SECURED', _count: 2 },
        { status: 'RELEASED', _count: 1 },
      ]);

      const result = await service.getPaymentStats();

      expect(result.totalPayments).toBe(10);
      expect(result.completedPayments).toBe(8);
      expect(result.pendingPayments).toBe(2);
    });
  });
});
