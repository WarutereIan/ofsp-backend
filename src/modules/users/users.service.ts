import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import { isValidSubCounty } from '../../common/constants/locations';


@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
      },
      omit: {
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
      omit: {
        password: true,
      },
    });
  }

  /**
   * Get all users with optional filters (admin/staff only)
   */
  async findAll(filters?: {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        {
          profile: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    return this.prisma.user.findMany({
      where,
      include: {
        profile: true,
      },
      omit: {
        password: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateProfile(userId: string, data: any) {
    return this.prisma.profile.update({
      where: { userId },
      data,
    });
  }

  /**
   * Create a new user (admin only)
   */
  async createUser(data: {
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    profile: {
      firstName: string;
      lastName: string;
      county?: string;
      subcounty?: string;
      ward?: string;
      farmerGroupId?: string;
      aggregationCenterId?: string;
      assignedCounty?: string;
      assignedSubCounty?: string;
      hasAllAccess?: boolean;
    };
  }) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phone: data.phone }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email or phone already exists');
    }

    // Validate assignments based on role
    if (data.role === UserRole.AGGREGATION_MANAGER && !data.profile.aggregationCenterId) {
      throw new BadRequestException('Aggregation center assignment is mandatory for aggregation managers');
    }

    // Validate farmer group exists if provided
    if (data.profile.farmerGroupId) {
      const farmerGroup = await this.prisma.farmerGroup.findUnique({
        where: { id: data.profile.farmerGroupId },
      });
      if (!farmerGroup) {
        throw new BadRequestException('Farmer group not found');
      }
    }

    // Validate aggregation center exists if provided
    if (data.profile.aggregationCenterId) {
      const center = await this.prisma.aggregationCenter.findUnique({
        where: { id: data.profile.aggregationCenterId },
      });
      if (!center) {
        throw new BadRequestException('Aggregation center not found');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user with profile
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        role: data.role,
        status: UserStatus.ACTIVE, // Admin-created users are active by default
        profile: {
          create: {
            firstName: data.profile.firstName,
            lastName: data.profile.lastName,
            county: data.profile.county,
            subCounty: data.profile.subcounty,
            ward: data.profile.ward,
            farmerGroupId: data.profile.farmerGroupId,
            aggregationCenterId: data.profile.aggregationCenterId,
            assignedCounty: data.profile.assignedCounty,
            assignedSubCounty: data.profile.assignedSubCounty,
            hasAllAccess: data.profile.hasAllAccess ?? false,
          },
        },
      },
      include: {
        profile: {
          include: {
            farmerGroup: true,
            aggregationCenter: true,
          },
        },
      },
      omit: {
        password: true,
      },
    });

    // Update farmer group member count if assigned
    if (data.profile.farmerGroupId) {
      await this.updateFarmerGroupMemberCount(data.profile.farmerGroupId);
    }

    return user;
  }

  /**
   * Update farmer group member count
   */
  private async updateFarmerGroupMemberCount(groupId: string) {
    const count = await this.prisma.profile.count({
      where: { farmerGroupId: groupId },
    });

    await this.prisma.farmerGroup.update({
      where: { id: groupId },
      data: { memberCount: count },
    });
  }

  /**
   * Update user status (admin only)
   */
  async updateUserStatus(userId: string, status: UserStatus) {
    const user = await this.findById(userId);
    
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      include: {
        profile: true,
      },
      omit: {
        password: true,
      },
    });
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.findById(userId);
    
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        profile: true,
      },
      omit: {
        password: true,
      },
    });
  }

  /**
   * Reset user password (admin only)
   */
  async resetPassword(userId: string, newPassword: string) {
    const user = await this.findById(userId);
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      include: {
        profile: true,
      },
      omit: {
        password: true,
      },
    });
  }

  /**
   * Delete a user (admin/staff only). Profile is cascade-deleted.
   * Fails if user has related data (orders, etc.) that prevent deletion.
   */
  async deleteUser(userId: string) {
    await this.findById(userId); // throws if not found
    try {
      await this.prisma.user.delete({
        where: { id: userId },
      });
    } catch (err: any) {
      if (err?.code === 'P2003' || err?.message?.includes('foreign key')) {
        throw new BadRequestException(
          'Cannot delete user: they have related data (orders, listings, etc.). Deactivate the user instead.',
        );
      }
      throw err;
    }
  }

  /**
   * Update user (admin only) - can update multiple fields
   */
  async updateUser(userId: string, data: {
    email?: string;
    phone?: string;
    role?: UserRole;
    status?: UserStatus;
    profile?: {
      subcounty?: string;
      farmerGroupId?: string;
      aggregationCenterId?: string;
      assignedCounty?: string;
      assignedSubCounty?: string;
      hasAllAccess?: boolean;
    };
  }) {
    const user = await this.findById(userId);
    
    // Check if email/phone already exists (if being updated)
    if (data.email || data.phone) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                ...(data.email ? [{ email: data.email }] : []),
                ...(data.phone ? [{ phone: data.phone }] : []),
              ],
            },
          ],
        },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email or phone already exists');
      }
    }

    // Validate assignments if provided
    if (data.profile?.farmerGroupId) {
      const farmerGroup = await this.prisma.farmerGroup.findUnique({
        where: { id: data.profile.farmerGroupId },
      });
      if (!farmerGroup) {
        throw new BadRequestException('Farmer group not found');
      }
    }

    if (data.profile?.aggregationCenterId) {
      const center = await this.prisma.aggregationCenter.findUnique({
        where: { id: data.profile.aggregationCenterId },
      });
      if (!center) {
        throw new BadRequestException('Aggregation center not found');
      }
    }

    // Validate subcounty if provided
    if (data.profile?.subcounty && !isValidSubCounty(data.profile.subcounty)) {
      throw new BadRequestException(
        `Invalid subcounty. Valid subcounties are: ${['Kangundo', 'Kathiani', 'Masinga', 'Yatta'].join(', ')}`
      );
    }

    // Validate assigned subcounty for county staff
    if (data.profile?.assignedSubCounty && !isValidSubCounty(data.profile.assignedSubCounty)) {
      throw new BadRequestException(
        `Invalid assigned subcounty. Valid subcounties are: ${['Kangundo', 'Kathiani', 'Masinga', 'Yatta'].join(', ')}`
      );
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.phone && { phone: data.phone }),
        ...(data.role && { role: data.role }),
        ...(data.status && { status: data.status }),
        ...(data.profile && {
          profile: {
            update: {
              ...(data.profile.farmerGroupId !== undefined && { farmerGroupId: data.profile.farmerGroupId }),
              ...(data.profile.aggregationCenterId !== undefined && { aggregationCenterId: data.profile.aggregationCenterId }),
              ...(data.profile.assignedCounty !== undefined && { assignedCounty: data.profile.assignedCounty }),
              ...(data.profile.assignedSubCounty !== undefined && { assignedSubCounty: data.profile.assignedSubCounty }),
              ...(data.profile.hasAllAccess !== undefined && { hasAllAccess: data.profile.hasAllAccess }),
            },
          },
        }),
      },
      include: {
        profile: {
          include: {
            farmerGroup: true,
            aggregationCenter: true,
          },
        },
      },
      omit: {
        password: true,
      },
    });

    // Update farmer group member count if farmer group changed
    if (data.profile?.farmerGroupId !== undefined && user.profile?.farmerGroupId) {
      await this.updateFarmerGroupMemberCount(user.profile.farmerGroupId);
    }
    if (data.profile?.farmerGroupId) {
      await this.updateFarmerGroupMemberCount(data.profile.farmerGroupId);
    }
    
    return updatedUser;
  }

  /**
   * Parse CSV buffer into array of row objects (first row = headers).
   * Handles quoted fields and \r\n.
   */
  private parseCsvToRows(buffer: Buffer): Record<string, string>[] {
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const fields: string[] = [];
      let i = 0;
      while (i < line.length) {
        if (line[i] === '"') {
          let end = i + 1;
          while (end < line.length && (line[end] !== '"' || line[end + 1] === '"')) {
            if (line[end] === '"' && line[end + 1] === '"') end += 2;
            else end += 1;
          }
          fields.push(line.slice(i + 1, end).replace(/""/g, '"').trim());
          i = end + 1;
          if (line[i] === ',') i += 1;
        } else {
          const comma = line.indexOf(',', i);
          const end = comma === -1 ? line.length : comma;
          fields.push(line.slice(i, end).trim());
          i = comma === -1 ? line.length : comma + 1;
        }
      }
      return fields;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const rows: Record<string, string>[] = [];
    for (let r = 1; r < lines.length; r++) {
      const values = parseLine(lines[r]);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? '';
      });
      rows.push(row);
    }
    return rows;
  }

  /**
   * Bulk create farmer users from CSV buffer.
   * Expected columns: name, phone, password (optional), email (optional), farmer_group_code (optional), county, subcounty, ward (all optional except name, phone).
   */
  async bulkCreateFarmers(csvBuffer: Buffer): Promise<{
    created: number;
    failed: number;
    errors: { row: number; message: string }[];
  }> {
    const rows = this.parseCsvToRows(csvBuffer);
    const errors: { row: number; message: string }[] = [];
    let created = 0;

    const normalizePhone = (p: string) => p.replace(/\s+/g, '').trim();
    const sanitizeForEmail = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-based + header
      const name = (row.name ?? row.full_name ?? '').trim();
      const phone = normalizePhone(row.phone ?? row.phone_number ?? '');
      const passwordRaw = (row.password ?? row.pwd ?? '').trim();
      const emailRaw = (row.email ?? '').trim();
      const farmerGroupCode = (row.farmer_group_code ?? row.farmer_group ?? row.group_code ?? '').trim();
      const county = (row.county ?? '').trim();
      const subcounty = (row.subcounty ?? row.sub_county ?? '').trim();
      const ward = (row.ward ?? '').trim();

      if (!name) {
        errors.push({ row: rowNum, message: 'Name is required' });
        continue;
      }
      if (!phone) {
        errors.push({ row: rowNum, message: 'Phone is required' });
        continue;
      }

      const nameParts = name.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ?? '';
      const lastName = nameParts.slice(1).join(' ') ?? '';
      const email = emailRaw || `${sanitizeForEmail(phone)}-${rowNum}@farmer.bulk`;

      if (passwordRaw && passwordRaw.length < 8) {
        errors.push({ row: rowNum, message: 'Password must be at least 8 characters when provided' });
        continue;
      }

      const password = passwordRaw || `Temp${Math.random().toString(36).slice(-8)}!`;

      let farmerGroupId: string | undefined;
      if (farmerGroupCode) {
        const group = await this.prisma.farmerGroup.findUnique({
          where: { code: farmerGroupCode },
        });
        if (!group) {
          errors.push({ row: rowNum, message: `Farmer group not found: ${farmerGroupCode}` });
          continue;
        }
        farmerGroupId = group.id;
      }

      if (subcounty && !isValidSubCounty(subcounty)) {
        errors.push({
          row: rowNum,
          message: `Invalid subcounty: ${subcounty}. Valid: Kangundo, Kathiani, Masinga, Yatta`,
        });
        continue;
      }

      try {
        await this.createUser({
          email,
          phone,
          password,
          role: UserRole.FARMER,
          profile: {
            firstName,
            lastName,
            county: county || undefined,
            subcounty: subcounty || undefined,
            ward: ward || undefined,
            farmerGroupId,
          },
        });
        created += 1;
      } catch (err: any) {
        errors.push({
          row: rowNum,
          message: err?.message ?? 'Failed to create user',
        });
      }
    }

    return {
      created,
      failed: errors.length,
      errors,
    };
  }
}
