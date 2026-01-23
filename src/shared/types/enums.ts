/**
 * Centralized Enum Type Definitions
 * 
 * This file contains shared enum types used across the backend.
 * These enums should match the Prisma schema definitions.
 */

/**
 * OFSP Variety Enum
 * Matches Prisma schema OFSPVariety enum
 */
export enum OFSPVariety {
  KENYA = 'KENYA',
  SPK004 = 'SPK004',
  KAKAMEGA = 'KAKAMEGA',
  KABODE = 'KABODE',
  OTHER = 'OTHER',
}

/**
 * Sourcing Product Type Enum
 * Matches Prisma schema SourcingProductType enum
 */
export enum SourcingProductType {
  FRESH_ROOTS = 'FRESH_ROOTS',
  PROCESS_GRADE = 'PROCESS_GRADE',
  PLANTING_VINES = 'PLANTING_VINES',
  OFSP = 'OFSP',
}

/**
 * Quality Grade Enum
 * Matches Prisma schema QualityGrade enum
 */
export enum QualityGrade {
  A = 'A',
  B = 'B',
  C = 'C',
}

/**
 * Array of valid OFSP variety values
 */
export const OFSP_VARIETY_VALUES = Object.values(OFSPVariety) as string[];

/**
 * Array of valid sourcing product type values
 */
export const SOURCING_PRODUCT_TYPE_VALUES = Object.values(SourcingProductType) as string[];

/**
 * Array of valid quality grade values
 */
export const QUALITY_GRADE_VALUES = Object.values(QualityGrade) as string[];
