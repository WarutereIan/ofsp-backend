# Prisma Schema Summary - OFSP Platform

**Complete database schema organized by entity lifecycle stages**

---

## Schema Overview

**Total Models:** 30+  
**Total Enums:** 20+  
**Database:** PostgreSQL

---

## Stage Breakdown

### ✅ Stage 1: Core Foundation
- `User` - User accounts (8 roles)
- `Profile` - Extended user profiles
- `RefreshToken` - JWT refresh tokens
- `Notification` - User notifications
- `ActivityLog` - Audit trail

### ✅ Stage 2: Marketplace Core
- `ProduceListing` - Farmer produce listings
- `MarketplaceOrder` - Buyer orders (12 statuses)

### ✅ Stage 3: Negotiations & RFQ
- `Negotiation` - Buyer-farmer negotiations
- `NegotiationMessage` - Negotiation thread
- `RFQ` - Request for Quotation
- `RFQResponse` - Supplier quotes
- `SourcingRequest` - Buyer sourcing requests
- `SupplierOffer` - Farmer offers
- `RecurringOrder` - Recurring orders

### ✅ Stage 4: Transport & Pickup Schedules
- `TransportRequest` - Transport requests
- `FarmPickupSchedule` - Scheduled pickup routes
- `PickupLocation` - Pickup locations
- `PickupSlot` - Time slots
- `PickupSlotBooking` - Farmer bookings
- `PickupReceipt` - Pickup confirmation receipts
- `TrackingUpdate` - Delivery tracking

### ✅ Stage 5: Aggregation & Storage
- `AggregationCenter` - Storage centers
- `StockTransaction` - Stock in/out/transfer/wastage
- `InventoryItem` - Current inventory
- `QualityCheck` - Quality assessments (with grading matrix)
- `WastageEntry` - Wastage tracking

### ✅ Stage 6: Payments & Escrow
- `Payment` - Payment transactions
- `EscrowTransaction` - Escrow management

### ✅ Stage 7: Input Orders
- `Input` - Agricultural input products
- `InputOrder` - Farmer input orders

### ✅ Stage 8: Ratings & Advisories
- `Rating` - User ratings and reviews
- `Advisory` - Extension officer advisories

---

## Key Features

### Traceability
- Every produce batch has `batchId` and `qrCode`
- Full lifecycle tracking from farm to buyer
- Status history stored as JSON arrays

### Relationships
- Comprehensive foreign key relationships
- Cascade deletes where appropriate
- Denormalized fields for performance (farmerName, buyerName, etc.)

### Indexes
- Strategic indexes on:
  - Foreign keys
  - Status fields
  - Search fields (email, phone, orderNumber, etc.)
  - Composite indexes for common queries

### Data Integrity
- Unique constraints on:
  - Order numbers
  - Batch IDs
  - RFQ numbers
  - Receipt numbers
  - Email and phone

### Grading Matrix Integration
- QualityCheck includes all 4 criteria:
  - Weight Range
  - Color Intensity (1-10)
  - Physical Condition
  - Freshness
- Automatic grade calculation support

---

## Next Steps

1. **Create `.env` file** with `DATABASE_URL`
2. **Run first migration:**
   ```bash
   npm run prisma:migrate
   ```
3. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```
4. **Seed database:**
   ```bash
   npm run prisma:seed
   ```

---

## Migration Strategy

The schema is designed to be migrated in stages, but can also be applied as a single migration. For production, consider:

1. **Initial Migration:** Stages 1-2 (Core + Marketplace)
2. **Feature Migrations:** Add remaining stages incrementally
3. **Data Migration:** Migrate existing data if any
4. **Functions Migration:** Add database functions and triggers

---

## Database Functions (Future)

Planned SQL functions:
- `generate_order_number()` - Unique order number generation
- `generate_batch_id()` - Batch ID with variety prefix
- `calculate_capacity()` - Real-time capacity calculations
- `update_status_history()` - Automatic status history updates
- `trigger_notifications()` - Notification triggers on status changes

---

**Schema Version:** 1.0  
**Last Updated:** January 2025
