# SQL Migrations - OFSP Platform

**Stage-by-stage SQL migrations for maintainable database schema evolution**

---

## Migration Structure

Each migration is self-contained and can be run independently. Migrations are numbered sequentially and include all necessary:
- Enums
- Tables
- Foreign Keys
- Indexes
- Unique Constraints
- Triggers
- Functions
- Comments

---

## Migration Files

### 001_init_user_auth_notifications.sql
**Stage:** Core Foundation  
**Dependencies:** None  
**Models:** User, Profile, RefreshToken, Notification, ActivityLog  
**Features:**
- User authentication foundation
- Role-based access control (8 roles)
- User profiles with location data
- Notification system
- Activity logging for audit trail
- Auto-updating `updatedAt` triggers

---

### 002_marketplace_listings_orders.sql
**Stage:** Marketplace Core  
**Dependencies:** 001  
**Models:** ProduceListing, MarketplaceOrder  
**Features:**
- Produce listings with batch tracking
- Order lifecycle (14 statuses)
- Status history tracking
- Order number generation function
- Batch ID generation function
- Payment status tracking

---

### 003_negotiations_rfq.sql
**Stage:** Negotiations & RFQ  
**Dependencies:** 002  
**Models:** Negotiation, NegotiationMessage, RFQ, RFQResponse, SourcingRequest, SupplierOffer, RecurringOrder  
**Features:**
- Negotiation workflows
- RFQ system with evaluation
- Sourcing requests
- Recurring orders
- Number generation functions for all entity types

---

### 004_transport_pickup_schedules.sql
**Stage:** Transport & Pickup Schedules  
**Dependencies:** 002, 005 (AggregationCenter)  
**Models:** TransportRequest, TrackingUpdate, FarmPickupSchedule, PickupLocation, PickupSlot, PickupSlotBooking, PickupReceipt  
**Features:**
- Transport request lifecycle
- Scheduled pickup routes
- Time slot bookings
- Pickup confirmation receipts
- Real-time tracking updates
- Capacity management

---

### 005_aggregation_storage.sql
**Stage:** Aggregation & Storage  
**Dependencies:** 002  
**Models:** AggregationCenter, StockTransaction, InventoryItem, QualityCheck, WastageEntry  
**Features:**
- Storage center management
- Stock in/out/transfer/wastage transactions
- Inventory tracking with batch IDs
- Quality checks with 4-criteria grading matrix
- Wastage tracking
- Capacity calculations

---

### 006_payments_escrow.sql
**Stage:** Payments & Escrow  
**Dependencies:** 002, 004  
**Models:** Payment, EscrowTransaction  
**Features:**
- Payment processing (M-Pesa, Bank, Cash, Credit)
- Escrow management for marketplace orders
- Payment status tracking
- Dispute handling
- Reference number generation

---

### 007_input_orders.sql
**Stage:** Input Orders  
**Dependencies:** 001, 004  
**Models:** Input, InputOrder  
**Features:**
- Agricultural input catalog
- Input order lifecycle
- Integration with transport
- Payment tracking
- Stock management

---

### 008_ratings_advisories.sql
**Stage:** Ratings & Advisories  
**Dependencies:** 001, 002  
**Models:** Rating, Advisory  
**Features:**
- User rating system (1-5 stars)
- Extension officer advisories
- Target audience filtering
- Delivery tracking
- View analytics

---

### 009_functions_constraints.sql
**Stage:** Database Functions & Constraints  
**Dependencies:** All previous migrations  
**Features:**
- Shared utility functions
- Status transition triggers
- Notification triggers
- Capacity calculation triggers
- Check constraints for data integrity
- Views for analytics
- Performance optimizations

---

## Running Migrations

### Option 1: Using Prisma Migrate (Recommended)

```bash
# Create migration from schema
npm run prisma:migrate -- --name init_complete_schema

# Or apply existing SQL migrations
npx prisma migrate deploy
```

### Option 2: Direct SQL Execution

```bash
# Run migrations in order
psql -U username -d database_name -f prisma/migrations/001_init_user_auth_notifications.sql
psql -U username -d database_name -f prisma/migrations/002_marketplace_listings_orders.sql
# ... continue for all migrations
```

### Option 3: Using Migration Tool

```bash
# If using a migration tool like Flyway or Liquibase
# Follow tool-specific instructions
```

---

## Migration Order

**Critical:** Migrations must be run in numerical order due to dependencies:

1. `001_init_user_auth_notifications.sql` - Base foundation
2. `002_marketplace_listings_orders.sql` - Requires users
3. `003_negotiations_rfq.sql` - Requires marketplace
4. `005_aggregation_storage.sql` - Requires marketplace (can run before 004)
5. `004_transport_pickup_schedules.sql` - Requires marketplace and aggregation
6. `006_payments_escrow.sql` - Requires marketplace and transport
7. `007_input_orders.sql` - Requires users and transport
8. `008_ratings_advisories.sql` - Requires users and marketplace
9. `009_functions_constraints.sql` - Requires all tables

---

## Rollback Strategy

Each migration should have a corresponding rollback script. Create `001_init_user_auth_notifications.rollback.sql` etc.

**Example Rollback:**
```sql
-- Rollback 001_init_user_auth_notifications.sql
DROP TRIGGER IF EXISTS update_users_updated_at ON "users";
DROP TRIGGER IF EXISTS update_profiles_updated_at ON "profiles";
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS "activity_logs";
DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "profiles";
DROP TABLE IF EXISTS "refresh_tokens";
DROP TABLE IF EXISTS "users";
DROP TYPE IF EXISTS "NotificationPriority";
DROP TYPE IF EXISTS "UserStatus";
DROP TYPE IF EXISTS "UserRole";
```

---

## Best Practices

1. **Always test migrations** on a development database first
2. **Backup database** before running migrations in production
3. **Run migrations in transaction** when possible
4. **Document breaking changes** in migration comments
5. **Version control** all migration files
6. **Never modify** existing migrations (create new ones instead)
7. **Use descriptive names** for migrations
8. **Include rollback scripts** for production safety

---

## Verification

After running migrations, verify:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check all enums exist
SELECT typname 
FROM pg_type 
WHERE typtype = 'e' 
ORDER BY typname;

-- Check all functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;
```

---

## Troubleshooting

### Foreign Key Violations
- Ensure migrations are run in correct order
- Check that referenced tables exist before creating foreign keys

### Enum Conflicts
- Enums are created per migration, ensure no duplicates
- If enum already exists, use `CREATE TYPE IF NOT EXISTS` (PostgreSQL 9.5+)

### Sequence Issues
- Sequences are created per migration
- Reset sequences if needed: `ALTER SEQUENCE sequence_name RESTART WITH 1;`

### Trigger Conflicts
- Drop existing triggers before recreating
- Use `CREATE OR REPLACE FUNCTION` for functions

---

**Migration files are ready for deployment!** 🚀
