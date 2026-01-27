-- Add grading matrix criteria fields to stock_transactions
-- These fields are used for quality assessment during stock-in

-- Add grading matrix criteria columns
ALTER TABLE "stock_transactions" 
  ADD COLUMN IF NOT EXISTS "weightRange" TEXT,
  ADD COLUMN IF NOT EXISTS "colorIntensity" INTEGER,
  ADD COLUMN IF NOT EXISTS "physicalCondition" TEXT,
  ADD COLUMN IF NOT EXISTS "freshness" TEXT,
  ADD COLUMN IF NOT EXISTS "daysSinceHarvest" INTEGER;

-- Add comments
COMMENT ON COLUMN "stock_transactions"."weightRange" IS 'Weight range category: small, medium, large, extra_large';
COMMENT ON COLUMN "stock_transactions"."colorIntensity" IS 'Color intensity score (1-10 scale)';
COMMENT ON COLUMN "stock_transactions"."physicalCondition" IS 'Physical condition: excellent, good, fair, poor';
COMMENT ON COLUMN "stock_transactions"."freshness" IS 'Freshness level: very_fresh, fresh, moderate, aging';
COMMENT ON COLUMN "stock_transactions"."daysSinceHarvest" IS 'Number of days since harvest (optional)';
