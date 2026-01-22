import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrismaService, mockProfile, mockRating, mockUser } from '../../test/test-utils';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    // Extend mockPrismaService with rating model
    const extendedMockPrisma = {
      ...mockPrismaService,
      rating: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: extendedMockPrisma,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a profile when found', async () => {
      prisma.profile.findUnique = jest.fn().mockResolvedValue(mockProfile);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockProfile);
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when profile not found', async () => {
      prisma.profile.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all profiles without filters', async () => {
      prisma.profile.findMany = jest.fn().mockResolvedValue([mockProfile]);

      const result = await service.findAll();

      expect(result).toEqual([mockProfile]);
      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
    });

    it('should filter by role', async () => {
      prisma.profile.findMany = jest.fn().mockResolvedValue([mockProfile]);

      await service.findAll({ role: 'FARMER' });

      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: {
          user: { role: 'FARMER' },
        },
        include: expect.any(Object),
      });
    });

    it('should filter by county', async () => {
      prisma.profile.findMany = jest.fn().mockResolvedValue([mockProfile]);

      await service.findAll({ county: 'Nairobi' });

      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: { county: 'Nairobi' },
        include: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    it('should update profile successfully', async () => {
      const updateData = { firstName: 'Jane', lastName: 'Smith' };
      const updatedProfile = { ...mockProfile, ...updateData };

      prisma.profile.update = jest.fn().mockResolvedValue(updatedProfile);

      const result = await service.update('user-1', updateData);

      expect(result).toEqual(updatedProfile);
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: updateData,
        include: expect.any(Object),
      });
    });
  });

  describe('getRatingSummary', () => {
    it('should return rating summary', async () => {
      const ratings = [
        { id: 'rating-1', rating: 5, review: 'Great!', createdAt: new Date() },
        { id: 'rating-2', rating: 4, review: 'Good', createdAt: new Date() },
        { id: 'rating-3', rating: 5, review: 'Excellent', createdAt: new Date() },
      ];

      prisma.rating.findMany = jest.fn().mockResolvedValue(ratings);

      const result = await service.getRatingSummary('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.totalRatings).toBe(3);
      expect(result.averageRating).toBeCloseTo(4.67, 1);
      expect(prisma.rating.findMany).toHaveBeenCalledWith({
        where: { ratedUserId: 'user-1' },
      });
    });

    it('should return zero ratings when no ratings exist', async () => {
      prisma.rating.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getRatingSummary('user-1');

      expect(result.totalRatings).toBe(0);
      expect(result.averageRating).toBe(0);
    });

    it('should calculate average rating correctly with single rating', async () => {
      const ratings = [
        { id: 'rating-1', rating: 4, review: 'Good', createdAt: new Date() },
      ];

      prisma.rating.findMany = jest.fn().mockResolvedValue(ratings);

      const result = await service.getRatingSummary('user-1');

      expect(result.totalRatings).toBe(1);
      expect(result.averageRating).toBe(4);
    });

    it('should round average rating to one decimal place', async () => {
      const ratings = [
        { id: 'rating-1', rating: 5, review: 'Great', createdAt: new Date() },
        { id: 'rating-2', rating: 4, review: 'Good', createdAt: new Date() },
        { id: 'rating-3', rating: 3, review: 'Average', createdAt: new Date() },
      ];

      prisma.rating.findMany = jest.fn().mockResolvedValue(ratings);

      const result = await service.getRatingSummary('user-1');

      expect(result.averageRating).toBe(4); // (5+4+3)/3 = 4.0
    });

    it('should handle ratings with all 5 stars', async () => {
      const ratings = [
        { id: 'rating-1', rating: 5, review: 'Excellent', createdAt: new Date() },
        { id: 'rating-2', rating: 5, review: 'Perfect', createdAt: new Date() },
        { id: 'rating-3', rating: 5, review: 'Amazing', createdAt: new Date() },
      ];

      prisma.rating.findMany = jest.fn().mockResolvedValue(ratings);

      const result = await service.getRatingSummary('user-1');

      expect(result.totalRatings).toBe(3);
      expect(result.averageRating).toBe(5);
    });

    it('should handle ratings with all 1 star', async () => {
      const ratings = [
        { id: 'rating-1', rating: 1, review: 'Poor', createdAt: new Date() },
        { id: 'rating-2', rating: 1, review: 'Bad', createdAt: new Date() },
      ];

      prisma.rating.findMany = jest.fn().mockResolvedValue(ratings);

      const result = await service.getRatingSummary('user-1');

      expect(result.totalRatings).toBe(2);
      expect(result.averageRating).toBe(1);
    });
  });

  describe('getRatings', () => {
    it('should return ratings with filters', async () => {
      prisma.rating.findMany = jest.fn().mockResolvedValue([mockRating]);

      const result = await service.getRatings({
        ratedUserId: 'user-1',
        minRating: 4,
        maxRating: 5,
      });

      expect(result).toEqual([mockRating]);
      expect(prisma.rating.findMany).toHaveBeenCalledWith({
        where: {
          ratedUserId: 'user-1',
          rating: {
            gte: 4,
            lte: 5,
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('createRating', () => {
    it('should create a rating successfully', async () => {
      const ratingData = {
        raterUserId: 'user-2',
        ratedUserId: 'user-1',
        rating: 5,
        comment: 'Excellent service!',
        orderId: 'order-1',
      };

      prisma.rating.create = jest.fn().mockResolvedValue(mockRating);

      const result = await service.createRating(ratingData);

      expect(result).toEqual(mockRating);
      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          raterId: ratingData.raterUserId,
          ratedUserId: ratingData.ratedUserId,
          rating: ratingData.rating,
          review: ratingData.comment,
          orderId: ratingData.orderId,
        },
        include: expect.any(Object),
      });
    });

    it('should create rating with minimum value (1)', async () => {
      const ratingData = {
        raterUserId: 'user-2',
        ratedUserId: 'user-1',
        rating: 1,
        comment: 'Poor service',
      };

      const mockRatingMin = { ...mockRating, rating: 1 };
      prisma.rating.create = jest.fn().mockResolvedValue(mockRatingMin);

      const result = await service.createRating(ratingData);

      expect(result.rating).toBe(1);
      expect(prisma.rating.create).toHaveBeenCalled();
    });

    it('should create rating with maximum value (5)', async () => {
      const ratingData = {
        raterUserId: 'user-2',
        ratedUserId: 'user-1',
        rating: 5,
        comment: 'Excellent service',
      };

      prisma.rating.create = jest.fn().mockResolvedValue(mockRating);

      const result = await service.createRating(ratingData);

      expect(result.rating).toBe(5);
      expect(prisma.rating.create).toHaveBeenCalled();
    });

    it('should create rating without comment', async () => {
      const ratingData = {
        raterUserId: 'user-2',
        ratedUserId: 'user-1',
        rating: 4,
      };

      const mockRatingNoComment = { ...mockRating, review: null };
      prisma.rating.create = jest.fn().mockResolvedValue(mockRatingNoComment);

      const result = await service.createRating(ratingData);

      expect(result).toBeDefined();
      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          raterId: ratingData.raterUserId,
          ratedUserId: ratingData.ratedUserId,
          rating: ratingData.rating,
          review: undefined,
          orderId: undefined,
        },
        include: expect.any(Object),
      });
    });

    it('should create rating without orderId', async () => {
      const ratingData = {
        raterUserId: 'user-2',
        ratedUserId: 'user-1',
        rating: 4,
        comment: 'Good service',
      };

      const mockRatingNoOrder = { ...mockRating, orderId: null };
      prisma.rating.create = jest.fn().mockResolvedValue(mockRatingNoOrder);

      const result = await service.createRating(ratingData);

      expect(result).toBeDefined();
      expect(prisma.rating.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update profile with allowed fields for any role', async () => {
      const updateData = { firstName: 'Jane', lastName: 'Smith', bio: 'Updated bio' };
      const updatedProfile = { ...mockProfile, ...updateData };

      prisma.profile.update = jest.fn().mockResolvedValue(updatedProfile);

      const result = await service.update('user-1', updateData);

      expect(result).toEqual(updatedProfile);
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: updateData,
        include: expect.any(Object),
      });
    });

    it('should update profile location fields', async () => {
      const updateData = {
        county: 'Kiambu',
        subcounty: 'Thika',
        ward: 'Thika West',
        location: 'Thika Town',
      };
      const updatedProfile = { ...mockProfile, ...updateData };

      prisma.profile.update = jest.fn().mockResolvedValue(updatedProfile);

      const result = await service.update('user-1', updateData);

      expect(result.county).toBe('Kiambu');
      expect(result.subcounty).toBe('Thika');
      expect(prisma.profile.update).toHaveBeenCalled();
    });

    it('should update profile business fields', async () => {
      const updateData = {
        businessName: 'Test Business',
        businessRegistrationNumber: 'REG-12345',
      };
      const updatedProfile = { ...mockProfile, ...updateData };

      prisma.profile.update = jest.fn().mockResolvedValue(updatedProfile);

      const result = await service.update('user-1', updateData);

      expect(result.businessName).toBe('Test Business');
      expect(prisma.profile.update).toHaveBeenCalled();
    });
  });
});
