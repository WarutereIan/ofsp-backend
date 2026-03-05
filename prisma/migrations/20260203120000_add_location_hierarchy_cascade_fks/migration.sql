-- Add foreign keys with ON DELETE CASCADE for location hierarchy so that:
-- Deleting a county cascades to sub_counties, wards, and villages.
-- Deleting a sub_county cascades to wards and villages.
-- Deleting a ward cascades to villages.

ALTER TABLE "sub_counties"
  ADD CONSTRAINT "sub_counties_countyId_fkey"
  FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wards"
  ADD CONSTRAINT "wards_subCountyId_fkey"
  FOREIGN KEY ("subCountyId") REFERENCES "sub_counties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "villages"
  ADD CONSTRAINT "villages_wardId_fkey"
  FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
