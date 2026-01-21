# Supplementary Migrations Guide

**Adding custom functions, triggers, views, and constraints to Prisma-generated schema**

---

## Overview

The Prisma-generated migration (`20260121110648_initial_schema`) creates all tables, but **doesn't include**:
- Custom SQL functions
- Database triggers
- Views
- Check constraints
- Partial indexes
- Table comments

These are added via **3 supplementary migrations**.

---

## Migration Files

### 1. Custom Functions
**File:** `20260121120000_custom_functions/migration.sql`

**Contains:**
- ✅ 11 number generation functions
- ✅ 6 utility functions
- ⚠️ UUIDv7 function **SKIPPED** (using Prisma's UUIDv4)

**Functions:**
- `generate_order_number()` - ORD-YYYYMMDD-000001
- `generate_batch_id()` - Variety-YYYYMMDD-000001
- `generate_negotiation_number()` - NEG-YYYYMMDD-000001
- `generate_rfq_number()` - RFQ-YYYYMMDD-000001
- `generate_sourcing_request_id()` - SR-YYYYMMDD-000001
- `generate_payment_reference()` - PAY-YYYYMMDD-000001
- `generate_transport_request_number()` - TR-YYYYMMDD-000001
- `generate_pickup_schedule_number()` - PUS-YYYYMMDD-000001
- `generate_pickup_receipt_number()` - PUR-YYYYMMDD-000001
- `generate_stock_transaction_number()` - ST-YYYYMMDD-000001
- `generate_input_order_number()` - INP-YYYYMMDD-000001
- `update_status_history()` - Updates status history JSONB
- `user_has_role()` - Role check utility
- `get_user_full_name()` - Get user name from profile
- `create_notification()` - Create notification (uses UUIDv4)
- `update_center_stock()` - Update aggregation center stock
- `calculate_storage_duration()` - Calculate storage days
- `calculate_slot_capacity()` - Calculate slot capacity
- `calculate_schedule_capacity()` - Calculate schedule capacity
- `update_user_rating()` - Update user profile rating
- `update_input_stock()` - Update input stock on order
- `create_escrow_on_payment_secured()` - Auto-create escrow

---

### 2. Triggers
**File:** `20260121120001_triggers/migration.sql`

**Contains:**
- ✅ Auto-update triggers (20+ tables)
- ✅ Denormalized field triggers
- ✅ Status history triggers
- ✅ Notification triggers
- ✅ Stock management triggers
- ✅ Rating triggers

**Triggers:**
- `update_*_updated_at` - Auto-update `updatedAt` on all tables
- `rfq_response_count_update` - Maintains RFQ.totalResponses
- `rfq_awarded_to_update` - Maintains RFQ.awardedTo array
- `sourcing_request_suppliers_update` - Maintains SourcingRequest.suppliers array
- `supplier_offer_converted_update` - Updates SupplierOffer status
- `marketplace_order_status_trigger` - Updates status history
- `order_status_notification` - Creates notifications
- `payment_escrow_creation` - Creates escrow automatically
- `inventory_stock_update` - Updates center stock
- `calculate_inventory_storage_duration` - Calculates storage duration
- `rating_profile_update` - Updates user rating
- `rating_validation` - Validates rating (1-5)
- `input_order_stock_update` - Updates input stock
- `calculate_pickup_slot_capacity` - Calculates slot capacity
- `calculate_pickup_schedule_capacity` - Calculates schedule capacity

---

### 3. Views & Constraints
**File:** `20260121120002_views_constraints/migration.sql`

**Contains:**
- ✅ Analytics views (3 views)
- ✅ Check constraints (data validation)
- ✅ Partial indexes (performance)
- ✅ Table comments

**Views:**
- `order_statistics` - Order stats by status
- `farmer_performance` - Farmer performance metrics
- `center_stock_summary` - Center stock summary

**Constraints:**
- Rating validation (1-5)
- Quantity validation (positive)
- Price validation (positive)
- Capacity validation
- Color intensity validation (1-10)

**Partial Indexes:**
- Active listings
- Pending orders
- Unread notifications
- Active RFQs
- Pending transport requests

---

## Execution Order

**Critical:** Migrations must be applied in this exact order:

```
1. 20260121110648_initial_schema (Prisma-generated tables)
   ↓
2. 20260121120000_custom_functions (Functions needed by triggers)
   ↓
3. 20260121120001_triggers (Triggers that use functions)
   ↓
4. 20260121120002_views_constraints (Views, constraints, indexes)
```

---

## How to Apply

### Option 1: Using Prisma Migrate (Recommended)

```bash
# Prisma will apply migrations in order automatically
npx prisma migrate deploy
```

### Option 2: Manual SQL Execution

```bash
# Apply in order
psql -d $DATABASE_URL -f prisma/migrations/20260121110648_initial_schema/migration.sql
psql -d $DATABASE_URL -f prisma/migrations/20260121120000_custom_functions/migration.sql
psql -d $DATABASE_URL -f prisma/migrations/20260121120001_triggers/migration.sql
psql -d $DATABASE_URL -f prisma/migrations/20260121120002_views_constraints/migration.sql
```

---

## Verification

After applying all migrations, verify everything was created:

```sql
-- Check functions (should see 17 functions)
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Check triggers (should see 20+ triggers)
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Check views (should see 3 views)
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check constraints (should see 10+ check constraints)
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_schema = 'public' 
  AND constraint_type = 'CHECK'
ORDER BY table_name, constraint_name;
```

---

## What's Included vs Manual Migrations

### ✅ Included from Manual Migrations:
- All number generation functions (002-008)
- All utility functions (009)
- All triggers (001-009)
- All views (009)
- All constraints (009)
- All partial indexes (009)
- All comments (001-009)

### ⚠️ Skipped:
- `gen_uuidv7()` function - Using Prisma's UUIDv4 instead

---

## Notes

1. **UUID Generation:** Using PostgreSQL's `gen_random_uuid()` (UUIDv4) instead of custom UUIDv7
2. **Function Dependencies:** Functions must be created before triggers that use them
3. **Trigger Dependencies:** Some triggers depend on functions from migration 1
4. **View Dependencies:** Views depend on tables from initial schema

---

**Status:** ✅ All supplementary migrations created and ready to apply
