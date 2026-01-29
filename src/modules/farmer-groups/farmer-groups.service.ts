import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isValidSubCounty } from '../../common/constants/locations';

@Injectable()
export class FarmerGroupsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique farmer group code
   */
  private generateGroupCode(county: string, subCounty: string): string {
    const countyCode = county.substring(0, 3).toUpperCase().replace(/\s/g, '');
    const subCountyCode = subCounty.substring(0, 3).toUpperCase().replace(/\s/g, '');
    const timestamp = Date.now().toString().slice(-6);
    return `FG-${countyCode}-${subCountyCode}-${timestamp}`;
  }

  /**
   * Create a new farmer group
   */
  async create(data: {
    name: string;
    description?: string;
    county: string;
    subCounty: string;
    ward?: string;
    isActive?: boolean;
  }) {
    // Generate unique code
    const code = this.generateGroupCode(data.county, data.subCounty);

    return this.prisma.farmerGroup.create({
      data: {
        name: data.name,
        code,
        description: data.description,
        county: data.county,
        subCounty: data.subCounty,
        ward: data.ward,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Get all farmer groups with optional filters
   */
  async findAll(filters?: {
    county?: string;
    subCounty?: string;
    ward?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.county) {
      where.county = filters.county;
    }

    if (filters?.subCounty) {
      where.subCounty = filters.subCounty;
    }

    if (filters?.ward) {
      where.ward = filters.ward;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.farmerGroup.findMany({
      where,
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get farmer group by ID
   */
  async findById(id: string) {
    const group = await this.prisma.farmerGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Farmer group not found');
    }

    return group;
  }

  /**
   * Update farmer group
   */
  async update(id: string, data: {
    name?: string;
    description?: string;
    county?: string;
    subCounty?: string;
    ward?: string;
    isActive?: boolean;
  }) {
    // Validate subcounty if provided
    if (data.subCounty && !isValidSubCounty(data.subCounty)) {
      throw new BadRequestException(
        `Invalid subcounty. Valid subcounties are: ${['Kangundo', 'Kathiani', 'Masinga', 'Yatta'].join(', ')}`
      );
    }

    const group = await this.findById(id);

    return this.prisma.farmerGroup.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete farmer group (soft delete by setting isActive to false)
   */
  async delete(id: string) {
    const group = await this.findById(id);

    // Check if group has members
    const memberCount = await this.prisma.profile.count({
      where: { farmerGroupId: id },
    });

    if (memberCount > 0) {
      throw new BadRequestException(
        `Cannot delete farmer group with ${memberCount} members. Please reassign members first.`
      );
    }

    return this.prisma.farmerGroup.delete({
      where: { id },
    });
  }

  /**
   * Update member count for a group
   */
  async updateMemberCount(groupId: string) {
    const count = await this.prisma.profile.count({
      where: { farmerGroupId: groupId },
    });

    return this.prisma.farmerGroup.update({
      where: { id: groupId },
      data: { memberCount: count },
    });
  }
}
