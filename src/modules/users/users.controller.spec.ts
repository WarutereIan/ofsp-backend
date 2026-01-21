import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    updateProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const userId = 'user-1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        phone: '+254712345678',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          id: 'profile-1',
          userId,
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getProfile(userId);

      expect(result).toEqual(mockUser);
      expect(service.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('PATCH /users/me', () => {
    it('should update current user profile', async () => {
      const userId = 'user-1';
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        county: 'Mombasa',
      };

      const updatedProfile = {
        id: 'profile-1',
        userId,
        ...updateData,
        updatedAt: new Date(),
      };

      mockUsersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(userId, updateData);

      expect(result).toEqual(updatedProfile);
      expect(service.updateProfile).toHaveBeenCalledWith(userId, updateData);
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by ID', async () => {
      const userId = 'user-1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        phone: '+254712345678',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          id: 'profile-1',
          userId,
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getUserById(userId);

      expect(result).toEqual(mockUser);
      expect(service.findById).toHaveBeenCalledWith(userId);
    });

    it('should return 404 if not found', async () => {
      mockUsersService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getUserById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(service.findById).toHaveBeenCalledWith('non-existent-id');
    });

    it('should omit password', async () => {
      const userId = 'user-1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        phone: '+254712345678',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          id: 'profile-1',
          userId,
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getUserById(userId);

      expect(result.password).toBeUndefined();
    });
  });
});
