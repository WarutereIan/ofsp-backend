-- Add index on payments.initiatedAt for report aggregates (REPORTING_FRAMEWORK.md)
CREATE INDEX IF NOT EXISTS "payments_initiatedAt_idx" ON "payments"("initiatedAt");
