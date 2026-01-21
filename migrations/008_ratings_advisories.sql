-- ============================================
-- MIGRATION 008: Ratings & Advisories
-- ============================================
-- Description: User ratings system and extension officer advisories
-- Dependencies: 001_init_user_auth_notifications, 002_marketplace_listings_orders
-- ============================================

-- Create Enums
CREATE TYPE "AdvisoryType" AS ENUM (
  'QUALITY',
  'PRICING',
  'STORAGE',
  'HARVESTING',
  'MARKETING',
  'GENERAL'
);

-- Create Ratings Table
CREATE TABLE "ratings" (
  "id" TEXT NOT NULL,
  "raterId" TEXT NOT NULL,
  "ratedUserId" TEXT NOT NULL,
  "orderId" TEXT,
  "rating" INTEGER NOT NULL,
  "review" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- Create Advisories Table
CREATE TABLE "advisories" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "createdBy" TEXT NOT NULL,
  "type" "AdvisoryType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT,
  "priority" TEXT,
  "targetAudience" TEXT[],
  "targetValue" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "attachments" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "views" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT,
  "sentDate" TIMESTAMP(3),
  "deliveryCount" INTEGER DEFAULT 0,
  "readCount" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "advisories_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratedUserId_fkey" FOREIGN KEY ("ratedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "advisories" ADD CONSTRAINT "advisories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Indexes
CREATE INDEX "ratings_ratedUserId_idx" ON "ratings"("ratedUserId");
CREATE INDEX "ratings_orderId_idx" ON "ratings"("orderId");
CREATE INDEX "ratings_raterId_idx" ON "ratings"("raterId");

CREATE INDEX "advisories_createdBy_idx" ON "advisories"("createdBy");
CREATE INDEX "advisories_type_idx" ON "advisories"("type");
CREATE INDEX "advisories_isActive_idx" ON "advisories"("isActive");
CREATE INDEX "advisories_targetValue_idx" ON "advisories"("targetValue");

-- Create Triggers
CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON "ratings"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_advisories_updated_at BEFORE UPDATE ON "advisories"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user rating when new rating is added
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DOUBLE PRECISION;
  total_count INTEGER;
BEGIN
  -- Calculate average rating for the rated user
  SELECT AVG("rating")::DOUBLE PRECISION, COUNT(*)::INTEGER
  INTO avg_rating, total_count
  FROM "ratings"
  WHERE "ratedUserId" = NEW."ratedUserId";
  
  -- Update user profile with new rating
  UPDATE "profiles"
  SET "rating" = avg_rating,
      "totalRatings" = total_count,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "userId" = NEW."ratedUserId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rating_profile_update AFTER INSERT OR UPDATE OR DELETE ON "ratings"
  FOR EACH ROW EXECUTE FUNCTION update_user_rating();

-- Function to validate rating value (1-5)
CREATE OR REPLACE FUNCTION validate_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."rating" < 1 OR NEW."rating" > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rating_validation BEFORE INSERT OR UPDATE ON "ratings"
  FOR EACH ROW EXECUTE FUNCTION validate_rating();

-- Add Comments
COMMENT ON TABLE "ratings" IS 'User ratings and reviews (1-5 stars) linked to orders';
COMMENT ON TABLE "advisories" IS 'Extension officer advisories with target audience and delivery tracking';
COMMENT ON FUNCTION update_user_rating() IS 'Automatically updates user profile rating when new rating is added';
COMMENT ON FUNCTION validate_rating() IS 'Validates that rating values are between 1 and 5';
