import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    profile: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user with profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: '+254712345678',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { profile: true },
        omit: { password: true },
      });
    });

    it('should omit password from response', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: '+254712345678',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result.password).toBeUndefined();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          omit: { password: true },
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user with profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: '+254712345678',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { profile: true },
        omit: { password: true },
      });
    });

    it('should omit password from response', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: '+254712345678',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result?.password).toBeUndefined();
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
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

      mockPrismaService.profile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(userId, updateData);

      expect(result).toEqual(updatedProfile);
      expect(mockPrismaService.profile.update).toHaveBeenCalledWith({
        where: { userId },
        data: updateData,
      });
    });

    it('should throw NotFoundException if profile not found', async () => {
      const userId = 'non-existent-user';
      const updateData = {
        firstName: 'Jane',
      };

      mockPrismaService.profile.update.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.updateProfile(userId, updateData),
      ).rejects.toThrow();
    });
  });
});
