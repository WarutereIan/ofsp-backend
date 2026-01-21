-- ============================================
-- MIGRATION 004: Transport & Pickup Schedules
-- ============================================
-- Description: Transport requests, pickup schedules, slot bookings, and tracking
-- Dependencies: 002_marketplace_listings_orders, 005_aggregation_storage (for AggregationCenter)
-- Note: Run 005 before 004 if AggregationCenter is needed, or add center creation here
-- ============================================

-- Create Enums
CREATE TYPE "TransportRequestStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'IN_TRANSIT_PICKUP',
  'IN_TRANSIT_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "TransportType" AS ENUM (
  'PRODUCE_PICKUP',
  'PRODUCE_DELIVERY',
  'INPUT_DELIVERY'
);

CREATE TYPE "PickupScheduleStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "PickupSlotStatus" AS ENUM (
  'AVAILABLE',
  'BOOKED',
  'FULL',
  'COMPLETED',
  'CANCELLED'
);

-- Create Transport Requests Table
CREATE TABLE "transport_requests" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "requestNumber" TEXT NOT NULL,
  "type" "TransportType" NOT NULL,
  "description" TEXT,
  "requesterId" TEXT NOT NULL,
  "requesterType" TEXT NOT NULL,
  "providerId" TEXT,
  "orderId" TEXT,
  "pickupScheduleId" TEXT,
  "pickupSlotId" TEXT,
  "pickupLocation" TEXT NOT NULL,
  "pickupCounty" TEXT NOT NULL,
  "pickupCoords" TEXT,
  "deliveryLocation" TEXT NOT NULL,
  "deliveryCounty" TEXT NOT NULL,
  "deliveryCoords" TEXT,
  "distance" DOUBLE PRECISION,
  "cargoDescription" TEXT NOT NULL,
  "estimatedWeight" DOUBLE PRECISION NOT NULL,
  "actualWeight" DOUBLE PRECISION,
  "scheduledPickup" TIMESTAMP(3),
  "scheduledDelivery" TIMESTAMP(3),
  "actualPickup" TIMESTAMP(3),
  "actualDelivery" TIMESTAMP(3),
  "estimatedCost" DOUBLE PRECISION,
  "agreedCost" DOUBLE PRECISION,
  "status" "TransportRequestStatus" NOT NULL DEFAULT 'PENDING',
  "collectionStatus" TEXT,
  "collectedBy" TEXT,
  "collectedAt" TIMESTAMP(3),
  "collectionDate" TEXT,
  "collectionTime" TEXT,
  "collectionNotes" TEXT,
  "vehicleId" TEXT,
  "vehicleType" TEXT,
  "driverName" TEXT,
  "driverPhone" TEXT,
  "currentCoordinates" TEXT,
  "currentLocation" TEXT,
  "progress" INTEGER,
  "eta" TIMESTAMP(3),
  "photos" TEXT[],
  "rating" DOUBLE PRECISION,
  "review" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),

  CONSTRAINT "transport_requests_pkey" PRIMARY KEY ("id")
);

-- Create Tracking Updates Table
CREATE TABLE "tracking_updates" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "requestId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "coordinates" TEXT,
  "notes" TEXT,
  "photos" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tracking_updates_pkey" PRIMARY KEY ("id")
);

-- Create Farm Pickup Schedules Table
CREATE TABLE "farm_pickup_schedules" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "scheduleNumber" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "aggregationCenterId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "scheduledTime" TEXT NOT NULL,
  "estimatedArrivalTime" TIMESTAMP(3),
  "totalCapacity" DOUBLE PRECISION NOT NULL,
  "usedCapacity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "availableCapacity" DOUBLE PRECISION NOT NULL,
  "vehicleId" TEXT,
  "vehicleType" TEXT,
  "driverId" TEXT,
  "driverName" TEXT,
  "driverPhone" TEXT,
  "pricePerKg" DOUBLE PRECISION,
  "fixedPrice" DOUBLE PRECISION,
  "status" "PickupScheduleStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "publishedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "farm_pickup_schedules_pkey" PRIMARY KEY ("id")
);

-- Create Pickup Locations Table
CREATE TABLE "pickup_locations" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "scheduleId" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "coordinates" TEXT,
  "subCounty" TEXT,
  "ward" TEXT,
  "estimatedPickupTime" TIMESTAMP(3),
  "order" INTEGER NOT NULL,

  CONSTRAINT "pickup_locations_pkey" PRIMARY KEY ("id")
);

-- Create Pickup Slots Table
CREATE TABLE "pickup_slots" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "scheduleId" TEXT NOT NULL,
  "locationId" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "capacity" DOUBLE PRECISION NOT NULL,
  "usedCapacity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "availableCapacity" DOUBLE PRECISION NOT NULL,
  "status" "PickupSlotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pickup_slots_pkey" PRIMARY KEY ("id")
);

-- Create Pickup Slot Bookings Table
CREATE TABLE "pickup_slot_bookings" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "slotId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "location" TEXT NOT NULL,
  "coordinates" TEXT,
  "contactPhone" TEXT NOT NULL,
  "notes" TEXT,
  "batchId" TEXT,
  "qrCode" TEXT,
  "pickupConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "pickupConfirmedAt" TIMESTAMP(3),
  "pickupConfirmedBy" TEXT,
  "pickupReceiptId" TEXT,
  "variety" TEXT,
  "qualityGrade" "QualityGrade",
  "photos" TEXT[],
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),

  CONSTRAINT "pickup_slot_bookings_pkey" PRIMARY KEY ("id")
);

-- Create Pickup Receipts Table
CREATE TABLE "pickup_receipts" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "receiptNumber" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "aggregationCenterId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "qrCode" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "variety" TEXT NOT NULL,
  "qualityGrade" "QualityGrade" NOT NULL,
  "pickupLocation" TEXT NOT NULL,
  "pickupDate" TIMESTAMP(3) NOT NULL,
  "pickupTime" TEXT NOT NULL,
  "scheduledDeliveryDate" TIMESTAMP(3),
  "photos" TEXT[],
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pickup_receipts_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tracking_updates" ADD CONSTRAINT "tracking_updates_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "transport_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pickup_locations" ADD CONSTRAINT "pickup_locations_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "farm_pickup_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "farm_pickup_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "pickup_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pickup_slot_bookings" ADD CONSTRAINT "pickup_slot_bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "pickup_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_slot_bookings" ADD CONSTRAINT "pickup_slot_bookings_pickupReceiptId_fkey" FOREIGN KEY ("pickupReceiptId") REFERENCES "pickup_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: AggregationCenter foreign key will be added in migration 005
-- ALTER TABLE "farm_pickup_schedules" ADD CONSTRAINT "farm_pickup_schedules_aggregationCenterId_fkey" FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "pickup_receipts" ADD CONSTRAINT "pickup_receipts_aggregationCenterId_fkey" FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Unique Constraints
CREATE UNIQUE INDEX "transport_requests_requestNumber_key" ON "transport_requests"("requestNumber");
CREATE UNIQUE INDEX "farm_pickup_schedules_scheduleNumber_key" ON "farm_pickup_schedules"("scheduleNumber");
CREATE UNIQUE INDEX "pickup_slot_bookings_batchId_key" ON "pickup_slot_bookings"("batchId") WHERE "batchId" IS NOT NULL;
CREATE UNIQUE INDEX "pickup_slot_bookings_pickupReceiptId_key" ON "pickup_slot_bookings"("pickupReceiptId") WHERE "pickupReceiptId" IS NOT NULL;
CREATE UNIQUE INDEX "pickup_receipts_receiptNumber_key" ON "pickup_receipts"("receiptNumber");
CREATE UNIQUE INDEX "pickup_receipts_bookingId_key" ON "pickup_receipts"("bookingId");
CREATE UNIQUE INDEX "pickup_receipts_batchId_key" ON "pickup_receipts"("batchId");

-- Create Indexes
CREATE INDEX "transport_requests_providerId_idx" ON "transport_requests"("providerId");
CREATE INDEX "transport_requests_requesterId_idx" ON "transport_requests"("requesterId");
CREATE INDEX "transport_requests_status_idx" ON "transport_requests"("status");
CREATE INDEX "transport_requests_requestNumber_idx" ON "transport_requests"("requestNumber");
CREATE INDEX "transport_requests_pickupScheduleId_idx" ON "transport_requests"("pickupScheduleId");
CREATE INDEX "transport_requests_orderId_idx" ON "transport_requests"("orderId");
CREATE INDEX "tracking_updates_requestId_idx" ON "tracking_updates"("requestId");
CREATE INDEX "tracking_updates_createdAt_idx" ON "tracking_updates"("createdAt");

CREATE INDEX "farm_pickup_schedules_providerId_idx" ON "farm_pickup_schedules"("providerId");
CREATE INDEX "farm_pickup_schedules_aggregationCenterId_idx" ON "farm_pickup_schedules"("aggregationCenterId");
CREATE INDEX "farm_pickup_schedules_status_idx" ON "farm_pickup_schedules"("status");
CREATE INDEX "farm_pickup_schedules_scheduledDate_idx" ON "farm_pickup_schedules"("scheduledDate");
CREATE INDEX "farm_pickup_schedules_scheduleNumber_idx" ON "farm_pickup_schedules"("scheduleNumber");
CREATE INDEX "pickup_locations_scheduleId_idx" ON "pickup_locations"("scheduleId");
CREATE INDEX "pickup_slots_scheduleId_idx" ON "pickup_slots"("scheduleId");
CREATE INDEX "pickup_slots_status_idx" ON "pickup_slots"("status");

CREATE INDEX "pickup_slot_bookings_slotId_idx" ON "pickup_slot_bookings"("slotId");
CREATE INDEX "pickup_slot_bookings_scheduleId_idx" ON "pickup_slot_bookings"("scheduleId");
CREATE INDEX "pickup_slot_bookings_farmerId_idx" ON "pickup_slot_bookings"("farmerId");
CREATE INDEX "pickup_slot_bookings_batchId_idx" ON "pickup_slot_bookings"("batchId");
CREATE INDEX "pickup_slot_bookings_status_idx" ON "pickup_slot_bookings"("status");
CREATE INDEX "pickup_receipts_farmerId_idx" ON "pickup_receipts"("farmerId");
CREATE INDEX "pickup_receipts_batchId_idx" ON "pickup_receipts"("batchId");
CREATE INDEX "pickup_receipts_receiptNumber_idx" ON "pickup_receipts"("receiptNumber");

-- Create Triggers
CREATE TRIGGER update_transport_requests_updated_at BEFORE UPDATE ON "transport_requests"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_farm_pickup_schedules_updated_at BEFORE UPDATE ON "farm_pickup_schedules"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pickup_slots_updated_at BEFORE UPDATE ON "pickup_slots"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create Functions
CREATE SEQUENCE IF NOT EXISTS transport_request_seq;
CREATE SEQUENCE IF NOT EXISTS pickup_schedule_seq;
CREATE SEQUENCE IF NOT EXISTS pickup_receipt_seq;

CREATE OR REPLACE FUNCTION generate_transport_request_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('transport_request_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_pickup_schedule_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PUS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('pickup_schedule_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_pickup_receipt_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PUR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('pickup_receipt_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate available capacity for pickup slots
CREATE OR REPLACE FUNCTION calculate_slot_capacity()
RETURNS TRIGGER AS $$
BEGIN
  NEW."availableCapacity" := NEW."capacity" - NEW."usedCapacity";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_pickup_slot_capacity BEFORE INSERT OR UPDATE ON "pickup_slots"
  FOR EACH ROW EXECUTE FUNCTION calculate_slot_capacity();

-- Function to calculate available capacity for pickup schedules
CREATE OR REPLACE FUNCTION calculate_schedule_capacity()
RETURNS TRIGGER AS $$
BEGIN
  NEW."availableCapacity" := NEW."totalCapacity" - NEW."usedCapacity";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_pickup_schedule_capacity BEFORE INSERT OR UPDATE ON "farm_pickup_schedules"
  FOR EACH ROW EXECUTE FUNCTION calculate_schedule_capacity();

-- Add Comments
COMMENT ON TABLE "transport_requests" IS 'Transport service requests for produce and inputs';
COMMENT ON TABLE "tracking_updates" IS 'Real-time tracking updates for transport requests';
COMMENT ON TABLE "farm_pickup_schedules" IS 'Scheduled pickup routes from farms to aggregation centers';
COMMENT ON TABLE "pickup_locations" IS 'Pickup locations on scheduled routes';
COMMENT ON TABLE "pickup_slots" IS 'Time slots for produce pickup with capacity management';
COMMENT ON TABLE "pickup_slot_bookings" IS 'Farmer bookings in pickup slots';
COMMENT ON TABLE "pickup_receipts" IS 'Pickup confirmation receipts with batch tracking';
