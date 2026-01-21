# Migration Execution Order

**Correct order for applying all migrations**

---

## Migration Sequence

### 1. Initial Schema (Prisma-Generated)
**Migration:** `20260121110648_initial_schema`

**Contains:**
- All 32 tables
- All 20+ enum types
- All foreign keys
- All basic indexes
- All unique constraints

**Status:** ✅ Already applied (if you ran `prisma migrate dev`)

---

### 2. Custom Functions
**Migration:** `20260121120000_custom_functions`

**Contains:**
- Number generation functions (12 functions)
- Utility functions (6 functions)
- **Note:** UUIDv7 function skipped - using Prisma's UUIDv4

**Functions:**
- `generate_order_number()`
- `generate_batch_id()`
- `generate_negotiation_number()`
- `generate_rfq_number()`
- `generate_sourcing_request_id()`
- `generate_payment_reference()`
- `generate_transport_request_number()`
- `generate_pickup_schedule_number()`
- `generate_pickup_receipt_number()`
- `generate_stock_transaction_number()`
- `generate_input_order_number()`
- `update_status_history()`
- `user_has_role()`
- `get_user_full_name()`
- `create_notification()`
- `update_center_stock()`
- `calculate_storage_duration()`
- `calculate_slot_capacity()`
- `calculate_schedule_capacity()`
- `update_user_rating()`
- `update_input_stock()`

**Dependencies:** Requires `20260121110648_initial_schema`

---

### 3. Triggers
**Migration:** `20260121120001_triggers`

**Contains:**
- Auto-update triggers (20+ tables)
- Denormalized field triggers
- Status history triggers
- Notification triggers
- Stock management triggers
- Rating triggers

**Dependencies:** Requires `20260121120000_custom_functions`

---

### 4. Views & Constraints
**Migration:** `20260121120002_views_constraints`

**Contains:**
- Analytics views (3 views)
- Check constraints (data validation)
- Partial indexes (performance)
- Table comments

**Dependencies:** Requires `20260121120001_triggers`

---

## Execution Commands

### Option 1: Using Prisma Migrate

```bash
# Migrations will be applied automatically in order
npx prisma migrate deploy
```

### Option 2: Manual SQL Execution

```bash
# Apply in order using psql
psql -d $DATABASE_URL -f prisma/migrations/20260121110648_initial_schema/migration.sql
psql -d $DATABASE_URL -f prisma/migrations/20260121120000_custom_functions/migration.sql
psql -d $DATABASE_URL -f prisma/migrations/20260121120001_triggers/migration.sql
psql -d $DATABASE_URL -f prisma/migrations/20260121120002_views_constraints/migration.sql
```

---

## Verification

After applying all migrations, verify:

```sql
-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- Check triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check views
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public';

-- Check constraints
SELECT constraint_name, table_name FROM information_schema.table_constraints 
WHERE constraint_schema = 'public' AND constraint_type = 'CHECK';
```

---

**Migration Order:** ✅ Defined and ready to execute
