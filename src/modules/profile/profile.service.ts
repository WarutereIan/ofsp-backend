import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto, UpdateProfileDto } from './dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: id },
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

    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }

    return profile;
  }

  async findAll(filters?: {
    role?: string;
    county?: string;
    subcounty?: string;
    ward?: string;
  }) {
    const where: any = {};

    if (filters?.role) {
      // Map frontend role names to backend enum values
      const roleMapping: Record<string, string> = {
        'county_officer': 'EXTENSION_OFFICER',
        'extension_officer': 'EXTENSION_OFFICER',
      };
      
      // Use mapping if available, otherwise convert to uppercase
      const mappedRole = roleMapping[filters.role.toLowerCase()] || filters.role.toUpperCase();
      where.user = { role: mappedRole };
    }
    if (filters?.county) {
      where.county = filters.county;
    }
    if (filters?.subcounty) {
      where.subCounty = filters.subcounty; // Prisma schema uses subCounty (camelCase)
    }
    if (filters?.ward) {
      where.ward = filters.ward;
    }

    return this.prisma.profile.findMany({
      where,
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
  }

  async findFarmerProfile(userId: string) {
    return this.findById(userId);
  }

  async findBuyerProfile(userId: string) {
    return this.findById(userId);
  }

  async update(userId: string, data: UpdateProfileDto) {
    // Map DTO field names to Prisma schema field names
    const updateData: any = { ...data };
    if (updateData.subcounty !== undefined) {
      updateData.subCounty = updateData.subcounty;
      delete updateData.subcounty;
    }

    return this.prisma.profile.update({
      where: { userId },
      data: updateData,
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
  }

  async getRatingSummary(userId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { ratedUserId: userId },
    });

    const totalRatings = ratings.length;
    const averageRating =
      totalRatings > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
        : 0;

    return {
      userId,
      totalRatings,
      averageRating: Math.round(averageRating * 10) / 10,
      ratings: ratings.map((r) => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        createdAt: r.createdAt,
      })),
    };
  }

  async getRatings(filters?: {
    ratedUserId?: string;
    raterUserId?: string;
    minRating?: number;
    maxRating?: number;
  }) {
    const where: any = {};

    if (filters?.ratedUserId) {
      where.ratedUserId = filters.ratedUserId;
    }
    if (filters?.raterUserId) {
      where.raterUserId = filters.raterUserId;
    }
    if (filters?.minRating || filters?.maxRating) {
      where.rating = {};
      if (filters.minRating) {
        where.rating.gte = filters.minRating;
      }
      if (filters.maxRating) {
        where.rating.lte = filters.maxRating;
      }
    }

    return this.prisma.rating.findMany({
      where,
      include: {
        rater: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        ratedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRating(data: {
    raterUserId: string;
    ratedUserId: string;
    rating: number;
    comment?: string;
    orderId?: string;
  }) {
    return this.prisma.rating.create({
      data: {
        raterId: data.raterUserId,
        ratedUserId: data.ratedUserId,
        rating: data.rating,
        review: data.comment,
        orderId: data.orderId,
      },
      include: {
        rater: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        ratedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }
}
