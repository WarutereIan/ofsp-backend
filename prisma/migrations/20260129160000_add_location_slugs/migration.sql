-- Add slug column to location tables (nullable first for backfill)
ALTER TABLE "counties" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "sub_counties" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "wards" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "villages" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill slugs from name: lowercase, spaces to hyphens, strip non-alphanumeric, collapse hyphens, trim
-- Expression: COALESCE(non_empty_slug, 'loc-' || left(id, 8)) to avoid empty
CREATE OR REPLACE FUNCTION slugify_location_name(raw_name TEXT, row_id TEXT, prefix TEXT DEFAULT 'loc') RETURNS TEXT AS $$
DECLARE
  s TEXT;
BEGIN
  s := LOWER(TRIM(raw_name));
  s := REGEXP_REPLACE(s, '\s+', '-', 'g');
  s := REGEXP_REPLACE(s, '[^a-z0-9-]', '', 'g');
  s := REGEXP_REPLACE(s, '-+', '-', 'g');
  s := TRIM(BOTH '-' FROM s);
  RETURN COALESCE(NULLIF(s, ''), prefix || '-' || LEFT(row_id, 8));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Counties: backfill with dedupe (slug unique globally)
WITH slugged AS (
  SELECT id, slugify_location_name(name, id, 'c') AS base_slug
  FROM counties
),
with_rownum AS (
  SELECT id, base_slug, ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS rn
  FROM slugged
)
UPDATE counties c
SET slug = CASE WHEN w.rn = 1 THEN w.base_slug ELSE w.base_slug || '-' || w.rn::TEXT END
FROM with_rownum w
WHERE c.id = w.id;

-- SubCounties: backfill with dedupe per county
WITH slugged AS (
  SELECT id, "countyId", slugify_location_name(name, id, 's') AS base_slug
  FROM sub_counties
),
with_rownum AS (
  SELECT id, base_slug, ROW_NUMBER() OVER (PARTITION BY "countyId", base_slug ORDER BY id) AS rn
  FROM slugged
)
UPDATE sub_counties sc
SET slug = CASE WHEN w.rn = 1 THEN w.base_slug ELSE w.base_slug || '-' || w.rn::TEXT END
FROM with_rownum w
WHERE sc.id = w.id;

-- Wards: backfill with dedupe per sub_county
WITH slugged AS (
  SELECT id, "subCountyId", slugify_location_name(name, id, 'w') AS base_slug
  FROM wards
),
with_rownum AS (
  SELECT id, base_slug, ROW_NUMBER() OVER (PARTITION BY "subCountyId", base_slug ORDER BY id) AS rn
  FROM slugged
)
UPDATE wards wr
SET slug = CASE WHEN w.rn = 1 THEN w.base_slug ELSE w.base_slug || '-' || w.rn::TEXT END
FROM with_rownum w
WHERE wr.id = w.id;

-- Villages: backfill with dedupe per ward
WITH slugged AS (
  SELECT id, "wardId", slugify_location_name(name, id, 'v') AS base_slug
  FROM villages
),
with_rownum AS (
  SELECT id, base_slug, ROW_NUMBER() OVER (PARTITION BY "wardId", base_slug ORDER BY id) AS rn
  FROM slugged
)
UPDATE villages v
SET slug = CASE WHEN w.rn = 1 THEN w.base_slug ELSE w.base_slug || '-' || w.rn::TEXT END
FROM with_rownum w
WHERE v.id = w.id;

-- Set NOT NULL
ALTER TABLE "counties" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "sub_counties" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "wards" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "villages" ALTER COLUMN "slug" SET NOT NULL;

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "counties_slug_key" ON "counties"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "sub_counties_countyId_slug_key" ON "sub_counties"("countyId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "wards_subCountyId_slug_key" ON "wards"("subCountyId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "villages_wardId_slug_key" ON "villages"("wardId", "slug");

-- Drop the helper (optional; can keep for manual use)
DROP FUNCTION IF EXISTS slugify_location_name(TEXT, TEXT, TEXT);
