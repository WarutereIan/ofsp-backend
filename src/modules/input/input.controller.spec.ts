import { Test, TestingModule } from '@nestjs/testing';
import { InputController } from './input.controller';
import { InputService } from './input.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('InputController', () => {
  let controller: InputController;
  let service: InputService;

  const mockInputService = {
    getInputs: jest.fn(),
    getInputById: jest.fn(),
    createInput: jest.fn(),
    updateInput: jest.fn(),
    deleteInput: jest.fn(),
    getInputOrders: jest.fn(),
    getInputOrderById: jest.fn(),
    createInputOrder: jest.fn(),
    updateInputOrderStatus: jest.fn(),
    getInputStats: jest.fn(),
  };

  const mockCurrentUser = {
    id: 'user-1',
    email: 'provider@example.com',
    role: 'INPUT_PROVIDER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InputController],
      providers: [
        {
          provide: InputService,
          useValue: mockInputService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<InputController>(InputController);
    service = module.get<InputService>(InputService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInputs', () => {
    it('should return all inputs', async () => {
      const mockInputs = [
        {
          id: 'input-1',
          name: 'OFSP Cuttings',
          category: 'Planting Material',
          price: 50,
        },
      ];

      mockInputService.getInputs.mockResolvedValue(mockInputs);

      const result = await controller.getInputs();

      expect(result).toEqual(mockInputs);
      expect(service.getInputs).toHaveBeenCalledWith({});
    });
  });

  describe('createInput', () => {
    it('should create an input', async () => {
      const inputData = {
        name: 'OFSP Cuttings',
        category: 'Planting Material',
        description: 'High quality cuttings',
        price: 50,
        unit: 'cutting',
        stock: 100,
        location: 'Nairobi',
      };

      const createdInput = { id: 'input-1', ...inputData };

      mockInputService.createInput.mockResolvedValue(createdInput);

      const result = await controller.createInput(inputData, mockCurrentUser);

      expect(result).toEqual(createdInput);
      expect(service.createInput).toHaveBeenCalledWith(
        inputData,
        mockCurrentUser.id,
      );
    });
  });

  describe('createInputOrder', () => {
    it('should create an input order', async () => {
      const orderData = {
        inputId: 'input-1',
        quantity: 10,
        requiresTransport: true,
        transportFee: 100,
      };

      const createdOrder = {
        id: 'order-1',
        orderNumber: 'INP-20250121-000001',
        ...orderData,
      };

      mockInputService.createInputOrder.mockResolvedValue(createdOrder);

      const result = await controller.createInputOrder(
        orderData,
        mockCurrentUser,
      );

      expect(result).toEqual(createdOrder);
      expect(service.createInputOrder).toHaveBeenCalledWith(
        orderData,
        mockCurrentUser.id,
      );
    });
  });
});
