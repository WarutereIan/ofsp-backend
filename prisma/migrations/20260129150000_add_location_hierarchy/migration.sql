-- Location hierarchy: counties, sub_counties, wards, villages
CREATE TABLE "counties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "counties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "counties_code_key" ON "counties"("code");
CREATE INDEX "counties_name_idx" ON "counties"("name");

CREATE TABLE "sub_counties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sub_counties_pkey" PRIMARY KEY ("id"),
);

CREATE UNIQUE INDEX "sub_counties_countyId_name_key" ON "sub_counties"("countyId", "name");
CREATE INDEX "sub_counties_countyId_idx" ON "sub_counties"("countyId");
CREATE INDEX "sub_counties_name_idx" ON "sub_counties"("name");

CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subCountyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wards_subCountyId_name_key" ON "wards"("subCountyId", "name");
CREATE INDEX "wards_subCountyId_idx" ON "wards"("subCountyId");
CREATE INDEX "wards_name_idx" ON "wards"("name");

CREATE TABLE "villages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "villages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "villages_wardId_name_key" ON "villages"("wardId", "name");
CREATE INDEX "villages_wardId_idx" ON "villages"("wardId");
CREATE INDEX "villages_name_idx" ON "villages"("name");

-- Profile optional FKs to location hierarchy
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "countyId" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "subCountyId" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "wardId" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "villageId" TEXT;

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_subCountyId_fkey" FOREIGN KEY ("subCountyId") REFERENCES "sub_counties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "villages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "profiles_countyId_idx" ON "profiles"("countyId");
CREATE INDEX IF NOT EXISTS "profiles_subCountyId_idx" ON "profiles"("subCountyId");
CREATE INDEX IF NOT EXISTS "profiles_wardId_idx" ON "profiles"("wardId");
CREATE INDEX IF NOT EXISTS "profiles_villageId_idx" ON "profiles"("villageId");
