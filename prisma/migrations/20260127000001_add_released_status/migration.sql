-- Add RELEASED status to MarketplaceOrderStatus enum
-- This status is set when aggregation officer records stock out to authorize stock release
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'RELEASED';

-- Add comment explaining the new workflow
COMMENT ON TYPE "MarketplaceOrderStatus" IS 'Order status enum. Processing workflow: READY_TO_PROCESS -> PROCESSING -> READY_FOR_COLLECTION -> RELEASED (when stock out recorded) -> COLLECTED -> (OUT_FOR_DELIVERY if request_transport) -> DELIVERED -> COMPLETED';
