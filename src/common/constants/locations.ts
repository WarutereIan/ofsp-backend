/**
 * Location Constants
 * 
 * Valid administrative divisions for the system
 */

export const VALID_SUBCOUNTIES = [
  'Kangundo',
  'Kathiani',
  'Masinga',
  'Yatta',
] as const;

export type SubCounty = typeof VALID_SUBCOUNTIES[number];

/**
 * Validate subcounty
 */
export function isValidSubCounty(subCounty: string): boolean {
  return VALID_SUBCOUNTIES.includes(subCounty as SubCounty);
}
