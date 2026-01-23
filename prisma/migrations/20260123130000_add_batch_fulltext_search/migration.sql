-- Add full-text search index for batchId in stock_transactions
-- This enables efficient PostgreSQL full-text search on batch IDs

-- Create a GIN index for full-text search on batchId and qrCode
-- Using 'simple' text search configuration for alphanumeric IDs
CREATE INDEX IF NOT EXISTS idx_stock_transactions_batch_fulltext 
ON stock_transactions 
USING GIN (to_tsvector('simple', COALESCE("batchId", '') || ' ' || COALESCE("qrCode", '')));

-- Add a comment explaining the index
COMMENT ON INDEX idx_stock_transactions_batch_fulltext IS 
'Full-text search index for batchId and qrCode fields using PostgreSQL tsvector. Enables efficient batch search.';
