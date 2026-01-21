import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  mockProfile,
  mockRating,
  mockUser,
} from '../../test/test-utils';

describe('ProfileController', () => {
  let controller: ProfileController;
  let service: ProfileService;

  const mockProfileService = {
    findById: jest.fn(),
    findAll: jest.fn(),
    findFarmerProfile: jest.fn(),
    findBuyerProfile: jest.fn(),
    update: jest.fn(),
    getRatingSummary: jest.fn(),
    getRatings: jest.fn(),
    createRating: jest.fn(),
  };

  const mockCurrentUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'FARMER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: mockProfileService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ProfileController>(ProfileController);
    service = module.get<ProfileService>(ProfileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all profiles', async () => {
      mockProfileService.findAll.mockResolvedValue([mockProfile]);

      const result = await controller.findAll();

      expect(result).toEqual([mockProfile]);
      expect(service.findAll).toHaveBeenCalledWith();
    });

    it('should filter profiles by role', async () => {
      mockProfileService.findAll.mockResolvedValue([mockProfile]);

      await controller.findAll('FARMER');

      expect(service.findAll).toHaveBeenCalledWith({ role: 'FARMER' });
    });
  });

  describe('findById', () => {
    it('should return a profile by ID', async () => {
      mockProfileService.findById.mockResolvedValue(mockProfile);

      const result = await controller.findById('user-1');

      expect(result).toEqual(mockProfile);
      expect(service.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockProfileService.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllFarmers', () => {
    it('should return all farmer profiles', async () => {
      mockProfileService.findAll.mockResolvedValue([mockProfile]);

      const result = await controller.findAllFarmers();

      expect(result).toEqual([mockProfile]);
      expect(service.findAll).toHaveBeenCalledWith({
        role: 'FARMER',
        county: undefined,
        subcounty: undefined,
        ward: undefined,
      });
    });
  });

  describe('findAllBuyers', () => {
    it('should return all buyer profiles', async () => {
      mockProfileService.findAll.mockResolvedValue([mockProfile]);

      const result = await controller.findAllBuyers();

      expect(result).toEqual([mockProfile]);
      expect(service.findAll).toHaveBeenCalledWith({
        role: 'BUYER',
        county: undefined,
        subcounty: undefined,
        ward: undefined,
      });
    });
  });

  describe('update', () => {
    it('should update profile when user owns it', async () => {
      const updateData = { firstName: 'Jane' };
      const updatedProfile = { ...mockProfile, ...updateData };

      mockProfileService.update.mockResolvedValue(updatedProfile);

      const result = await controller.update(
        'user-1',
        updateData,
        mockCurrentUser,
      );

      expect(result).toEqual(updatedProfile);
      expect(service.update).toHaveBeenCalledWith('user-1', updateData);
    });

    it('should throw error when user tries to update another profile', async () => {
      const updateData = { firstName: 'Jane' };

      await expect(
        controller.update('user-2', updateData, mockCurrentUser),
      ).rejects.toThrow('Unauthorized to update this profile');
    });
  });

  describe('getRatings', () => {
    it('should return ratings for a user', async () => {
      mockProfileService.getRatings.mockResolvedValue([mockRating]);

      const result = await controller.getRatings('user-1');

      expect(result).toEqual([mockRating]);
      expect(service.getRatings).toHaveBeenCalledWith({
        ratedUserId: 'user-1',
        minRating: undefined,
        maxRating: undefined,
      });
    });
  });

  describe('getRatingSummary', () => {
    it('should return rating summary', async () => {
      const summary = {
        userId: 'user-1',
        totalRatings: 10,
        averageRating: 4.5,
        ratings: [],
      };

      mockProfileService.getRatingSummary.mockResolvedValue(summary);

      const result = await controller.getRatingSummary('user-1');

      expect(result).toEqual(summary);
      expect(service.getRatingSummary).toHaveBeenCalledWith('user-1');
    });
  });

  describe('createRating', () => {
    it('should create a rating', async () => {
      const ratingData = {
        rating: 5,
        comment: 'Great!',
        orderId: 'order-1',
      };

      mockProfileService.createRating.mockResolvedValue(mockRating);

      const result = await controller.createRating(
        'user-1',
        ratingData,
        mockCurrentUser,
      );

      expect(result).toEqual(mockRating);
      expect(service.createRating).toHaveBeenCalledWith({
        raterUserId: mockCurrentUser.id,
        ratedUserId: 'user-1',
        ...ratingData,
      });
    });
  });
});
