import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../../common/utils/slug.util';
import type {
  CreateCountyDto,
  UpdateCountyDto,
  CreateSubCountyDto,
  UpdateSubCountyDto,
  CreateWardDto,
  UpdateWardDto,
  CreateVillageDto,
  UpdateVillageDto,
} from './dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUniqueCountySlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug || 'county';
    let n = 0;
    while (true) {
      const existing = await this.prisma.county.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${++n}`;
    }
  }

  private async ensureUniqueSubCountySlug(countyId: string, baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug || 'subcounty';
    let n = 0;
    while (true) {
      const existing = await this.prisma.subCounty.findFirst({
        where: { countyId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${++n}`;
    }
  }

  private async ensureUniqueWardSlug(subCountyId: string, baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug || 'ward';
    let n = 0;
    while (true) {
      const existing = await this.prisma.ward.findFirst({
        where: { subCountyId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${++n}`;
    }
  }

  private async ensureUniqueVillageSlug(wardId: string, baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug || 'village';
    let n = 0;
    while (true) {
      const existing = await this.prisma.village.findFirst({
        where: { wardId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${++n}`;
    }
  }

  // ---------- Counties ----------
  async createCounty(dto: CreateCountyDto) {
    if (dto.code) {
      const existing = await this.prisma.county.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`County with code ${dto.code} already exists`);
    }
    const slug = await this.ensureUniqueCountySlug(slugify(dto.name));
    return this.prisma.county.create({
      data: { name: dto.name, slug, code: dto.code ?? null },
    });
  }

  async findAllCounties() {
    return this.prisma.county.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { subCounties: true } } },
    });
  }

  async findCountyById(id: string) {
    const county = await this.prisma.county.findUnique({
      where: { id },
      include: { subCounties: { orderBy: { name: 'asc' } } },
    });
    if (!county) throw new NotFoundException('County not found');
    return county;
  }

  async updateCounty(id: string, dto: UpdateCountyDto) {
    await this.findCountyById(id);
    if (dto.code != null) {
      const existing = await this.prisma.county.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (existing) throw new ConflictException(`County with code ${dto.code} already exists`);
    }
    const data: { name?: string; code?: string | null; slug?: string } = {
      ...(dto.name != null && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
    };
    if (dto.name != null) {
      data.slug = await this.ensureUniqueCountySlug(slugify(dto.name), id);
    }
    return this.prisma.county.update({
      where: { id },
      data,
    });
  }

  async deleteCounty(id: string) {
    await this.findCountyById(id);
    return this.prisma.county.delete({ where: { id } });
  }

  // ---------- SubCounties ----------
  async createSubCounty(dto: CreateSubCountyDto) {
    await this.prisma.county.findUniqueOrThrow({ where: { id: dto.countyId } });
    const existing = await this.prisma.subCounty.findUnique({
      where: { countyId_name: { countyId: dto.countyId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`SubCounty "${dto.name}" already exists in this county`);
    const slug = await this.ensureUniqueSubCountySlug(dto.countyId, slugify(dto.name));
    return this.prisma.subCounty.create({
      data: { name: dto.name, slug, countyId: dto.countyId },
      include: { county: true },
    });
  }

  async findSubCountiesByCountyId(countyId?: string) {
    return this.prisma.subCounty.findMany({
      where: countyId ? { countyId } : undefined,
      orderBy: { name: 'asc' },
      include: { county: true, _count: { select: { wards: true } } },
    });
  }

  async findSubCountyById(id: string) {
    const sub = await this.prisma.subCounty.findUnique({
      where: { id },
      include: { county: true, wards: { orderBy: { name: 'asc' } } },
    });
    if (!sub) throw new NotFoundException('SubCounty not found');
    return sub;
  }

  async updateSubCounty(id: string, dto: UpdateSubCountyDto) {
    const current = await this.findSubCountyById(id);
    const countyId = dto.countyId ?? current.countyId;
    const name = dto.name ?? current.name;
    if (dto.countyId != null && dto.name != null) {
      const existing = await this.prisma.subCounty.findUnique({
        where: { countyId_name: { countyId, name } },
      });
      if (existing && existing.id !== id)
        throw new ConflictException(`SubCounty "${name}" already exists in this county`);
    }
    const data: { name?: string; countyId?: string; slug?: string } = {
      ...(dto.name != null && { name: dto.name }),
      ...(dto.countyId != null && { countyId: dto.countyId }),
    };
    if (dto.name != null) {
      data.slug = await this.ensureUniqueSubCountySlug(countyId, slugify(dto.name), id);
    }
    return this.prisma.subCounty.update({
      where: { id },
      data,
      include: { county: true },
    });
  }

  async deleteSubCounty(id: string) {
    await this.findSubCountyById(id);
    return this.prisma.subCounty.delete({ where: { id } });
  }

  // ---------- Wards ----------
  async createWard(dto: CreateWardDto) {
    await this.prisma.subCounty.findUniqueOrThrow({ where: { id: dto.subCountyId } });
    const existing = await this.prisma.ward.findUnique({
      where: { subCountyId_name: { subCountyId: dto.subCountyId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Ward "${dto.name}" already exists in this sub-county`);
    const slug = await this.ensureUniqueWardSlug(dto.subCountyId, slugify(dto.name));
    return this.prisma.ward.create({
      data: { name: dto.name, slug, subCountyId: dto.subCountyId },
      include: { subCounty: { include: { county: true } } },
    });
  }

  async findWardsBySubCountyId(subCountyId?: string) {
    return this.prisma.ward.findMany({
      where: subCountyId ? { subCountyId } : undefined,
      orderBy: { name: 'asc' },
      include: { subCounty: true, _count: { select: { villages: true } } },
    });
  }

  async findWardById(id: string) {
    const ward = await this.prisma.ward.findUnique({
      where: { id },
      include: {
        subCounty: { include: { county: true } },
        villages: { orderBy: { name: 'asc' } },
      },
    });
    if (!ward) throw new NotFoundException('Ward not found');
    return ward;
  }

  async updateWard(id: string, dto: UpdateWardDto) {
    const current = await this.findWardById(id);
    const subCountyId = dto.subCountyId ?? current.subCountyId;
    if (dto.subCountyId != null && dto.name != null) {
      const existing = await this.prisma.ward.findUnique({
        where: { subCountyId_name: { subCountyId, name: dto.name } },
      });
      if (existing && existing.id !== id)
        throw new ConflictException(`Ward "${dto.name}" already exists in this sub-county`);
    }
    const data: { name?: string; subCountyId?: string; slug?: string } = {
      ...(dto.name != null && { name: dto.name }),
      ...(dto.subCountyId != null && { subCountyId: dto.subCountyId }),
    };
    if (dto.name != null) {
      data.slug = await this.ensureUniqueWardSlug(subCountyId, slugify(dto.name), id);
    }
    return this.prisma.ward.update({
      where: { id },
      data,
      include: { subCounty: { include: { county: true } } },
    });
  }

  async deleteWard(id: string) {
    await this.findWardById(id);
    return this.prisma.ward.delete({ where: { id } });
  }

  // ---------- Villages ----------
  async createVillage(dto: CreateVillageDto) {
    await this.prisma.ward.findUniqueOrThrow({ where: { id: dto.wardId } });
    const existing = await this.prisma.village.findUnique({
      where: { wardId_name: { wardId: dto.wardId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Village "${dto.name}" already exists in this ward`);
    const slug = await this.ensureUniqueVillageSlug(dto.wardId, slugify(dto.name));
    return this.prisma.village.create({
      data: { name: dto.name, slug, wardId: dto.wardId },
      include: { ward: { include: { subCounty: { include: { county: true } } } } },
    });
  }

  async findVillagesByWardId(wardId?: string) {
    return this.prisma.village.findMany({
      where: wardId ? { wardId } : undefined,
      orderBy: { name: 'asc' },
      include: { ward: true },
    });
  }

  async findVillageById(id: string) {
    const village = await this.prisma.village.findUnique({
      where: { id },
      include: { ward: { include: { subCounty: { include: { county: true } } } } },
    });
    if (!village) throw new NotFoundException('Village not found');
    return village;
  }

  async updateVillage(id: string, dto: UpdateVillageDto) {
    const current = await this.findVillageById(id);
    const wardId = dto.wardId ?? current.wardId;
    if (dto.wardId != null && dto.name != null) {
      const existing = await this.prisma.village.findUnique({
        where: { wardId_name: { wardId, name: dto.name } },
      });
      if (existing && existing.id !== id)
        throw new ConflictException(`Village "${dto.name}" already exists in this ward`);
    }
    const data: { name?: string; wardId?: string; slug?: string } = {
      ...(dto.name != null && { name: dto.name }),
      ...(dto.wardId != null && { wardId: dto.wardId }),
    };
    if (dto.name != null) {
      data.slug = await this.ensureUniqueVillageSlug(wardId, slugify(dto.name), id);
    }
    return this.prisma.village.update({
      where: { id },
      data,
      include: { ward: { include: { subCounty: { include: { county: true } } } } },
    });
  }

  async deleteVillage(id: string) {
    await this.findVillageById(id);
    return this.prisma.village.delete({ where: { id } });
  }
}
