-- Add COLLECTED status to MarketplaceOrderStatus enum
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'COLLECTED';

-- Add comment explaining the new workflow
COMMENT ON TYPE "MarketplaceOrderStatus" IS 'Order status enum. Processing workflow: READY_TO_PROCESS -> PROCESSING -> READY_FOR_COLLECTION -> COLLECTED -> (OUT_FOR_DELIVERY if request_transport) -> DELIVERED -> COMPLETED';
