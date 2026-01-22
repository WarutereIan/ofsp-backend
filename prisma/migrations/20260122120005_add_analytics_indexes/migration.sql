-- Migration: Add Analytics Indexes
-- Date: January 2025
-- Purpose: Add composite indexes for optimal analytics query performance

-- ============ Marketplace Order Indexes ============

-- Composite index for filtering by farmer and date range
CREATE INDEX IF NOT EXISTS "marketplace_orders_farmerId_createdAt_idx" 
ON "marketplace_orders"("farmerId", "createdAt");

-- Composite index for filtering by buyer and date range
CREATE INDEX IF NOT EXISTS "marketplace_orders_buyerId_createdAt_idx" 
ON "marketplace_orders"("buyerId", "createdAt");

-- Composite index for filtering by status and date range
CREATE INDEX IF NOT EXISTS "marketplace_orders_status_createdAt_idx" 
ON "marketplace_orders"("status", "createdAt");

-- ============ Profile Indexes ============

-- Index for filtering by sub-county
CREATE INDEX IF NOT EXISTS "profiles_subCounty_idx" 
ON "profiles"("subCounty");

-- Index for user creation date (for growth calculations)
CREATE INDEX IF NOT EXISTS "profiles_createdAt_idx" 
ON "profiles"("createdAt");

-- ============ Rating Indexes ============

-- Composite index for filtering by rated user and date
CREATE INDEX IF NOT EXISTS "ratings_ratedUserId_createdAt_idx" 
ON "ratings"("ratedUserId", "createdAt");

-- Composite index for filtering by rater and date
CREATE INDEX IF NOT EXISTS "ratings_raterId_createdAt_idx" 
ON "ratings"("raterId", "createdAt");

-- ============ Quality Check Indexes ============

-- Composite index for filtering by farmer and date
CREATE INDEX IF NOT EXISTS "quality_checks_farmerId_checkedAt_idx" 
ON "quality_checks"("farmerId", "checkedAt");

-- ============ Stock Transaction Indexes ============

-- Composite index for filtering by center and date
CREATE INDEX IF NOT EXISTS "stock_transactions_centerId_createdAt_idx" 
ON "stock_transactions"("centerId", "createdAt");

-- Composite index for filtering by type and date
CREATE INDEX IF NOT EXISTS "stock_transactions_type_createdAt_idx" 
ON "stock_transactions"("type", "createdAt");

-- ============ Inventory Item Indexes ============

-- Composite index for filtering by center and status
CREATE INDEX IF NOT EXISTS "inventory_items_centerId_status_idx" 
ON "inventory_items"("centerId", "status");
