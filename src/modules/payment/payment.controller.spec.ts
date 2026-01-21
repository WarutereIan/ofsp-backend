import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: jest.Mocked<PaymentService>;

  const mockPaymentService = {
    getPayments: jest.fn(),
    getPaymentById: jest.fn(),
    createPayment: jest.fn(),
    updatePaymentStatus: jest.fn(),
    getEscrowTransactions: jest.fn(),
    getEscrowTransactionById: jest.fn(),
    releaseEscrow: jest.fn(),
    disputeEscrow: jest.fn(),
    getPaymentHistory: jest.fn(),
    getPaymentStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPayments', () => {
    it('should return payments', async () => {
      const mockPayments = [{ id: 'payment-1' }];
      service.getPayments.mockResolvedValue(mockPayments);

      const result = await controller.getPayments();

      expect(result).toEqual(mockPayments);
      expect(service.getPayments).toHaveBeenCalled();
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by id', async () => {
      const mockPayment = { id: 'payment-1' };
      service.getPaymentById.mockResolvedValue(mockPayment);

      const result = await controller.getPaymentById('payment-1');

      expect(result).toEqual(mockPayment);
      expect(service.getPaymentById).toHaveBeenCalledWith('payment-1');
    });
  });

  describe('createPayment', () => {
    it('should create payment', async () => {
      const paymentData = {
        amount: 1000,
        method: 'MPESA',
        payerId: 'user-1',
        payeeId: 'user-2',
      };
      const mockPayment = { id: 'payment-1', ...paymentData };
      service.createPayment.mockResolvedValue(mockPayment);

      const result = await controller.createPayment(paymentData);

      expect(result).toEqual(mockPayment);
      expect(service.createPayment).toHaveBeenCalledWith(paymentData);
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow', async () => {
      const mockEscrow = { id: 'escrow-1', status: 'RELEASED' };
      service.releaseEscrow.mockResolvedValue(mockEscrow);

      const result = await controller.releaseEscrow(
        'escrow-1',
        {},
        { user: { userId: 'user-1' } },
      );

      expect(result).toEqual(mockEscrow);
      expect(service.releaseEscrow).toHaveBeenCalledWith(
        'escrow-1',
        {},
        'user-1',
      );
    });
  });
});
