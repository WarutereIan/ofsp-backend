-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'BUYER', 'TRANSPORT_PROVIDER', 'AGGREGATION_MANAGER', 'INPUT_PROVIDER', 'EXTENSION_OFFICER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QualityGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "OFSPVariety" AS ENUM ('KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('ORDER_PLACED', 'ORDER_ACCEPTED', 'PAYMENT_SECURED', 'IN_TRANSIT', 'AT_AGGREGATION', 'QUALITY_CHECKED', 'QUALITY_APPROVED', 'QUALITY_REJECTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'REJECTED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SECURED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('PENDING', 'COUNTER_OFFER', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "RFQStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'EVALUATING', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RFQResponseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'AWARDED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SourcingProductType" AS ENUM ('FRESH_ROOTS', 'PROCESS_GRADE', 'PLANTING_VINES');

-- CreateEnum
CREATE TYPE "SourcingRequestStatus" AS ENUM ('OPEN', 'URGENT', 'DRAFT', 'CLOSED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TransportRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'IN_TRANSIT_PICKUP', 'IN_TRANSIT_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('PRODUCE_PICKUP', 'PRODUCE_DELIVERY', 'INPUT_DELIVERY');

-- CreateEnum
CREATE TYPE "PickupScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickupSlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'FULL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CenterType" AS ENUM ('MAIN', 'SATELLITE');

-- CreateEnum
CREATE TYPE "CenterStatus" AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'CLOSED');

-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'WASTAGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('FRESH', 'AGING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WastageCategory" AS ENUM ('SPOILAGE', 'DAMAGE', 'EXPIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'BANK_TRANSFER', 'CASH', 'CREDIT');

-- CreateEnum
CREATE TYPE "InputCategory" AS ENUM ('PLANTING_MATERIAL', 'FERTILIZER', 'SOIL_AMENDMENT', 'TOOLS_EQUIPMENT', 'TRAINING_MATERIALS');

-- CreateEnum
CREATE TYPE "InputStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "InputOrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InputPaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AdvisoryType" AS ENUM ('QUALITY', 'PRICING', 'STORAGE', 'HARVESTING', 'MARKETING', 'GENERAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "alternatePhone" TEXT,
    "address" TEXT,
    "county" TEXT,
    "subCounty" TEXT,
    "ward" TEXT,
    "village" TEXT,
    "coordinates" TEXT,
    "businessName" TEXT,
    "businessRegNo" TEXT,
    "farmSize" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "mpesaNumber" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produce_listings" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "variety" "OFSPVariety" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "availableQuantity" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "qualityGrade" "QualityGrade" NOT NULL,
    "harvestDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "location" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "subCounty" TEXT,
    "coordinates" TEXT,
    "photos" TEXT[],
    "description" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "batchId" TEXT,
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produce_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "listingId" TEXT,
    "rfqId" TEXT,
    "rfqResponseId" TEXT,
    "sourcingRequestId" TEXT,
    "supplierOfferId" TEXT,
    "variety" "OFSPVariety" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'ORDER_PLACED',
    "statusHistory" JSONB[],
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryAddress" TEXT NOT NULL,
    "deliveryCounty" TEXT NOT NULL,
    "deliveryCoordinates" TEXT,
    "deliveryNotes" TEXT,
    "estimatedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "qualityScore" DOUBLE PRECISION,
    "qualityFeedback" TEXT,
    "batchId" TEXT,
    "qrCode" TEXT,
    "photos" TEXT[],
    "notes" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiations" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "negotiation_messages" (
    "id" TEXT NOT NULL,
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

-- CreateTable
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
    "awardedTo" TEXT[],
    "attachments" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_responses" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,

    CONSTRAINT "rfq_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourcing_requests" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "supplier_offers" (
    "id" TEXT NOT NULL,
    "sourcingRequestId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "qualityGrade" "QualityGrade" NOT NULL,
    "batchId" TEXT,
    "qrCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,

    CONSTRAINT "supplier_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_orders" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "transport_requests" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "tracking_updates" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "coordinates" TEXT,
    "notes" TEXT,
    "photos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_pickup_schedules" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "pickup_locations" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "coordinates" TEXT,
    "subCounty" TEXT,
    "ward" TEXT,
    "estimatedPickupTime" TIMESTAMP(3),
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_slots" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "pickup_slot_bookings" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "pickup_receipts" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "aggregation_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "subCounty" TEXT,
    "ward" TEXT,
    "coordinates" TEXT,
    "centerType" "CenterType" NOT NULL DEFAULT 'MAIN',
    "mainCenterId" TEXT,
    "totalCapacity" DOUBLE PRECISION NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "managerId" TEXT,
    "managerName" TEXT NOT NULL,
    "managerPhone" TEXT NOT NULL,
    "status" "CenterStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregation_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "type" "StockTransactionType" NOT NULL,
    "variety" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "qualityGrade" "QualityGrade" NOT NULL,
    "pricePerKg" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION,
    "orderId" TEXT,
    "farmerId" TEXT,
    "farmerName" TEXT,
    "buyerId" TEXT,
    "buyerName" TEXT,
    "batchId" TEXT,
    "qrCode" TEXT,
    "photos" TEXT[],
    "notes" TEXT,
    "receivedBy" TEXT,
    "releasedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "qualityGrade" "QualityGrade" NOT NULL,
    "batchId" TEXT NOT NULL,
    "stockInDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "farmerId" TEXT,
    "farmerName" TEXT,
    "stockTransactionId" TEXT,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "location" TEXT,
    "status" "StockStatus" NOT NULL DEFAULT 'FRESH',
    "storageDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "orderId" TEXT,
    "transactionId" TEXT,
    "variety" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "weightRange" TEXT,
    "colorIntensity" INTEGER,
    "physicalCondition" TEXT,
    "freshness" TEXT,
    "daysSinceHarvest" INTEGER,
    "qualityGrade" "QualityGrade" NOT NULL,
    "qualityScore" DOUBLE PRECISION,
    "colorScore" DOUBLE PRECISION,
    "damageScore" DOUBLE PRECISION,
    "sizeScore" DOUBLE PRECISION,
    "dryMatterContent" DOUBLE PRECISION,
    "approved" BOOLEAN NOT NULL,
    "rejectionReason" TEXT,
    "photos" TEXT[],
    "notes" TEXT,
    "checkedBy" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wastage_entries" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "batchId" TEXT,
    "inventoryItemId" TEXT,
    "variety" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "qualityGrade" "QualityGrade" NOT NULL,
    "category" "WastageCategory" NOT NULL,
    "reason" TEXT,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "photos" TEXT[],

    CONSTRAINT "wastage_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "orderId" TEXT,
    "transportId" TEXT,
    "inputOrderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payerId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "transactionId" TEXT,
    "providerRef" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "securedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SECURED',
    "releaseCondition" TEXT,
    "disputeReason" TEXT,
    "disputedBy" TEXT,
    "disputedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inputs" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InputCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "minimumStock" INTEGER,
    "images" TEXT[],
    "location" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviews" INTEGER DEFAULT 0,
    "status" "InputStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "input_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "transportFee" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "InputOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "InputPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "requiresTransport" BOOLEAN NOT NULL DEFAULT false,
    "transportRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "input_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "advisories" (
    "id" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_nationalId_key" ON "profiles"("nationalId");

-- CreateIndex
CREATE INDEX "profiles_userId_idx" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "profiles_county_idx" ON "profiles"("county");

-- CreateIndex
CREATE INDEX "profiles_ward_idx" ON "profiles"("ward");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "produce_listings_batchId_key" ON "produce_listings"("batchId");

-- CreateIndex
CREATE INDEX "produce_listings_farmerId_idx" ON "produce_listings"("farmerId");

-- CreateIndex
CREATE INDEX "produce_listings_status_idx" ON "produce_listings"("status");

-- CreateIndex
CREATE INDEX "produce_listings_variety_idx" ON "produce_listings"("variety");

-- CreateIndex
CREATE INDEX "produce_listings_qualityGrade_idx" ON "produce_listings"("qualityGrade");

-- CreateIndex
CREATE INDEX "produce_listings_county_idx" ON "produce_listings"("county");

-- CreateIndex
CREATE INDEX "produce_listings_batchId_idx" ON "produce_listings"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_orderNumber_key" ON "marketplace_orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_rfqResponseId_key" ON "marketplace_orders"("rfqResponseId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_supplierOfferId_key" ON "marketplace_orders"("supplierOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_batchId_key" ON "marketplace_orders"("batchId");

-- CreateIndex
CREATE INDEX "marketplace_orders_buyerId_idx" ON "marketplace_orders"("buyerId");

-- CreateIndex
CREATE INDEX "marketplace_orders_farmerId_idx" ON "marketplace_orders"("farmerId");

-- CreateIndex
CREATE INDEX "marketplace_orders_status_idx" ON "marketplace_orders"("status");

-- CreateIndex
CREATE INDEX "marketplace_orders_orderNumber_idx" ON "marketplace_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "marketplace_orders_batchId_idx" ON "marketplace_orders"("batchId");

-- CreateIndex
CREATE INDEX "marketplace_orders_listingId_idx" ON "marketplace_orders"("listingId");

-- CreateIndex
CREATE INDEX "marketplace_orders_rfqId_idx" ON "marketplace_orders"("rfqId");

-- CreateIndex
CREATE INDEX "marketplace_orders_rfqResponseId_idx" ON "marketplace_orders"("rfqResponseId");

-- CreateIndex
CREATE INDEX "marketplace_orders_sourcingRequestId_idx" ON "marketplace_orders"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "marketplace_orders_supplierOfferId_idx" ON "marketplace_orders"("supplierOfferId");

-- CreateIndex
CREATE INDEX "marketplace_orders_paymentStatus_idx" ON "marketplace_orders"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "negotiations_negotiationNumber_key" ON "negotiations"("negotiationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "negotiations_orderId_key" ON "negotiations"("orderId");

-- CreateIndex
CREATE INDEX "negotiations_buyerId_idx" ON "negotiations"("buyerId");

-- CreateIndex
CREATE INDEX "negotiations_farmerId_idx" ON "negotiations"("farmerId");

-- CreateIndex
CREATE INDEX "negotiations_listingId_idx" ON "negotiations"("listingId");

-- CreateIndex
CREATE INDEX "negotiations_status_idx" ON "negotiations"("status");

-- CreateIndex
CREATE INDEX "negotiations_negotiationNumber_idx" ON "negotiations"("negotiationNumber");

-- CreateIndex
CREATE INDEX "negotiation_messages_negotiationId_idx" ON "negotiation_messages"("negotiationId");

-- CreateIndex
CREATE INDEX "negotiation_messages_senderId_idx" ON "negotiation_messages"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_rfqNumber_key" ON "rfqs"("rfqNumber");

-- CreateIndex
CREATE INDEX "rfqs_buyerId_idx" ON "rfqs"("buyerId");

-- CreateIndex
CREATE INDEX "rfqs_status_idx" ON "rfqs"("status");

-- CreateIndex
CREATE INDEX "rfqs_rfqNumber_idx" ON "rfqs"("rfqNumber");

-- CreateIndex
CREATE INDEX "rfqs_quoteDeadline_idx" ON "rfqs"("quoteDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_responses_orderId_key" ON "rfq_responses"("orderId");

-- CreateIndex
CREATE INDEX "rfq_responses_rfqId_idx" ON "rfq_responses"("rfqId");

-- CreateIndex
CREATE INDEX "rfq_responses_supplierId_idx" ON "rfq_responses"("supplierId");

-- CreateIndex
CREATE INDEX "rfq_responses_status_idx" ON "rfq_responses"("status");

-- CreateIndex
CREATE INDEX "rfq_responses_orderId_idx" ON "rfq_responses"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "sourcing_requests_requestId_key" ON "sourcing_requests"("requestId");

-- CreateIndex
CREATE INDEX "sourcing_requests_buyerId_idx" ON "sourcing_requests"("buyerId");

-- CreateIndex
CREATE INDEX "sourcing_requests_status_idx" ON "sourcing_requests"("status");

-- CreateIndex
CREATE INDEX "sourcing_requests_requestId_idx" ON "sourcing_requests"("requestId");

-- CreateIndex
CREATE INDEX "sourcing_requests_deadline_idx" ON "sourcing_requests"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_offers_orderId_key" ON "supplier_offers"("orderId");

-- CreateIndex
CREATE INDEX "supplier_offers_sourcingRequestId_idx" ON "supplier_offers"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "supplier_offers_farmerId_idx" ON "supplier_offers"("farmerId");

-- CreateIndex
CREATE INDEX "supplier_offers_status_idx" ON "supplier_offers"("status");

-- CreateIndex
CREATE INDEX "supplier_offers_orderId_idx" ON "supplier_offers"("orderId");

-- CreateIndex
CREATE INDEX "recurring_orders_buyerId_idx" ON "recurring_orders"("buyerId");

-- CreateIndex
CREATE INDEX "recurring_orders_farmerId_idx" ON "recurring_orders"("farmerId");

-- CreateIndex
CREATE INDEX "recurring_orders_isActive_idx" ON "recurring_orders"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "transport_requests_requestNumber_key" ON "transport_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "transport_requests_providerId_idx" ON "transport_requests"("providerId");

-- CreateIndex
CREATE INDEX "transport_requests_requesterId_idx" ON "transport_requests"("requesterId");

-- CreateIndex
CREATE INDEX "transport_requests_status_idx" ON "transport_requests"("status");

-- CreateIndex
CREATE INDEX "transport_requests_requestNumber_idx" ON "transport_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "transport_requests_pickupScheduleId_idx" ON "transport_requests"("pickupScheduleId");

-- CreateIndex
CREATE INDEX "transport_requests_orderId_idx" ON "transport_requests"("orderId");

-- CreateIndex
CREATE INDEX "tracking_updates_requestId_idx" ON "tracking_updates"("requestId");

-- CreateIndex
CREATE INDEX "tracking_updates_createdAt_idx" ON "tracking_updates"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "farm_pickup_schedules_scheduleNumber_key" ON "farm_pickup_schedules"("scheduleNumber");

-- CreateIndex
CREATE INDEX "farm_pickup_schedules_providerId_idx" ON "farm_pickup_schedules"("providerId");

-- CreateIndex
CREATE INDEX "farm_pickup_schedules_aggregationCenterId_idx" ON "farm_pickup_schedules"("aggregationCenterId");

-- CreateIndex
CREATE INDEX "farm_pickup_schedules_status_idx" ON "farm_pickup_schedules"("status");

-- CreateIndex
CREATE INDEX "farm_pickup_schedules_scheduledDate_idx" ON "farm_pickup_schedules"("scheduledDate");

-- CreateIndex
CREATE INDEX "farm_pickup_schedules_scheduleNumber_idx" ON "farm_pickup_schedules"("scheduleNumber");

-- CreateIndex
CREATE INDEX "pickup_locations_scheduleId_idx" ON "pickup_locations"("scheduleId");

-- CreateIndex
CREATE INDEX "pickup_slots_scheduleId_idx" ON "pickup_slots"("scheduleId");

-- CreateIndex
CREATE INDEX "pickup_slots_status_idx" ON "pickup_slots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_slot_bookings_batchId_key" ON "pickup_slot_bookings"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_slot_bookings_pickupReceiptId_key" ON "pickup_slot_bookings"("pickupReceiptId");

-- CreateIndex
CREATE INDEX "pickup_slot_bookings_slotId_idx" ON "pickup_slot_bookings"("slotId");

-- CreateIndex
CREATE INDEX "pickup_slot_bookings_scheduleId_idx" ON "pickup_slot_bookings"("scheduleId");

-- CreateIndex
CREATE INDEX "pickup_slot_bookings_farmerId_idx" ON "pickup_slot_bookings"("farmerId");

-- CreateIndex
CREATE INDEX "pickup_slot_bookings_batchId_idx" ON "pickup_slot_bookings"("batchId");

-- CreateIndex
CREATE INDEX "pickup_slot_bookings_status_idx" ON "pickup_slot_bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_receipts_receiptNumber_key" ON "pickup_receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_receipts_bookingId_key" ON "pickup_receipts"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_receipts_batchId_key" ON "pickup_receipts"("batchId");

-- CreateIndex
CREATE INDEX "pickup_receipts_farmerId_idx" ON "pickup_receipts"("farmerId");

-- CreateIndex
CREATE INDEX "pickup_receipts_batchId_idx" ON "pickup_receipts"("batchId");

-- CreateIndex
CREATE INDEX "pickup_receipts_receiptNumber_idx" ON "pickup_receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "aggregation_centers_code_key" ON "aggregation_centers"("code");

-- CreateIndex
CREATE INDEX "aggregation_centers_code_idx" ON "aggregation_centers"("code");

-- CreateIndex
CREATE INDEX "aggregation_centers_status_idx" ON "aggregation_centers"("status");

-- CreateIndex
CREATE INDEX "aggregation_centers_county_idx" ON "aggregation_centers"("county");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_transactionNumber_key" ON "stock_transactions"("transactionNumber");

-- CreateIndex
CREATE INDEX "stock_transactions_centerId_idx" ON "stock_transactions"("centerId");

-- CreateIndex
CREATE INDEX "stock_transactions_batchId_idx" ON "stock_transactions"("batchId");

-- CreateIndex
CREATE INDEX "stock_transactions_type_idx" ON "stock_transactions"("type");

-- CreateIndex
CREATE INDEX "stock_transactions_orderId_idx" ON "stock_transactions"("orderId");

-- CreateIndex
CREATE INDEX "stock_transactions_createdAt_idx" ON "stock_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_batchId_key" ON "inventory_items"("batchId");

-- CreateIndex
CREATE INDEX "inventory_items_centerId_idx" ON "inventory_items"("centerId");

-- CreateIndex
CREATE INDEX "inventory_items_batchId_idx" ON "inventory_items"("batchId");

-- CreateIndex
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");

-- CreateIndex
CREATE INDEX "inventory_items_stockInDate_idx" ON "inventory_items"("stockInDate");

-- CreateIndex
CREATE UNIQUE INDEX "quality_checks_orderId_key" ON "quality_checks"("orderId");

-- CreateIndex
CREATE INDEX "quality_checks_centerId_idx" ON "quality_checks"("centerId");

-- CreateIndex
CREATE INDEX "quality_checks_orderId_idx" ON "quality_checks"("orderId");

-- CreateIndex
CREATE INDEX "quality_checks_transactionId_idx" ON "quality_checks"("transactionId");

-- CreateIndex
CREATE INDEX "quality_checks_checkedBy_idx" ON "quality_checks"("checkedBy");

-- CreateIndex
CREATE INDEX "quality_checks_checkedAt_idx" ON "quality_checks"("checkedAt");

-- CreateIndex
CREATE INDEX "wastage_entries_centerId_idx" ON "wastage_entries"("centerId");

-- CreateIndex
CREATE INDEX "wastage_entries_batchId_idx" ON "wastage_entries"("batchId");

-- CreateIndex
CREATE INDEX "wastage_entries_category_idx" ON "wastage_entries"("category");

-- CreateIndex
CREATE INDEX "wastage_entries_recordedAt_idx" ON "wastage_entries"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_referenceNumber_key" ON "payments"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transportId_key" ON "payments"("transportId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_inputOrderId_key" ON "payments"("inputOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_referenceNumber_idx" ON "payments"("referenceNumber");

-- CreateIndex
CREATE INDEX "payments_payerId_idx" ON "payments"("payerId");

-- CreateIndex
CREATE INDEX "payments_payeeId_idx" ON "payments"("payeeId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transactions_orderId_key" ON "escrow_transactions"("orderId");

-- CreateIndex
CREATE INDEX "escrow_transactions_orderId_idx" ON "escrow_transactions"("orderId");

-- CreateIndex
CREATE INDEX "escrow_transactions_status_idx" ON "escrow_transactions"("status");

-- CreateIndex
CREATE INDEX "inputs_providerId_idx" ON "inputs"("providerId");

-- CreateIndex
CREATE INDEX "inputs_category_idx" ON "inputs"("category");

-- CreateIndex
CREATE INDEX "inputs_status_idx" ON "inputs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "input_orders_orderNumber_key" ON "input_orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "input_orders_transportRequestId_key" ON "input_orders"("transportRequestId");

-- CreateIndex
CREATE INDEX "input_orders_farmerId_idx" ON "input_orders"("farmerId");

-- CreateIndex
CREATE INDEX "input_orders_inputId_idx" ON "input_orders"("inputId");

-- CreateIndex
CREATE INDEX "input_orders_status_idx" ON "input_orders"("status");

-- CreateIndex
CREATE INDEX "input_orders_orderNumber_idx" ON "input_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "ratings_ratedUserId_idx" ON "ratings"("ratedUserId");

-- CreateIndex
CREATE INDEX "ratings_orderId_idx" ON "ratings"("orderId");

-- CreateIndex
CREATE INDEX "ratings_raterId_idx" ON "ratings"("raterId");

-- CreateIndex
CREATE INDEX "advisories_createdBy_idx" ON "advisories"("createdBy");

-- CreateIndex
CREATE INDEX "advisories_type_idx" ON "advisories"("type");

-- CreateIndex
CREATE INDEX "advisories_isActive_idx" ON "advisories"("isActive");

-- CreateIndex
CREATE INDEX "advisories_targetValue_idx" ON "advisories"("targetValue");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "produce_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "sourcing_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "produce_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_responses" ADD CONSTRAINT "rfq_responses_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_responses" ADD CONSTRAINT "rfq_responses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_responses" ADD CONSTRAINT "rfq_responses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_requests" ADD CONSTRAINT "sourcing_requests_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "sourcing_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_pickupScheduleId_fkey" FOREIGN KEY ("pickupScheduleId") REFERENCES "farm_pickup_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_pickupSlotId_fkey" FOREIGN KEY ("pickupSlotId") REFERENCES "pickup_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_updates" ADD CONSTRAINT "tracking_updates_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "transport_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_pickup_schedules" ADD CONSTRAINT "farm_pickup_schedules_aggregationCenterId_fkey" FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_locations" ADD CONSTRAINT "pickup_locations_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "farm_pickup_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "farm_pickup_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "pickup_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_slot_bookings" ADD CONSTRAINT "pickup_slot_bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "pickup_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_receipts" ADD CONSTRAINT "pickup_receipts_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "pickup_slot_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_receipts" ADD CONSTRAINT "pickup_receipts_aggregationCenterId_fkey" FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_checkedBy_fkey" FOREIGN KEY ("checkedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage_entries" ADD CONSTRAINT "wastage_entries_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transport_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_inputOrderId_fkey" FOREIGN KEY ("inputOrderId") REFERENCES "input_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inputs" ADD CONSTRAINT "inputs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "inputs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_transportRequestId_fkey" FOREIGN KEY ("transportRequestId") REFERENCES "transport_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratedUserId_fkey" FOREIGN KEY ("ratedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisories" ADD CONSTRAINT "advisories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
