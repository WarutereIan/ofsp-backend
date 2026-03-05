import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugify, normalizeLocationName } from '../../common/utils/slug.util';
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

  // ---------- Counties ----------
  async createCounty(dto: CreateCountyDto) {
    if (dto.code) {
      const existing = await this.prisma.county.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`County with code ${dto.code} already exists`);
    }
    const name = normalizeLocationName(dto.name);
    const baseSlug = slugify(name);
    const existingBySlug = await this.prisma.county.findFirst({ where: { slug: baseSlug } });
    if (existingBySlug) throw new ConflictException(`County "${name}" already exists (same name or slug).`);
    return this.prisma.county.create({
      data: { name, slug: baseSlug, code: dto.code ?? null },
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
      ...(dto.code !== undefined && { code: dto.code }),
    };
    if (dto.name != null) {
      const name = normalizeLocationName(dto.name);
      data.name = name;
      const baseSlug = slugify(name);
      const existingBySlug = await this.prisma.county.findFirst({
        where: { slug: baseSlug, id: { not: id } },
      });
      if (existingBySlug) throw new ConflictException(`County "${name}" already exists (same name or slug).`);
      data.slug = baseSlug;
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
    const name = normalizeLocationName(dto.name);
    const baseSlug = slugify(name);
    const existingByName = await this.prisma.subCounty.findUnique({
      where: { countyId_name: { countyId: dto.countyId, name } },
    });
    if (existingByName) throw new ConflictException(`SubCounty "${name}" already exists in this county`);
    const existingBySlug = await this.prisma.subCounty.findFirst({
      where: { countyId: dto.countyId, slug: baseSlug },
    });
    if (existingBySlug) throw new ConflictException(`SubCounty "${name}" already exists (same name or slug).`);
    return this.prisma.subCounty.create({
      data: { name, slug: baseSlug, countyId: dto.countyId },
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
    const name = dto.name != null ? normalizeLocationName(dto.name) : current.name;
    if (dto.countyId != null || dto.name != null) {
      const existing = await this.prisma.subCounty.findUnique({
        where: { countyId_name: { countyId, name } },
      });
      if (existing && existing.id !== id)
        throw new ConflictException(`SubCounty "${name}" already exists in this county`);
    }
    const data: { name?: string; countyId?: string; slug?: string } = {
      ...(dto.countyId != null && { countyId: dto.countyId }),
    };
    if (dto.name != null) {
      data.name = name;
      const baseSlug = slugify(name);
      const existingBySlug = await this.prisma.subCounty.findFirst({
        where: { countyId, slug: baseSlug, id: { not: id } },
      });
      if (existingBySlug) throw new ConflictException(`SubCounty "${name}" already exists (same name or slug).`);
      data.slug = baseSlug;
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
    const name = normalizeLocationName(dto.name);
    const baseSlug = slugify(name);
    const existingByName = await this.prisma.ward.findUnique({
      where: { subCountyId_name: { subCountyId: dto.subCountyId, name } },
    });
    if (existingByName) throw new ConflictException(`Ward "${name}" already exists in this sub-county`);
    const existingBySlug = await this.prisma.ward.findFirst({
      where: { subCountyId: dto.subCountyId, slug: baseSlug },
    });
    if (existingBySlug) throw new ConflictException(`Ward "${name}" already exists (same name or slug).`);
    return this.prisma.ward.create({
      data: { name, slug: baseSlug, subCountyId: dto.subCountyId },
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
    const name = dto.name != null ? normalizeLocationName(dto.name) : current.name;
    if (dto.subCountyId != null || dto.name != null) {
      const existing = await this.prisma.ward.findUnique({
        where: { subCountyId_name: { subCountyId, name } },
      });
      if (existing && existing.id !== id)
        throw new ConflictException(`Ward "${name}" already exists in this sub-county`);
    }
    const data: { name?: string; subCountyId?: string; slug?: string } = {
      ...(dto.subCountyId != null && { subCountyId: dto.subCountyId }),
    };
    if (dto.name != null) {
      data.name = name;
      const baseSlug = slugify(name);
      const existingBySlug = await this.prisma.ward.findFirst({
        where: { subCountyId, slug: baseSlug, id: { not: id } },
      });
      if (existingBySlug) throw new ConflictException(`Ward "${name}" already exists (same name or slug).`);
      data.slug = baseSlug;
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
    const name = normalizeLocationName(dto.name);
    const baseSlug = slugify(name);
    const existingByName = await this.prisma.village.findUnique({
      where: { wardId_name: { wardId: dto.wardId, name } },
    });
    if (existingByName) throw new ConflictException(`Village "${name}" already exists in this ward`);
    const existingBySlug = await this.prisma.village.findFirst({
      where: { wardId: dto.wardId, slug: baseSlug },
    });
    if (existingBySlug) throw new ConflictException(`Village "${name}" already exists (same name or slug).`);
    return this.prisma.village.create({
      data: { name, slug: baseSlug, wardId: dto.wardId },
    });
  }

  async findVillagesByWardId(wardId?: string) {
    // Do not include ward relation: orphan villages (ward deleted without cascade) would make
    // Prisma throw "Field ward is required to return data, got null". Client can resolve ward
    // from wardId using the wards list.
    return this.prisma.village.findMany({
      where: wardId ? { wardId } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findVillageById(id: string) {
    const village = await this.prisma.village.findUnique({
      where: { id },
      // Omit ward include so orphan villages (deleted ward) don't cause "Field ward is required, got null"
    });
    if (!village) throw new NotFoundException('Village not found');
    return village;
  }

  async updateVillage(id: string, dto: UpdateVillageDto) {
    const current = await this.findVillageById(id);
    const wardId = dto.wardId ?? current.wardId;
    const name = dto.name != null ? normalizeLocationName(dto.name) : current.name;
    if (dto.wardId != null || dto.name != null) {
      const existing = await this.prisma.village.findUnique({
        where: { wardId_name: { wardId, name } },
      });
      if (existing && existing.id !== id)
        throw new ConflictException(`Village "${name}" already exists in this ward`);
    }
    const data: { name?: string; wardId?: string; slug?: string } = {
      ...(dto.wardId != null && { wardId: dto.wardId }),
    };
    if (dto.name != null) {
      data.name = name;
      const baseSlug = slugify(name);
      const existingBySlug = await this.prisma.village.findFirst({
        where: { wardId, slug: baseSlug, id: { not: id } },
      });
      if (existingBySlug) throw new ConflictException(`Village "${name}" already exists (same name or slug).`);
      data.slug = baseSlug;
    }
    return this.prisma.village.update({
      where: { id },
      data,
    });
  }

  async deleteVillage(id: string) {
    await this.findVillageById(id);
    return this.prisma.village.delete({ where: { id } });
  }
}
