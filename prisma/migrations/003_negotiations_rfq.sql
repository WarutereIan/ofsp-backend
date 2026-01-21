-- ============================================
-- MIGRATION 003: Negotiations & RFQ
-- ============================================
-- Description: Negotiation workflows, RFQ system, sourcing requests, and recurring orders
-- Dependencies: 002_marketplace_listings_orders
-- ============================================

-- Create Enums
CREATE TYPE "NegotiationStatus" AS ENUM (
  'PENDING',
  'COUNTER_OFFER',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED'
);

CREATE TYPE "RFQStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'CLOSED',
  'EVALUATING',
  'AWARDED',
  'CANCELLED'
);

CREATE TYPE "RFQResponseStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'AWARDED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE "SourcingProductType" AS ENUM (
  'FRESH_ROOTS',
  'PROCESS_GRADE',
  'PLANTING_VINES'
);

CREATE TYPE "SourcingRequestStatus" AS ENUM (
  'OPEN',
  'URGENT',
  'DRAFT',
  'CLOSED',
  'FULFILLED'
);

CREATE TYPE "RecurringFrequency" AS ENUM (
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'CUSTOM'
);

-- Create Negotiations Table
CREATE TABLE "negotiations" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "negotiationNumber" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "originalPricePerKg" DOUBLE PRECISION NOT NULL,
  "originalQuantity" DOUBLE PRECISION NOT NULL,
  "negotiatedPricePerKg" DOUBLE PRECISION,
  "negotiatedQuantity" DOUBLE PRECISION,
  "negotiatedTotalAmount" DOUBLE PRECISION,
  "status" "NegotiationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastMessageAt" TIMESTAMP(3),

  CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

-- Create Negotiation Messages Table
CREATE TABLE "negotiation_messages" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "negotiationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "message" TEXT,
  "pricePerKg" DOUBLE PRECISION,
  "quantity" DOUBLE PRECISION,
  "totalAmount" DOUBLE PRECISION,
  "isCounterOffer" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "negotiation_messages_pkey" PRIMARY KEY ("id")
);

-- Create RFQs Table
CREATE TABLE "rfqs" (
  "id" TEXT NOT NULL,
  "rfqNumber" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "productType" "SourcingProductType" NOT NULL,
  "variety" "OFSPVariety",
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "priceRangeMin" DOUBLE PRECISION,
  "priceRangeMax" DOUBLE PRECISION,
  "qualityGrade" "QualityGrade",
  "deadline" TIMESTAMP(3) NOT NULL,
  "quoteDeadline" TIMESTAMP(3) NOT NULL,
  "evaluationDeadline" TIMESTAMP(3),
  "deliveryRegion" TEXT,
  "deliveryLocation" TEXT,
  "additionalRequirements" TEXT,
  "termsAndConditions" TEXT,
  "evaluationCriteria" TEXT,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "recurringFrequency" TEXT,
  "recurringEndDate" TIMESTAMP(3),
  "nextDeliveryDate" TIMESTAMP(3),
  "status" "RFQStatus" NOT NULL DEFAULT 'DRAFT',
  "totalResponses" INTEGER NOT NULL DEFAULT 0,
  "awardedTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "attachments" TEXT[],
  "publishedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "awardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- Create RFQ Responses Table
CREATE TABLE "rfq_responses" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "rfqId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "quantityUnit" TEXT NOT NULL,
  "pricePerUnit" DOUBLE PRECISION NOT NULL,
  "priceUnit" TEXT NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "variety" "OFSPVariety",
  "qualityGrade" "QualityGrade" NOT NULL,
  "deliveryTime" TEXT,
  "deliveryLocation" TEXT,
  "paymentTerms" TEXT,
  "batchId" TEXT,
  "qrCode" TEXT,
  "notes" TEXT,
  "attachments" TEXT[],
  "status" "RFQResponseStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "evaluatedAt" TIMESTAMP(3),
  "awardedAt" TIMESTAMP(3),
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rfq_responses_pkey" PRIMARY KEY ("id")
);

-- Create Sourcing Requests Table
CREATE TABLE "sourcing_requests" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "requestId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "productType" "SourcingProductType" NOT NULL,
  "variety" "OFSPVariety",
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "priceRangeMin" DOUBLE PRECISION,
  "priceRangeMax" DOUBLE PRECISION,
  "pricePerUnit" DOUBLE PRECISION,
  "priceUnit" TEXT,
  "qualityGrade" "QualityGrade",
  "deadline" TIMESTAMP(3) NOT NULL,
  "deliveryRegion" TEXT,
  "deliveryLocation" TEXT,
  "additionalRequirements" TEXT,
  "notes" TEXT,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "recurringFrequency" TEXT,
  "recurringEndDate" TIMESTAMP(3),
  "nextDeliveryDate" TIMESTAMP(3),
  "status" "SourcingRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "fulfilled" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "suppliers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sourcing_requests_pkey" PRIMARY KEY ("id")
);

-- Create Supplier Offers Table
CREATE TABLE "supplier_offers" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "sourcingRequestId" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "quantityUnit" TEXT NOT NULL,
  "pricePerKg" DOUBLE PRECISION NOT NULL,
  "qualityGrade" "QualityGrade" NOT NULL,
  "batchId" TEXT,
  "qrCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending', -- "pending" | "accepted" | "rejected" | "converted"
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplier_offers_pkey" PRIMARY KEY ("id")
);

-- Create Recurring Orders Table
CREATE TABLE "recurring_orders" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "buyerId" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "variety" "OFSPVariety" NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "qualityGrade" "QualityGrade" NOT NULL,
  "pricePerKg" DOUBLE PRECISION NOT NULL,
  "frequency" "RecurringFrequency" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "nextDeliveryDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT,
  "completedDeliveries" INTEGER NOT NULL DEFAULT 0,
  "totalDeliveries" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "recurring_orders_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "produce_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rfq_responses" ADD CONSTRAINT "rfq_responses_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfq_responses" ADD CONSTRAINT "rfq_responses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign keys for marketplace orders (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketplace_orders') THEN
    ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "sourcing_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "sourcing_requests" ADD CONSTRAINT "sourcing_requests_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "sourcing_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- orderId columns already added in table creation above

-- Add foreign keys for orderId (if marketplace_orders table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketplace_orders') THEN
    ALTER TABLE "rfq_responses" ADD CONSTRAINT "rfq_responses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    
    -- Add foreign key for rfqResponseId in marketplace_orders
    ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_rfqResponseId_fkey" FOREIGN KEY ("rfqResponseId") REFERENCES "rfq_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    
    -- Add foreign key for supplierOfferId in marketplace_orders
    ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_supplierOfferId_fkey" FOREIGN KEY ("supplierOfferId") REFERENCES "supplier_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create unique indexes for orderId
CREATE UNIQUE INDEX IF NOT EXISTS "rfq_responses_orderId_key" ON "rfq_responses"("orderId") WHERE "orderId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_offers_orderId_key" ON "supplier_offers"("orderId") WHERE "orderId" IS NOT NULL;

-- Create Unique Constraints
CREATE UNIQUE INDEX "negotiations_negotiationNumber_key" ON "negotiations"("negotiationNumber");
CREATE UNIQUE INDEX "negotiations_orderId_key" ON "negotiations"("orderId") WHERE "orderId" IS NOT NULL;
CREATE UNIQUE INDEX "rfqs_rfqNumber_key" ON "rfqs"("rfqNumber");
CREATE UNIQUE INDEX "sourcing_requests_requestId_key" ON "sourcing_requests"("requestId");

-- Create Indexes
CREATE INDEX "negotiations_buyerId_idx" ON "negotiations"("buyerId");
CREATE INDEX "negotiations_farmerId_idx" ON "negotiations"("farmerId");
CREATE INDEX "negotiations_listingId_idx" ON "negotiations"("listingId");
CREATE INDEX "negotiations_status_idx" ON "negotiations"("status");
CREATE INDEX "negotiations_negotiationNumber_idx" ON "negotiations"("negotiationNumber");
CREATE INDEX "negotiation_messages_negotiationId_idx" ON "negotiation_messages"("negotiationId");
CREATE INDEX "negotiation_messages_senderId_idx" ON "negotiation_messages"("senderId");

CREATE INDEX "rfqs_buyerId_idx" ON "rfqs"("buyerId");
CREATE INDEX "rfqs_status_idx" ON "rfqs"("status");
CREATE INDEX "rfqs_rfqNumber_idx" ON "rfqs"("rfqNumber");
CREATE INDEX "rfqs_quoteDeadline_idx" ON "rfqs"("quoteDeadline");
CREATE INDEX "rfq_responses_rfqId_idx" ON "rfq_responses"("rfqId");
CREATE INDEX "rfq_responses_supplierId_idx" ON "rfq_responses"("supplierId");
CREATE INDEX "rfq_responses_status_idx" ON "rfq_responses"("status");

CREATE INDEX "sourcing_requests_buyerId_idx" ON "sourcing_requests"("buyerId");
CREATE INDEX "sourcing_requests_status_idx" ON "sourcing_requests"("status");
CREATE INDEX "sourcing_requests_requestId_idx" ON "sourcing_requests"("requestId");
CREATE INDEX "sourcing_requests_deadline_idx" ON "sourcing_requests"("deadline");
CREATE INDEX "supplier_offers_sourcingRequestId_idx" ON "supplier_offers"("sourcingRequestId");
CREATE INDEX "supplier_offers_farmerId_idx" ON "supplier_offers"("farmerId");
CREATE INDEX "supplier_offers_status_idx" ON "supplier_offers"("status");
CREATE INDEX "supplier_offers_orderId_idx" ON "supplier_offers"("orderId");

CREATE INDEX "recurring_orders_buyerId_idx" ON "recurring_orders"("buyerId");
CREATE INDEX "recurring_orders_farmerId_idx" ON "recurring_orders"("farmerId");
CREATE INDEX "recurring_orders_isActive_idx" ON "recurring_orders"("isActive");

-- Create Triggers
CREATE TRIGGER update_negotiations_updated_at BEFORE UPDATE ON "negotiations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rfqs_updated_at BEFORE UPDATE ON "rfqs"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rfq_responses_updated_at BEFORE UPDATE ON "rfq_responses"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sourcing_requests_updated_at BEFORE UPDATE ON "sourcing_requests"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_offers_updated_at BEFORE UPDATE ON "supplier_offers"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_orders_updated_at BEFORE UPDATE ON "recurring_orders"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create Functions for Number Generation
CREATE SEQUENCE IF NOT EXISTS negotiation_number_seq;
CREATE SEQUENCE IF NOT EXISTS rfq_number_seq;
CREATE SEQUENCE IF NOT EXISTS sourcing_request_seq;

CREATE OR REPLACE FUNCTION generate_negotiation_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'NEG-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('negotiation_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RFQ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('rfq_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_sourcing_request_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'SR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('sourcing_request_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Add Comments
COMMENT ON TABLE "negotiations" IS 'Buyer-farmer negotiations on produce listings';
COMMENT ON TABLE "negotiation_messages" IS 'Negotiation thread messages and counter-offers';
COMMENT ON TABLE "rfqs" IS 'Request for Quotation - buyer procurement requests';
COMMENT ON TABLE "rfq_responses" IS 'Supplier quotes in response to RFQs';
COMMENT ON TABLE "sourcing_requests" IS 'Buyer sourcing requests for produce';
COMMENT ON TABLE "supplier_offers" IS 'Farmer offers to sourcing requests';
COMMENT ON TABLE "recurring_orders" IS 'Recurring marketplace orders with scheduled deliveries';
