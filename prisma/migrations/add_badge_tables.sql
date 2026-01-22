-- Migration: Add Badge and BadgeProgress Tables
-- Date: January 2025
-- Purpose: Add tables for achievement badge tracking

-- ============ Badge Table ============

CREATE TABLE IF NOT EXISTS "badges" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "targetValue" DOUBLE PRECISION,
  "icon" TEXT,
  "color" TEXT,
  "bgColor" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "badges_type_key" ON "badges"("type");

-- ============ BadgeProgress Table ============

CREATE TABLE IF NOT EXISTS "badge_progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isEarned" BOOLEAN NOT NULL DEFAULT false,
  "earnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "badge_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "badge_progress_userId_badgeId_key" ON "badge_progress"("userId", "badgeId");
CREATE INDEX IF NOT EXISTS "badge_progress_userId_idx" ON "badge_progress"("userId");
CREATE INDEX IF NOT EXISTS "badge_progress_badgeId_idx" ON "badge_progress"("badgeId");
CREATE INDEX IF NOT EXISTS "badge_progress_isEarned_idx" ON "badge_progress"("isEarned");

-- ============ Foreign Keys ============

ALTER TABLE "badge_progress" ADD CONSTRAINT "badge_progress_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "badge_progress" ADD CONSTRAINT "badge_progress_badgeId_fkey" 
  FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
