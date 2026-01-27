-- Add new order processing statuses to MarketplaceOrderStatus enum
-- These statuses represent the processing workflow at aggregation centers

-- First, we need to alter the enum type
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'READY_TO_PROCESS';
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_COLLECTION';

-- Add comment explaining the new workflow
COMMENT ON TYPE "MarketplaceOrderStatus" IS 'Order status enum. New processing workflow: READY_TO_PROCESS (after payment confirmed by farmer) -> PROCESSING (when aggregation center starts) -> READY_FOR_COLLECTION (when processing complete)';
