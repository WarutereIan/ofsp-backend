# Migration Comparison Report

**Comparing Prisma-generated migration vs Manual SQL migrations**

**Date:** January 2025

---

## Overview

You have:
1. **Prisma-generated migration:** `20260121110648_initial_schema/migration.sql`
2. **Manual SQL migrations:** `001_init_user_auth_notifications.sql` through `009_functions_constraints.sql`

This document compares what's in each and identifies what's missing.

---

## Key Differences

### ✅ What Prisma Migration Includes

1. **All Tables** - All 32 models as tables
2. **All Enums** - All enum types
3. **Foreign Keys** - All relationships
4. **Indexes** - Basic indexes from schema
5. **Unique Constraints** - All unique fields
6. **Default Values** - Basic defaults (but NOT `gen_uuidv7()`)

### ❌ What Prisma Migration MISSES

1. **Custom SQL Functions:**
   - ⚠️ `gen_uuidv7()` - **SKIPPED** (using Prisma's UUIDv4 instead)
   - ❌ `generate_order_number()` - Order number generation
   - ❌ `generate_batch_id()` - Batch ID generation
   - ❌ `generate_rfq_number()` - RFQ number generation
   - ❌ `generate_negotiation_number()` - Negotiation number generation
   - ❌ `generate_sourcing_request_id()` - Sourcing request ID generation
   - ❌ `generate_payment_reference()` - Payment reference generation
   - ❌ `generate_transport_request_number()` - Transport request number generation
   - ❌ `generate_pickup_schedule_number()` - Pickup schedule number generation
   - ❌ `generate_pickup_receipt_number()` - Pickup receipt number generation
   - ❌ `generate_stock_transaction_number()` - Stock transaction number generation
   - ❌ `generate_input_order_number()` - Input order number generation
   - ❌ `update_status_history()` - Status history update function
   - ❌ `create_notification()` - Notification creation function
   - ❌ `update_center_stock()` - Center stock update function
   - ❌ `calculate_slot_capacity()` - Slot capacity calculation
   - ❌ `calculate_schedule_capacity()` - Schedule capacity calculation
   - ❌ `update_user_rating()` - User rating update function
   - ❌ `update_input_stock()` - Input stock update function
   - ❌ `user_has_role()` - Role check function
   - ❌ `get_user_full_name()` - User name function

2. **Triggers:**
   - ❌ `update_updated_at_column()` - Auto-update `updatedAt` on all tables
   - ❌ `rfq_response_count_update` - Maintains RFQ totalResponses
   - ❌ `rfq_awarded_to_update` - Maintains RFQ awardedTo array
   - ❌ `sourcing_request_suppliers_update` - Maintains SourcingRequest suppliers array
   - ❌ `supplier_offer_converted_update` - Updates SupplierOffer status to converted
   - ❌ `marketplace_order_status_trigger` - Updates status history
   - ❌ `order_status_notification` - Creates notifications on status change
   - ❌ `payment_escrow_creation` - Creates escrow on payment secured
   - ❌ `inventory_stock_update` - Updates center stock
   - ❌ `calculate_inventory_storage_duration` - Calculates storage duration
   - ❌ `rating_profile_update` - Updates user rating
   - ❌ `input_order_stock_update` - Updates input stock
   - ❌ `calculate_pickup_slot_capacity` - Calculates slot capacity
   - ❌ `calculate_pickup_schedule_capacity` - Calculates schedule capacity

3. **Database Defaults:**
   - ❌ `DEFAULT gen_uuidv7()` on ID fields (Prisma uses `@default(uuid())` which generates UUIDv4)
   - ❌ Custom default functions

4. **Views:**
   - ❌ `order_statistics` - Order statistics view
   - ❌ `farmer_performance` - Farmer performance view
   - ❌ `center_stock_summary` - Center stock summary view

5. **Check Constraints:**
   - ❌ Rating validation (1-5)
   - ❌ Quantity validation (positive)
   - ❌ Price validation (positive)
   - ❌ Capacity validation
   - ❌ Color intensity validation (1-10)

6. **Partial Indexes:**
   - ❌ Performance-optimized partial indexes

7. **Comments:**
   - ❌ Table comments
   - ❌ Function comments
   - ❌ View comments

---

## What This Means

### Prisma Migration Status

**✅ Complete for:**
- Table structure
- Basic relationships
- Basic indexes
- Enum types

**❌ Missing:**
- All custom business logic (functions, triggers)
- Database-level optimizations
- Custom constraints
- Views for analytics
- UUIDv7 generation

---

## Recommended Approach

### Option 1: Use Prisma Migration + Add Missing SQL (Recommended)

**Steps:**
1. ✅ Keep the Prisma-generated migration for table structure
2. ✅ Create additional migration files for:
   - Custom functions (from 001, 002, 003, etc.)
   - Triggers (from 009)
   - Views (from 009)
   - Constraints (from 009)

**Structure:**
```
prisma/migrations/
├── 20260121110648_initial_schema/
│   └── migration.sql (Prisma-generated tables)
├── 20260121120000_custom_functions/
│   └── migration.sql (All custom functions)
├── 20260121120001_triggers/
│   └── migration.sql (All triggers)
└── 20260121120002_views_constraints/
    └── migration.sql (Views, constraints, partial indexes)
```

### Option 2: Replace Prisma Migration with Manual SQL

**Steps:**
1. Delete Prisma-generated migration
2. Use your manual SQL migrations in order
3. Mark them as applied in Prisma's migration history

**Structure:**
```
prisma/migrations/
├── 001_init_user_auth_notifications/
│   └── migration.sql (from your 001 file)
├── 002_marketplace_listings_orders/
│   └── migration.sql (from your 002 file)
... etc
```

---

## Detailed Comparison by Feature

### 1. UUID Generation

**Manual Migration (001):**
```sql
CREATE OR REPLACE FUNCTION gen_uuidv7() RETURNS TEXT AS $$
-- Full UUIDv7 implementation
$$ LANGUAGE plpgsql;

-- Used in tables:
"id" TEXT NOT NULL DEFAULT gen_uuidv7()
```

**Prisma Migration:**
```sql
-- No function
-- Uses: @default(uuid()) which generates UUIDv4
"id" TEXT NOT NULL DEFAULT gen_random_uuid()::text
```

**Impact:** ✅ Using UUIDv4 (Prisma default) - UUIDv7 skipped per decision

---

### 2. Number Generation Functions

**Manual Migrations:**
- `generate_order_number()` - Creates "ORD-YYYYMMDD-000001"
- `generate_batch_id()` - Creates batch IDs
- `generate_rfq_number()` - Creates "RFQ-YYYYMMDD-000001"
- etc.

**Prisma Migration:**
- ❌ None - Application must generate these

**Impact:** ⚠️ Need to implement in application code

---

### 3. Auto-Update Triggers

**Manual Migration (009):**
```sql
CREATE TRIGGER update_updated_at_column
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Applied to all tables
```

**Prisma Migration:**
- ❌ None - Prisma handles `@updatedAt` at application level

**Impact:** ✅ Prisma handles this, but database-level trigger is more reliable

---

### 4. Denormalized Field Triggers

**Manual Migration (009):**
```sql
-- Maintains RFQ.totalResponses automatically
CREATE TRIGGER rfq_response_count_update
AFTER INSERT OR DELETE ON "rfq_responses"
FOR EACH ROW EXECUTE FUNCTION update_rfq_response_count();

-- Maintains RFQ.awardedTo array automatically
CREATE TRIGGER rfq_awarded_to_update
AFTER INSERT OR UPDATE OF "status" ON "rfq_responses"
FOR EACH ROW EXECUTE FUNCTION update_rfq_awarded_to();

-- Maintains SourcingRequest.suppliers array automatically
CREATE TRIGGER sourcing_request_suppliers_update
AFTER INSERT OR DELETE ON "supplier_offers"
FOR EACH ROW EXECUTE FUNCTION update_sourcing_request_suppliers();

-- Updates SupplierOffer status to "converted"
CREATE TRIGGER supplier_offer_converted_update
AFTER INSERT ON "marketplace_orders"
FOR EACH ROW EXECUTE FUNCTION update_supplier_offer_converted();
```

**Prisma Migration:**
- ❌ None - Application must maintain these fields

**Impact:** ⚠️ **CRITICAL** - Denormalized fields won't auto-update

---

### 5. Status History & Notifications

**Manual Migration (009):**
```sql
-- Auto-updates statusHistory JSONB array
CREATE TRIGGER marketplace_order_status_trigger
AFTER UPDATE OF "status" ON "marketplace_orders"
FOR EACH ROW EXECUTE FUNCTION update_status_history(...);

-- Creates notifications on status change
CREATE TRIGGER order_status_notification
AFTER UPDATE OF "status" ON "marketplace_orders"
FOR EACH ROW EXECUTE FUNCTION create_notification(...);
```

**Prisma Migration:**
- ❌ None - Application must handle

**Impact:** ⚠️ Status history and notifications must be implemented in app

---

### 6. Stock Management Triggers

**Manual Migration (009):**
```sql
-- Auto-updates aggregation center stock
CREATE TRIGGER inventory_stock_update
AFTER INSERT OR UPDATE OR DELETE ON "inventory_items"
FOR EACH ROW EXECUTE FUNCTION update_center_stock();

-- Calculates storage duration
CREATE TRIGGER calculate_inventory_storage_duration
AFTER INSERT OR UPDATE ON "inventory_items"
FOR EACH ROW EXECUTE FUNCTION calculate_storage_duration();
```

**Prisma Migration:**
- ❌ None - Application must calculate

**Impact:** ⚠️ Stock calculations must be in application

---

### 7. Views

**Manual Migration (009):**
```sql
CREATE VIEW "order_statistics" AS
SELECT status, COUNT(*) as count, SUM("totalAmount") as total
FROM "marketplace_orders"
GROUP BY status;

CREATE VIEW "farmer_performance" AS
-- Performance metrics for farmers

CREATE VIEW "center_stock_summary" AS
-- Stock summary for centers
```

**Prisma Migration:**
- ❌ None - No views

**Impact:** ⚠️ Analytics queries must be written in application

---

### 8. Check Constraints

**Manual Migration (009):**
```sql
-- Rating validation
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rating_check" 
CHECK ("rating" >= 1 AND "rating" <= 5);

-- Quantity validation
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "orders_quantity_check"
CHECK ("quantity" > 0);

-- Price validation
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "orders_price_check"
CHECK ("pricePerKg" > 0);
```

**Prisma Migration:**
- ❌ None - Validation only at application level

**Impact:** ⚠️ Data integrity relies on application validation

---

## Recommendation

### ✅ Use Hybrid Approach

1. **Keep Prisma migration** for table structure (it's correct)
2. **Add supplementary migrations** for:
   - Custom functions (from 001-008)
   - Triggers (from 009)
   - Views (from 009)
   - Constraints (from 009)

### Migration Order

```
1. 20260121110648_initial_schema (Prisma-generated tables)
2. 20260121120000_custom_functions (All functions from 001-008)
3. 20260121120001_triggers (All triggers from 009)
4. 20260121120002_views_constraints (Views, constraints from 009)
```

---

## Next Steps

1. **Review Prisma migration** - Verify table structure matches expectations
2. **Create supplementary migrations** - Extract functions, triggers, views from manual migrations
3. **Test migration order** - Ensure dependencies are correct
4. **Apply migrations** - Run in order
5. **Verify** - Check that all functions, triggers, views are created

---

## Files to Create

### Migration: Custom Functions
**File:** `prisma/migrations/20260121120000_custom_functions/migration.sql`

**Contents:**
- `gen_uuidv7()` from 001
- All `generate_*_number()` functions from 002-008
- Utility functions from 009

### Migration: Triggers
**File:** `prisma/migrations/20260121120001_triggers/migration.sql`

**Contents:**
- `update_updated_at_column()` trigger for all tables
- Denormalized field triggers (RFQ, SourcingRequest, SupplierOffer)
- Status history triggers
- Stock management triggers
- Rating triggers
- Input stock triggers
- Capacity calculation triggers

### Migration: Views & Constraints
**File:** `prisma/migrations/20260121120002_views_constraints/migration.sql`

**Contents:**
- Analytics views
- Check constraints
- Partial indexes
- Comments

---

**Status:** Ready to create supplementary migrations
